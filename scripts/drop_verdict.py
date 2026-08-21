"""Drop-zone verdict engine: visibility gate -> zone filter -> severity -> hysteresis.

Pure logic, no cv2/aiohttp/clock dependencies: the caller injects frame
detections, measured brightness, and the current time, so the whole pipeline
is unit-testable (tests/test_drop_verdict.py).
"""
from dataclasses import dataclass

# Label -> hazard severity in a drop-zone context. Anything unknown (chairs,
# backpacks, debris) still blocks a drop but scores as a milder hazard.
SEVERITY = {
    "person": 1.0,
    "dog": 0.9, "cat": 0.9, "horse": 0.9, "sheep": 0.9, "cow": 0.9, "bird": 0.7,
    "bicycle": 0.8, "car": 0.8, "motorcycle": 0.8, "bus": 0.8, "truck": 0.8, "train": 0.8,
}
DEFAULT_SEVERITY = 0.4


@dataclass
class Verdict:
    state: str    # "GO" | "HOLD" | "NO_GO"
    reason: str   # human-readable, shown in the UI
    score: int    # 0-100 drop-safety score
    in_zone: int  # detections intersecting the landing zone
    nearby: int   # detections elsewhere in frame


class VerdictEngine:
    """Stateful: remembers the last hazard so GO requires a sustained-clear window."""

    def __init__(self, clear_hold_s=3.0, min_brightness=8.0, zone=(0.25, 0.25, 0.75, 0.75)):
        self.clear_hold_s = clear_hold_s
        self.min_brightness = min_brightness
        self.zone = zone  # (x0, y0, x1, y1) as fractions of the frame
        self._last_hazard_ts = None

    def _in_zone(self, o, frame_w, frame_h):
        zx0, zy0 = self.zone[0] * frame_w, self.zone[1] * frame_h
        zx1, zy1 = self.zone[2] * frame_w, self.zone[3] * frame_h
        x0, y0 = o.get("x", 0), o.get("y", 0)
        x1, y1 = x0 + o.get("width", 0), y0 + o.get("height", 0)
        return x0 < zx1 and x1 > zx0 and y0 < zy1 and y1 > zy0

    def update(self, objects, frame_w, frame_h, brightness, now) -> Verdict:
        # 1. Visibility gate: a dark/covered camera must never report GO.
        if brightness < self.min_brightness:
            return Verdict("NO_GO", f"no visibility (brightness {brightness:.0f}/255)", 0, 0, 0)

        # 2. Zone filter.
        in_zone = [o for o in objects if self._in_zone(o, frame_w, frame_h)]
        nearby = len(objects) - len(in_zone)

        # 3. Severity: the worst in-zone hazard drives the verdict and score.
        if in_zone:
            self._last_hazard_ts = now
            worst = max(in_zone, key=lambda o: SEVERITY.get(o.get("label", ""), DEFAULT_SEVERITY)
                        * o.get("confidence", 0.0))
            sev = SEVERITY.get(worst.get("label", ""), DEFAULT_SEVERITY)
            conf = worst.get("confidence", 0.0)
            score = max(0, 100 - round(sev * conf * 100))
            return Verdict("HOLD", f"{worst.get('label', 'object')} in zone ({conf:.0%})",
                           score, len(in_zone), nearby)

        # 4. Hysteresis: zone must stay clear for clear_hold_s before GO.
        if self._last_hazard_ts is not None:
            elapsed = now - self._last_hazard_ts
            if elapsed < self.clear_hold_s:
                return Verdict("HOLD", f"clearing {elapsed:.1f}s / {self.clear_hold_s:.0f}s",
                               100, 0, nearby)

        reason = "zone clear" + (f" · {nearby} nearby" if nearby else "")
        return Verdict("GO", reason, 100, 0, nearby)
