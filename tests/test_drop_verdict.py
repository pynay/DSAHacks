"""VerdictEngine: visibility gate -> zone filter -> severity -> hysteresis."""
from scripts.drop_verdict import VerdictEngine

W, H = 1920, 1080  # zone (0.25,0.25,0.75,0.75) -> px x:[480,1440] y:[270,810]


def make_engine(**kw):
    defaults = dict(clear_hold_s=3.0, min_brightness=8.0, zone=(0.25, 0.25, 0.75, 0.75))
    defaults.update(kw)
    return VerdictEngine(**defaults)


def obj(x, y, w=200, h=300, conf=0.9, label="person"):
    return {"label": label, "confidence": conf, "x": x, "y": y, "width": w, "height": h}


def test_no_visibility_is_no_go():
    v = make_engine().update([], W, H, brightness=2.0, now=0.0)
    assert v.state == "NO_GO"
    assert "visibility" in v.reason.lower()


def test_no_visibility_beats_hazard():
    v = make_engine().update([obj(900, 500)], W, H, brightness=1.0, now=0.0)
    assert v.state == "NO_GO"


def test_person_in_zone_holds_with_reason():
    v = make_engine().update([obj(900, 500, conf=0.9)], W, H, brightness=120.0, now=0.0)
    assert v.state == "HOLD"
    assert v.in_zone == 1
    assert "person" in v.reason.lower()
    assert "90" in v.reason


def test_detection_outside_zone_allows_go():
    v = make_engine().update([obj(0, 0, w=200, h=200)], W, H, brightness=120.0, now=0.0)
    assert v.state == "GO"
    assert v.in_zone == 0
    assert v.nearby == 1


def test_box_straddling_zone_edge_counts_as_in_zone():
    # box x:[400,600] overlaps zone left edge at 480
    v = make_engine().update([obj(400, 500)], W, H, brightness=120.0, now=0.0)
    assert v.state == "HOLD"
    assert v.in_zone == 1


def test_clearing_window_after_hazard():
    eng = make_engine()
    assert eng.update([obj(900, 500)], W, H, brightness=120.0, now=0.0).state == "HOLD"
    mid = eng.update([], W, H, brightness=120.0, now=1.0)
    assert mid.state == "HOLD"
    assert "clearing" in mid.reason.lower()
    assert eng.update([], W, H, brightness=120.0, now=4.2).state == "GO"


def test_new_hazard_resets_clearing_timer():
    eng = make_engine()
    eng.update([obj(900, 500)], W, H, brightness=120.0, now=0.0)
    eng.update([obj(900, 500)], W, H, brightness=120.0, now=2.0)
    assert eng.update([], W, H, brightness=120.0, now=4.0).state == "HOLD"  # only 2s clear
    assert eng.update([], W, H, brightness=120.0, now=5.2).state == "GO"


def test_severity_score_person():
    v = make_engine().update([obj(900, 500, conf=0.9)], W, H, brightness=120.0, now=0.0)
    assert v.score == 10  # 100 - 1.0*0.9*100


def test_severity_score_benign_object_scores_higher_but_still_holds():
    v = make_engine().update([obj(900, 500, conf=0.5, label="chair")], W, H, brightness=120.0, now=0.0)
    assert v.state == "HOLD"
    assert v.score == 80  # 100 - 0.4*0.5*100
    assert "chair" in v.reason.lower()


def test_empty_bright_zone_scores_100():
    v = make_engine().update([], W, H, brightness=120.0, now=0.0)
    assert v.state == "GO"
    assert v.score == 100
    assert v.reason.lower().startswith("zone clear")
