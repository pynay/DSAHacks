# EyePop webcam vision for Drone Ops — design

**Date:** 2026-08-21 · **Status:** approved in chat (webcam demo shape, built-in person detection)

## Goal

Replace the Drone Ops view's *scripted* EyePop detection with **real EyePop.ai inference**
on a live laptop-webcam feed, while keeping the flight simulator for position/telemetry.
On stage: step into the webcam frame over the drop-zone reticle → the badge flips to
OBSTRUCTED with the detector's real confidence; step out → CLEAR.

## Architecture

```
webcam ──OpenCV──▶ scripts/eyepop_bridge.py ──upload()──▶ EyePop async worker
                        │   (eyepop.person:latest, transient session)
                        │◀── objects[] per frame
                        ├── in-memory latest {verdict, boxes, annotated JPEG}
                        └── aiohttp on localhost:8091  (CORS: *)
                              ├── GET /detection  → latest verdict JSON
                              └── GET /frame.jpg  → latest annotated frame
Next.js (3000)
  src/lib/droneVision.ts ── polls /detection every ~600 ms
  src/app/drone/page.tsx ── merges real verdict over simulator's detection,
                            shows webcam panel (frame.jpg, cache-busted)
```

Flight position, battery, ETA etc. stay simulated (`src/lib/drone.ts` untouched).
Only the vision channel becomes real.

## Component 1 — `scripts/eyepop_bridge.py` (new)

- Credentials from **script-relative** `scripts/.env` via `load_dotenv(Path(__file__).parent / ".env", override=True)`; key passed as `api_key=` (`eyp_...` short key → transient worker session on compute.eyepop.ai).
- `Pop(components=[InferenceComponent(ability="eyepop.person:latest", confidenceThreshold=0.7)])`.
- Capture loop ~1.5 fps: `cv2.VideoCapture(CAMERA_INDEX)` → grab frame → JPEG temp file → `await endpoint.upload(path)` → `await job.predict()` (webcams are not RTSP sources, so the per-frame upload loop is the SDK-documented path; `load_from()` stays the seam for a future real drone stream).
- Holds only the **latest** result (no queue — stale frames dropped).
- Annotates the frame: person boxes (red when in-zone, grey otherwise) + centered drop-zone reticle.
- aiohttp app, port `EYEPOP_BRIDGE_PORT` (default 8091), `Access-Control-Allow-Origin: *`:
  - `GET /detection` → `{"label": "clear"|"obstructed", "confidence": float, "objects": int, "inZone": int, "ts": ms}`
  - `GET /frame.jpg` → latest annotated JPEG.
- Fails loud and early: missing key, camera unavailable, or EyePop auth error print an actionable message and exit non-zero.

## Component 2 — obstruction semantics (pure, tested)

`is_obstructed(objects, frame_w, frame_h) -> tuple[bool, float, int]` — OBSTRUCTED iff any
detected person's box **intersects the central reticle** (center 50% of the frame, i.e.
x ∈ [0.25 w, 0.75 w], y ∈ [0.25 h, 0.75 h]); reported confidence = max confidence among
in-zone boxes (0.0 when none). CLEAR carries `inZone: 0` — the UI says "0 obstructions in zone" rather
than showing a fabricated percentage. Pure function in the bridge module; covered by
`tests/test_eyepop_bridge.py` (pytest, no network/camera).

## Component 3 — `src/lib/droneVision.ts` (new)

Client hook `useDroneVision()`:
- Polls `http://localhost:8091/detection` every 600 ms (`AbortController`, short timeout).
- Returns `{connected: boolean, detection: {label, confidence, inZone} | null, frameUrl: string}`.
- Any fetch failure → `connected: false` (no console spam, no retry storm — next tick tries again).
- Polling over SSE/WebSocket: one fewer failure mode on stage; the page already ticks at 650 ms.

## Component 4 — `src/app/drone/page.tsx` (edit)

- `const vision = useDroneVision()`; effective detection = `vision.connected ? vision.detection : tel.detection`.
- Badge: vision connected → emerald "VISION LIVE · EyePop.ai — flight simulated"; else today's amber "SIMULATED FLIGHT — connect drone/EyePop to go live".
- New webcam panel in the right column (above "Connect a real feed"): `<img>` of `frame.jpg?t=<tick>`, ~16:9, with the CLEAR/OBSTRUCTED state echoed under it.
- "Connect a real feed" card updated: `python scripts/eyepop_bridge.py` starts the vision bridge; the WebSocket/`DroneTelemetry` seam text remains for the flight side.
- Bridge down → page behaves exactly as today.

## Dependencies

`requirements.txt` += `eyepop`, `opencv-python`, `python-dotenv`. Local Python is 3.14;
if `eyepop`/`opencv-python` wheels refuse it, run the bridge from a 3.12 venv — no design change.

## Testing

- **pytest:** reticle-intersection logic (`is_obstructed`) — boxes in/out/straddling the zone, empty list, confidence pick.
- **Manual demo check:** bridge up → badge flips within ~1 s of entering frame; bridge killed mid-demo → page falls back to simulated badge without errors.
- Existing `vitest run` and `pytest` suites stay green.

## Out of scope

Custom VLM abilities (dataEndpoint/registration), RTSP/mediamtx, recording or storing
frames, multi-camera, auth on the localhost bridge.
