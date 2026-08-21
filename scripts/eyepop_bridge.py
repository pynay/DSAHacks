#!/usr/bin/env python3
"""EyePop.ai webcam vision bridge for the Drone Ops view.

Two independent loops, so video runs at full camera rate while cloud
inference runs as fast as its round-trip allows:

  capture loop   webcam -> annotate latest frame with latest boxes -> MJPEG
  inference loop newest frame -> eyepop.person:latest -> update boxes

Serves on localhost:8091:
    GET /detection   -> {"count", "label", "confidence", "persons",
                         "video_fps", "infer_fps", "ts"}
    GET /stream.mjpg -> multipart MJPEG push stream at camera rate
    GET /frame.jpg   -> latest annotated frame (single shot)

Run:  .venv/bin/python scripts/eyepop_bridge.py
Env:  scripts/.env  (EYEPOP_API_KEY=eyp_..., see scripts/.env.example)
Venv note: eyepop pins pyarrow<22 which has no CPython 3.14 wheels; install
with `pip install --no-deps eyepop` plus deps and `pyarrow>=22` (see git log).
"""
import asyncio
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

load_dotenv(Path(__file__).parent / ".env", override=True)
# override=True: a stale shell var must not silently win over scripts/.env

API_KEY = os.environ.get("EYEPOP_API_KEY", "")
PORT = int(os.environ.get("EYEPOP_BRIDGE_PORT", "8091"))
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))
# Optional: run EyePop on a video file/URL instead of the live webcam (loops).
# Handy for demos where camera permission isn't available.
VIDEO_SOURCE = os.environ.get("VIDEO_SOURCE")
CAMERA_FPS_REQ = int(os.environ.get("CAMERA_FPS", "120"))  # hardware clamps to what it can do
CONFIDENCE = 0.5
# Detect the whole delivery scene (people, packages, objects). Override with
# EYEPOP_ABILITY (e.g. eyepop.person:latest for people only).
EYEPOP_ABILITY = os.environ.get("EYEPOP_ABILITY", "eyepop.common-objects:latest")

POP = Pop(components=[
    InferenceComponent(ability=EYEPOP_ABILITY, confidenceThreshold=CONFIDENCE)
])

# Latest state, shared between loops and the web app.
state: dict = {"ready": False, "ts": 0, "count": 0, "label": "clear",
               "confidence": 0.0, "persons": [], "objects": [], "jpeg": b"", "frame_seq": 0,
               "video_fps": 0.0, "infer_fps": 0.0}
latest_raw: dict = {"jpg": b""}  # newest un-annotated frame (jpeg bytes) for the inference loop


def ema(prev: float, dt: float) -> float:
    """Exponential moving average of instantaneous fps."""
    inst = 1.0 / dt if dt > 0 else 0.0
    return inst if prev == 0.0 else prev * 0.9 + inst * 0.1


def grab_and_annotate(cap, objects, video_fps, infer_fps):
    """Blocking: read one frame, return (raw_jpeg, annotated_jpeg) bytes.

    Runs in the executor; ALL cv2/numpy work happens here. Only bytes cross
    threads — AVFoundation reuses/frees its capture buffer, and touching it
    from another thread segfaults (seen with Continuity Cameras).
    """
    ok, frame = cap.read()
    if not ok:
        return None
    frame = frame.copy()  # detach from the capture buffer immediately
    ok_raw, raw_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    for o in objects:
        x, y = int(o["x"]), int(o["y"])
        w, h = int(o["width"]), int(o["height"])
        # People are the drop-zone hazard (red); everything else is cyan.
        color = (60, 60, 235) if o.get("label") == "person" else (220, 200, 40)
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        tag = f"{o.get('label', 'object')} {o['confidence'] * 100:.0f}%"
        cv2.rectangle(frame, (x, y - 22), (x + 8 + 10 * len(tag), y), color, -1)
        cv2.putText(frame, tag, (x + 4, y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    banner = (f"EyePop.ai {EYEPOP_ABILITY}  |  {len(objects)} detected  |  "
              f"{video_fps:.0f} fps video / {infer_fps:.1f} fps inference")
    cv2.putText(frame, banner, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    ok_ann, ann_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return (raw_buf.tobytes() if ok_raw else b"", ann_buf.tobytes() if ok_ann else b"")


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
    if cap is not None:
        mean = _warmup_mean(cap)
        if mean >= 4.0:
            return cap
        print(f"  camera {CAMERA_INDEX} delivers black frames (mean {mean:.1f}), scanning...", flush=True)
        for i in range(4):
            if i == CAMERA_INDEX:
                continue
            alt = open_camera(i)
            if alt is None:
                continue
            alt_mean = _warmup_mean(alt)
            if alt_mean >= 4.0:
                print(f"  switched to live camera {i} (mean {alt_mean:.1f})", flush=True)
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
                None, grab_and_annotate, cap, state["objects"], state["video_fps"], state["infer_fps"])
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
            state["frame_seq"] += 1
            if VIDEO_SOURCE:  # pace file playback to ~25 fps (a live camera self-paces)
                await asyncio.sleep(1 / 25)
    finally:
        cap.release()


async def inference_loop(endpoint):
    tmp = Path(tempfile.mkstemp(suffix=".jpg", prefix="eyepop_frame_")[1])
    last = time.monotonic()
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
            objects = [
                {"label": o.get("classLabel", "object"),
                 "confidence": round(o.get("confidence", 0.0), 3),
                 "x": o.get("x", 0), "y": o.get("y", 0),
                 "width": o.get("width", 0), "height": o.get("height", 0)}
                for o in result.get("objects", [])
            ]
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
            )
    finally:
        tmp.unlink(missing_ok=True)


async def get_detection(_req):
    if not state["ready"]:
        return web.json_response({"warming": True}, status=503)
    body = {k: state[k] for k in ("ts", "count", "label", "confidence", "persons", "objects")}
    body["video_fps"] = round(state["video_fps"], 1)
    body["infer_fps"] = round(state["infer_fps"], 1)
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


async def cors(_req, res):
    res.headers["Access-Control-Allow-Origin"] = "*"  # localhost demo bridge


async def main():
    if not API_KEY:
        sys.exit("EYEPOP_API_KEY missing — copy scripts/.env.example to scripts/.env and set it.")
    print("Connecting to EyePop...", flush=True)
    async with EyePopSdk.async_worker(api_key=API_KEY) as endpoint:
        try:
            await endpoint.set_pop(POP)
        except Exception as e:
            sys.exit(f"EyePop rejected the session ({e}).\nCheck EYEPOP_API_KEY in scripts/.env "
                     "(keys are lowercase 'eyp_...' — a capitalized 'Eyp_' means a bad copy).")
        print(f"Connected. Pop: {EYEPOP_ABILITY}", flush=True)
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
            await asyncio.gather(capture_loop(), inference_loop(endpoint))
        finally:
            await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("bye")
