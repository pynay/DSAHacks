"""Session aggregates for the drone vision feed (pure, clock-injected)."""
import statistics
from collections import deque


class VisionStats:
    """Peak people, HOLD entries, and a rolling people-count series."""

    def __init__(self, maxlen=120, stabilize_window=5):
        self.peak_people = 0
        self.holds = 0
        self.samples = 0
        self._state = None
        self._series = deque(maxlen=maxlen)
        self._recent = deque(maxlen=stabilize_window)

    def add_sample(self, people, verdict_state, ts):
        """Record one sample; returns a transition event dict when the state changed."""
        self.samples += 1
        # Stabilize: a single hallucinated frame must not move the peak, so peak
        # and series use the low-median of the last few per-inference counts.
        self._recent.append(people)
        stable = statistics.median_low(self._recent)
        self.peak_people = max(self.peak_people, stable)
        self._series.append([ts, stable])
        prev = self._state
        self._state = verdict_state
        if verdict_state == "HOLD" and prev != "HOLD":
            self.holds += 1
        if prev is not None and prev != verdict_state:
            return {"type": "event", "from": prev, "to": verdict_state, "ts": ts}
        return None

    def series(self):
        return list(self._series)

    def summary(self):
        return {"peak_people": self.peak_people, "holds": self.holds, "samples": self.samples}
