#!/usr/bin/env python3
"""EyePop.ai webcam vision bridge for the Drone Ops view.

Two independent loops, so video runs at full camera rate while cloud
inference runs as fast as its round-trip allows:

  capture loop   webcam -> annotate latest frame with latest boxes -> MJPEG
  inference loop newest frame -> EyePop scene model -> update objects/person count

Serves on localhost:8091:
    GET /detection   -> {"count", "label", "confidence", "persons", "objects",
                         "video_fps", "infer_fps", "ts"}
    GET /stream.mjpg -> multipart MJPEG push stream at camera rate
    GET /frame.jpg   -> latest annotated frame (single shot)

Run:  python3.12 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
      .venv/bin/python scripts/eyepop_bridge.py
Env:  scripts/.env  (EYEPOP_API_KEY=eyp_..., see scripts/.env.example)
Python 3.12 is recommended because the EyePop SDK currently constrains pyarrow.
"""
import asyncio
import json
import os
import sys
import tempfile
import time
from pathlib import Path

import certifi

# python.org framework Pythons ship without system CA certs wired up; point
# SSL at certifi's bundle so compute.eyepop.ai verifies.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

import cv2
from aiohttp import web
from dotenv import load_dotenv
from eyepop import EyePopSdk
from eyepop.worker.worker_types import Pop, InferenceComponent

from drop_verdict import VerdictEngine
from privacy import head_regions, pad_and_clamp
from vision_stats import VisionStats

load_dotenv(Path(__file__).parent / ".env", override=True)
# override=True: a stale shell var must not silently win over scripts/.env

API_KEY = os.environ.get("EYEPOP_API_KEY", "")
PORT = int(os.environ.get("EYEPOP_BRIDGE_PORT", "8091"))
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get(
        "EYEPOP_BRIDGE_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
}
# Optional: run EyePop on a video file/URL instead of the live webcam (loops).
# Handy for demos where camera permission isn't available.
VIDEO_SOURCE = os.environ.get("VIDEO_SOURCE")
CAMERA_FPS_REQ = int(os.environ.get("CAMERA_FPS", "120"))  # hardware clamps to what it can do
CONFIDENCE = 0.5
# Detect the whole delivery scene (people, packages, objects). Override with
# EYEPOP_ABILITY (e.g. eyepop.person:latest for people only).
EYEPOP_ABILITY = os.environ.get("EYEPOP_ABILITY", "eyepop.common-objects:latest")
# Drop-verdict pipeline knobs (see scripts/drop_verdict.py).
CLEAR_HOLD_S = float(os.environ.get("CLEAR_HOLD_S", "3.0"))
MIN_BRIGHTNESS = float(os.environ.get("MIN_BRIGHTNESS", "8.0"))
DROP_ZONE = tuple(float(v) for v in os.environ.get("DROP_ZONE", "0.25,0.25,0.75,0.75").split(","))
ENGINE = VerdictEngine(clear_hold_s=CLEAR_HOLD_S, min_brightness=MIN_BRIGHTNESS, zone=DROP_ZONE)
BOOT_ID = f"{os.getpid()}-{int(time.time() * 1000)}"  # changes per process; lets the UI detect restarts
# Privacy: pixelate faces on every served frame (raw frames sent to EyePop stay
# unblurred so detection quality is unaffected). BLUR_FACES=0 disables.
BLUR_FACES = os.environ.get("BLUR_FACES", "1") != "0"
BLUR_BLOCKS = int(os.environ.get("BLUR_BLOCKS", "9"))  # mosaic blocks per axis: lower = stronger
BLUR_PAD = float(os.environ.get("BLUR_PAD", "0.25"))  # padding around face boxes
FACE_ABILITY = os.environ.get("EYEPOP_FACE_ABILITY", "eyepop.person.face.short-range:latest")
# Telemetry: JSONL log of 5s samples + verdict-transition events. Empty path disables.
VISION_LOG = os.environ.get("VISION_LOG", str(Path(__file__).parent.parent / "data" / "drone_vision_log.jsonl"))
SAMPLE_EVERY_S = 5.0
STATS = VisionStats(maxlen=2400)  # ~5 min of per-inference samples

POP = Pop(components=[
    InferenceComponent(ability=EYEPOP_ABILITY, confidenceThreshold=CONFIDENCE),
    InferenceComponent(ability=FACE_ABILITY, confidenceThreshold=0.4),
])
POP_NO_FACE = Pop(components=[
    InferenceComponent(ability=EYEPOP_ABILITY, confidenceThreshold=CONFIDENCE)
])

# Latest state, shared between loops and the web app.
state: dict = {"ready": False, "ts": 0, "count": 0, "label": "clear",
               "confidence": 0.0, "persons": [], "objects": [], "jpeg": b"", "frame_seq": 0,
               "video_fps": 0.0, "infer_fps": 0.0,
               "brightness": 0.0, "frame_wh": (1920, 1080), "verdict": None,
               "blur": [], "face_mode": "off"}
latest_raw: dict = {"jpg": b""}  # newest un-annotated frame (jpeg bytes) for the inference loop


def ema(prev: float, dt: float) -> float:
    """Exponential moving average of instantaneous fps."""
    inst = 1.0 / dt if dt > 0 else 0.0
    return inst if prev == 0.0 else prev * 0.9 + inst * 0.1


def grab_and_annotate(cap, objects, video_fps, infer_fps, verdict, zone, blur_regions):
    """Blocking: read one frame, return (raw_jpeg, annotated_jpeg) bytes.

    Runs in the executor; ALL cv2/numpy work happens here. Only bytes cross
    threads — AVFoundation reuses/frees its capture buffer, and touching it
    from another thread segfaults (seen with Continuity Cameras).
    """
    ok, frame = cap.read()
    if not ok:
        return None
    frame = frame.copy()  # detach from the capture buffer immediately
    brightness = float(frame[::16, ::16].mean())  # subsampled: feeds the visibility gate
    fh, fw = frame.shape[:2]
    ok_raw, raw_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    # Privacy first: pixelate face regions on the SERVED frame only (raw above
    # is already encoded for EyePop). Regions arrive padded + clamped.
    for (bx0, by0, bx1, by1) in blur_regions:
        if bx1 - bx0 > 4 and by1 - by0 > 4:
            roi = frame[by0:by1, bx0:bx1]
            # Heavy anonymization: INTER_AREA downsampling to a coarse mosaic
            # box-averages each block (a strong blur by itself, and cheap enough
            # to run per frame at 30fps — an explicit GaussianBlur here cost 5x).
            small = cv2.resize(roi, (max(2, min(BLUR_BLOCKS, (bx1 - bx0) // 8)),
                                     max(2, min(BLUR_BLOCKS, (by1 - by0) // 8))),
                               interpolation=cv2.INTER_AREA)
            frame[by0:by1, bx0:bx1] = cv2.resize(small, (bx1 - bx0, by1 - by0),
                                                 interpolation=cv2.INTER_NEAREST)
    for o in objects:
        x, y = int(o["x"]), int(o["y"])
        w, h = int(o["width"]), int(o["height"])
        # In-zone detections are the hazard (red); everything else is cyan.
        color = (60, 60, 235) if o.get("in_zone") else (220, 200, 40)
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        tag = f"{o.get('label', 'object')} {o['confidence'] * 100:.0f}%"
        cv2.rectangle(frame, (x, y - 22), (x + 8 + 10 * len(tag), y), color, -1)
        cv2.putText(frame, tag, (x + 4, y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    banner = (f"EyePop.ai {EYEPOP_ABILITY}  |  {len(objects)} detected  |  "
              f"{video_fps:.0f} fps video / {infer_fps:.1f} fps inference"
              + (f"  |  {len(blur_regions)} face(s) blurred" if blur_regions else ""))
    cv2.putText(frame, banner, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    # Landing-zone reticle + verdict line, colored by state.
    zx0, zy0, zx1, zy1 = int(zone[0] * fw), int(zone[1] * fh), int(zone[2] * fw), int(zone[3] * fh)
    zcol = {"GO": (80, 220, 80), "HOLD": (40, 190, 255), "NO_GO": (60, 60, 235)}.get(
        verdict["state"] if verdict else "", (200, 200, 200))
    cv2.rectangle(frame, (zx0, zy0), (zx1, zy1), zcol, 2)
    line2 = (f"{verdict['state'].replace('_', '-')}: {verdict['reason']}  |  safety {verdict['score']}"
             if verdict else "verdict warming up...")
    cv2.putText(frame, line2, (12, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.6, zcol, 2)
    ok_ann, ann_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return (raw_buf.tobytes() if ok_raw else b"", ann_buf.tobytes() if ok_ann else b"", brightness, (fw, fh))


def _warmup_mean(cap, frames=6):
    """Read a few frames while exposure settles; return the last frame's mean brightness."""
    mean = -1.0
    for _ in range(frames):
        ok, f = cap.read()
        if ok:
            mean = float(f.mean())
    return mean


def open_camera(index):
    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_FPS, CAMERA_FPS_REQ)
    print(f"Camera {index}: {cap.get(cv2.CAP_PROP_FRAME_WIDTH):.0f}x{cap.get(cv2.CAP_PROP_FRAME_HEIGHT):.0f}"
          f" @ {cap.get(cv2.CAP_PROP_FPS):.0f} fps granted (requested {CAMERA_FPS_REQ})", flush=True)
    return cap


def open_best_camera():
    """Open the configured camera; if it only delivers black frames (e.g. a
    face-down Continuity iPhone grabbed index 0), scan for a live device."""
    if VIDEO_SOURCE:
        vcap = cv2.VideoCapture(VIDEO_SOURCE)
        if vcap.isOpened():
            print(f"Using VIDEO_SOURCE {VIDEO_SOURCE} (looped) instead of the webcam", flush=True)
            return vcap
        print(f"VIDEO_SOURCE {VIDEO_SOURCE} could not be opened; falling back to camera", flush=True)
    cap = open_camera(CAMERA_INDEX)
    if cap is not None and _warmup_mean(cap) >= 4.0:
        return cap
    # Configured index missing entirely OR only black frames: a Continuity
    # iPhone coming/going reshuffles AVFoundation indices, so scan for any
    # live device rather than exiting.
    print(f"  camera {CAMERA_INDEX} unavailable or black, scanning...", flush=True)
    for i in range(4):
        if i == CAMERA_INDEX:
            continue
        alt = open_camera(i)
        if alt is None:
            continue
        alt_mean = _warmup_mean(alt)
        if alt_mean >= 4.0:
            print(f"  switched to live camera {i} (mean {alt_mean:.1f})", flush=True)
            if cap is not None:
                cap.release()
            return alt
        alt.release()
    print("  no live camera found; staying on configured index", flush=True)
    return cap


async def capture_loop():
    loop = asyncio.get_running_loop()
    cap = await loop.run_in_executor(None, open_best_camera)
    if cap is None:
        sys.exit(f"Camera {CAMERA_INDEX} unavailable. On macOS grant camera access to your "
                 "terminal (System Settings > Privacy & Security > Camera) and retry. "
                 "If index 0 is a Continuity iPhone, try CAMERA_INDEX=1.")
    last = time.monotonic()
    misses = 0
    try:
        while True:
            got_frame = await loop.run_in_executor(
                None, grab_and_annotate, cap, state["objects"], state["video_fps"],
                state["infer_fps"], state["verdict"], DROP_ZONE, state["blur"])
            if got_frame is None:
                if VIDEO_SOURCE:  # end of file -> loop it
                    await loop.run_in_executor(None, cap.set, cv2.CAP_PROP_POS_FRAMES, 0)
                    await asyncio.sleep(0.01)
                    continue
                misses += 1
                if misses >= 60:
                    sys.exit("Camera gone for 30s, giving up. If index 0 is a Continuity "
                             "iPhone, set CAMERA_INDEX=1 and restart.")
                if misses % 6 == 0:  # device vanished (Continuity Camera?) — reopen
                    print("  camera not returning frames, reopening...", flush=True)
                    await loop.run_in_executor(None, cap.release)
                    cap = await loop.run_in_executor(None, open_best_camera) or cap
                await asyncio.sleep(0.5)
                continue
            misses = 0
            now = time.monotonic()
            state["video_fps"] = ema(state["video_fps"], now - last)
            last = now
            latest_raw["jpg"] = got_frame[0]
            state["jpeg"] = got_frame[1]
            state["brightness"] = got_frame[2]
            state["frame_wh"] = got_frame[3]
            state["frame_seq"] += 1
            if VIDEO_SOURCE:  # pace file playback to ~25 fps (a live camera self-paces)
                await asyncio.sleep(1 / 25)
    finally:
        cap.release()


def log_line(payload: dict):
    """Append one JSONL line to the vision log (crash-safe: open/flush per write)."""
    if not VISION_LOG:
        return
    try:
        path = Path(VISION_LOG)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a") as f:
            f.write(json.dumps(payload) + "\n")
    except OSError as e:
        print(f"  vision log write failed: {e}", flush=True)


async def inference_loop(endpoint):
    tmp = Path(tempfile.mkstemp(suffix=".jpg", prefix="eyepop_frame_")[1])
    last = time.monotonic()
    last_log_wall = 0.0
    try:
        while True:
            raw = latest_raw["jpg"]
            if not raw:  # camera warming up
                await asyncio.sleep(0.05)
                continue
            tmp.write_bytes(raw)
            try:
                job = await endpoint.upload(str(tmp))
                result = await job.predict()
            except Exception as e:  # transient inference error: log, keep looping
                print(f"  inference error: {e}", flush=True)
                await asyncio.sleep(1.0)
                continue
            objects, face_boxes = [], []
            for o in result.get("objects", []):
                parsed = {"label": o.get("classLabel", "object"),
                          "confidence": round(o.get("confidence", 0.0), 3),
                          "x": o.get("x", 0), "y": o.get("y", 0),
                          "width": o.get("width", 0), "height": o.get("height", 0)}
                # Faces feed the privacy blur, not the verdict/chips.
                if "face" in parsed["label"].lower():
                    face_boxes.append(parsed)
                else:
                    objects.append(parsed)
            fw, fh = state["frame_wh"]
            for o in objects:
                o["in_zone"] = ENGINE.in_zone(o, fw, fh)
            if BLUR_FACES:
                # Belt and braces: any person without a detected face inside their
                # box (back of head, detector miss) gets a head-region blur too.
                # Faces boxes start at the forehead: lift them so hair/top of
                # head is anonymized too.
                blur_boxes = [{**f, "y": f["y"] - f["height"] * 0.25,
                               "height": f["height"] * 1.25} for f in face_boxes]
                for pers in (o for o in objects if o["label"] == "person"):
                    has_face = any(
                        pers["x"] <= f["x"] + f["width"] / 2 <= pers["x"] + pers["width"]
                        and pers["y"] <= f["y"] + f["height"] / 2 <= pers["y"] + pers["height"]
                        for f in face_boxes)
                    if not has_face:
                        blur_boxes.extend(head_regions(pers))
                state["blur"] = [pad_and_clamp(b, fw, fh, pad=BLUR_PAD) for b in blur_boxes]
            else:
                state["blur"] = []
            verdict = ENGINE.update(objects, fw, fh, state["brightness"], time.monotonic())
            persons = [o for o in objects if o["label"] == "person"]
            now = time.monotonic()
            state["infer_fps"] = ema(state["infer_fps"], now - last)
            last = now
            state.update(
                ready=True,
                ts=int(time.time() * 1000),
                count=len(persons),  # drop-zone hazard count = people in frame
                label="obstructed" if persons else "clear",
                confidence=max((p["confidence"] for p in persons), default=0.0),
                persons=persons,
                objects=objects,
                verdict={"state": verdict.state, "reason": verdict.reason, "score": verdict.score,
                         "inZone": verdict.in_zone, "nearby": verdict.nearby, "zone": list(DROP_ZONE)},
            )
            # Telemetry: per-inference stats; JSONL gets transition events + 5s samples.
            wall = time.time()
            event = STATS.add_sample(people=len(persons), verdict_state=verdict.state, ts=wall)
            if event:
                log_line({**event, "reason": verdict.reason, "people": len(persons)})
            if wall - last_log_wall >= SAMPLE_EVERY_S:
                last_log_wall = wall
                by_label = {}
                for o in objects:
                    by_label[o["label"]] = by_label.get(o["label"], 0) + 1
                log_line({"type": "sample", "ts": wall, "people": len(persons),
                          "state": verdict.state, "score": verdict.score,
                          "brightness": round(state["brightness"], 1), "objects": by_label,
                          "faces_blurred": len(state["blur"])})
    finally:
        tmp.unlink(missing_ok=True)


async def get_detection(_req):
    if not state["ready"]:
        return web.json_response({"warming": True}, status=503)
    body = {k: state[k] for k in ("ts", "count", "label", "confidence", "persons", "objects")}
    body["video_fps"] = round(state["video_fps"], 1)
    body["infer_fps"] = round(state["infer_fps"], 1)
    body["verdict"] = state["verdict"]
    body["brightness"] = round(state["brightness"], 1)
    body["boot_id"] = BOOT_ID
    body["face_mode"] = state["face_mode"]
    body["blurred"] = len(state["blur"])
    body["stats"] = {**STATS.summary(), "series": STATS.series()[::10][-60:]}
    return web.json_response(body)


async def get_frame(_req):
    if not state["jpeg"]:
        raise web.HTTPServiceUnavailable()
    return web.Response(body=state["jpeg"], content_type="image/jpeg")


async def get_stream(request):
    """Push MJPEG at camera rate: each new frame_seq ships one part."""
    resp = web.StreamResponse(
        headers={"Content-Type": "multipart/x-mixed-replace; boundary=frame"})
    await resp.prepare(request)
    sent_seq = -1
    try:
        while True:
            if state["jpeg"] and state["frame_seq"] != sent_seq:
                sent_seq = state["frame_seq"]
                await resp.write(
                    b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                    + str(len(state["jpeg"])).encode() + b"\r\n\r\n" + state["jpeg"] + b"\r\n")
            await asyncio.sleep(0.005)  # 200 Hz poll of frame_seq; ships at camera rate
    except (ConnectionResetError, ConnectionError, asyncio.CancelledError):
        pass  # viewer closed the tab
    return resp


async def watchdog():
    """Exit (for the supervisor to restart us) if capture silently stalls.

    A hung AVFoundation read blocks its executor thread forever: frames stop
    but inference keeps re-processing the last frame, so /detection looks
    alive while the feed is frozen. frame_seq not advancing is the tell.
    """
    seq = -1
    stalled_since = None
    while True:
        await asyncio.sleep(2.0)
        if state["frame_seq"] == 0:  # camera still warming up / scanning
            continue
        if state["frame_seq"] == seq:
            stalled_since = stalled_since or time.monotonic()
            if time.monotonic() - stalled_since > 15.0:
                print("watchdog: capture stalled >15s, exiting for supervisor restart", flush=True)
                os._exit(3)
        else:
            stalled_since = None
            seq = state["frame_seq"]


async def cors(req, res):
    """Allow the Parsel web origin without exposing the camera feed globally."""
    origin = req.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        res.headers["Access-Control-Allow-Origin"] = origin
        res.headers["Vary"] = "Origin"


async def main():
    if not API_KEY:
        sys.exit("EYEPOP_API_KEY missing — copy scripts/.env.example to scripts/.env and set it.")
    print("Connecting to EyePop...", flush=True)
    async with EyePopSdk.async_worker(api_key=API_KEY) as endpoint:
        try:
            await endpoint.set_pop(POP)
            state["face_mode"] = "eyepop-face" if BLUR_FACES else "off"
        except Exception as e:
            print(f"  face ability unavailable ({str(e)[:80]}), falling back to head-region blur", flush=True)
            try:
                await endpoint.set_pop(POP_NO_FACE)
                state["face_mode"] = "head-fallback" if BLUR_FACES else "off"
            except Exception as e2:
                sys.exit(f"EyePop rejected the session ({e2}).\nCheck EYEPOP_API_KEY in scripts/.env "
                         "(keys are lowercase 'eyp_...' — a capitalized 'Eyp_' means a bad copy).")
        print(f"Connected. Pop: {EYEPOP_ABILITY} | face_mode={state['face_mode']}", flush=True)
        app = web.Application()
        app.on_response_prepare.append(cors)
        app.router.add_get("/detection", get_detection)
        app.router.add_get("/frame.jpg", get_frame)
        app.router.add_get("/stream.mjpg", get_stream)
        runner = web.AppRunner(app)
        await runner.setup()
        await web.TCPSite(runner, "127.0.0.1", PORT).start()
        print(f"Bridge up: http://localhost:{PORT}/detection", flush=True)
        try:
            await asyncio.gather(capture_loop(), inference_loop(endpoint), watchdog())
        finally:
            await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("bye")
