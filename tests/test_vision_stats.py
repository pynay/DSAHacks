"""VisionStats: session aggregates for the drone vision feed."""
from scripts.vision_stats import VisionStats


def test_peak_ignores_single_frame_spikes():
    # One hallucinated frame (6 "people") must not move the peak.
    st = VisionStats()
    for i, n in enumerate((1, 1, 6, 1, 1)):
        st.add_sample(people=n, verdict_state="GO", ts=float(i))
    assert st.peak_people == 1


def test_peak_counts_sustained_rise():
    # Median of the last 5 samples: 3 people must persist ~3 frames to register.
    st = VisionStats()
    for i, n in enumerate((1, 2, 3, 3, 3)):
        st.add_sample(people=n, verdict_state="GO", ts=float(i))
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


def test_series_keeps_last_maxlen_stabilized_samples():
    # Series stores the stabilized (median) count so the sparkline matches peak semantics.
    st = VisionStats(maxlen=3)
    for i in range(5):  # raw 0,1,2,3,4 -> low-medians 0,0,1,1,2
        st.add_sample(people=i, verdict_state="GO", ts=float(i))
    assert st.series() == [[2.0, 1], [3.0, 1], [4.0, 2]]


def test_summary_shape():
    st = VisionStats()
    st.add_sample(people=2, verdict_state="HOLD", ts=1.0)
    s = st.summary()
    assert s["peak_people"] == 2
    assert s["holds"] == 1  # entering HOLD on the first sample counts
    assert s["samples"] == 1
