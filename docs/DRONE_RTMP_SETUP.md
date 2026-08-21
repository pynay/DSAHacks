# Live drone camera → EyePop (DJI Mini 4K via RTMP)

The Mini 4K has no SDK, so we don't get telemetry — but DJI Fly can livestream the
camera to a custom RTMP address. A local RTMP server (MediaMTX) relays it, and the
existing EyePop bridge reads that stream instead of the webcam. Everything downstream
(Drone Ops feed, "apply one stabilized count", hotspot update) is unchanged.

```
DJI Mini 4K ──(OcuSync)──▶ RC-N1C + phone (DJI Fly) ──RTMP over Wi-Fi──▶ MediaMTX on laptop
                                                               │
                                    scripts/eyepop_bridge.py ◀─┘ VIDEO_SOURCE=rtmp://localhost:1935/drone
                                                               │ EyePop.ai cloud inference
                                                               ▼
                                              Parsel Drone Ops page (localhost:3000)
```

## One-time setup (laptop)

```bash
brew install mediamtx ffmpeg
cd scripts && ~/.pyenv/versions/3.12.0/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp scripts/.env.example scripts/.env   # then set EYEPOP_API_KEY=eyp_...
```

## Run (three terminals)

```bash
# 1. RTMP relay
mediamtx scripts/mediamtx.yml

# 2. EyePop bridge reading the drone stream (people + vehicles, faces blurred)
cd scripts && VIDEO_SOURCE=rtmp://localhost:1935/drone .venv/bin/python eyepop_bridge.py

# 3. App
npm run dev
```

## Phone / drone side (DJI Fly)

1. Put the phone and the laptop on the **same Wi-Fi or phone hotspot**.
2. Find the laptop's IP on that network: `ipconfig getifaddr en0` (use the address on the shared network, not a VPN/Tailscale address).
3. Power on the drone + RC-N1C, open DJI Fly, enter camera view (props off is fine for a bench demo).
4. DJI Fly → **Transmission → Live Streaming Platforms → RTMP** → address
   `rtmp://<laptop-ip>:1935/drone` → Start. Stream is 720p, ~1–3 s latency.
5. The bridge log prints `Using LIVE stream rtmp://... (DJI Mini 4K via RTMP)`; the Drone Ops
   feed badge reads **LIVE · DJI Mini 4K via RTMP**.

## Test without the drone

```bash
ffmpeg -re -stream_loop -1 -f lavfi -i "testsrc2=size=1280x720:rate=25" -c:v libx264 \
  -preset veryfast -tune zerolatency -g 50 -pix_fmt yuv420p -f flv rtmp://localhost:1935/drone
# or replay a recorded flight: ffmpeg -re -stream_loop -1 -i flight.mp4 -c copy -f flv rtmp://localhost:1935/drone
```

## Stage fallback

Record the live stream once (`ffmpeg -i rtmp://localhost:1935/drone -c copy flight.mp4`) and, if
venue Wi-Fi fails, run the bridge with `VIDEO_SOURCE=flight.mp4` (looped). The badge then says
"recorded video" — never pretend a recording is live.

## What is and isn't real

- **Real:** the camera feed, EyePop detections (people, vehicles), face blurring, the operator-applied
  count and the hotspot model update.
- **Simulated:** drone position/route/battery on the map (no SDK on the Mini 4K). The UI labels it.
- **Not counted:** tents/structures (DSDP's third component) — needs a VLM ability; future work.

## Legal/ethical guardrails

Downtown San Diego is Class B airspace under SAN's approach; flying there needs Part 107, LAANC
authorization (many downtown grids are 0 ft), Remote ID, and Category-1 over-people rules. Demo from a
bench or a legal open area — never over an encampment. Faces are blurred in the bridge; only aggregate
counts leave it.
