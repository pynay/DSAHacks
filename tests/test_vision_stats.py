"""VisionStats: session aggregates for the drone vision feed."""
from scripts.vision_stats import VisionStats


def test_tracks_peak_people():
    st = VisionStats()
    for n in (1, 3, 2):
        st.add_sample(people=n, verdict_state="GO", ts=float(n))
    assert st.peak_people == 3


def test_counts_transitions_into_hold_only():
    st = VisionStats()
    for i, s in enumerate(["GO", "HOLD", "HOLD", "GO", "HOLD"]):
        st.add_sample(people=0, verdict_state=s, ts=float(i))
    assert st.holds == 2


def test_add_sample_returns_event_only_on_state_change():
    st = VisionStats()
    assert st.add_sample(people=0, verdict_state="GO", ts=0.0) is None  # first sample: no transition
    ev = st.add_sample(people=1, verdict_state="HOLD", ts=1.0)
    assert ev == {"type": "event", "from": "GO", "to": "HOLD", "ts": 1.0}
    assert st.add_sample(people=1, verdict_state="HOLD", ts=2.0) is None


def test_series_keeps_last_maxlen_samples():
    st = VisionStats(maxlen=3)
    for i in range(5):
        st.add_sample(people=i, verdict_state="GO", ts=float(i))
    assert st.series() == [[2.0, 2], [3.0, 3], [4.0, 4]]


def test_summary_shape():
    st = VisionStats()
    st.add_sample(people=2, verdict_state="HOLD", ts=1.0)
    s = st.summary()
    assert s["peak_people"] == 2
    assert s["holds"] == 1  # entering HOLD on the first sample counts
    assert s["samples"] == 1
