import json
import pandas as pd
from ml.outlook import load_panels, run

def test_real_run(tmp_path):
    import shutil
    root = tmp_path; (root / "marts").mkdir(); (root / "docs").mkdir()
    shutil.copy("marts/monthly_by_neighborhood.csv", root / "marts" / "monthly_by_neighborhood.csv")
    meta = run(root, run_month=pd.Timestamp("2026-08-01"))
    fc = pd.read_csv(root / "marts" / "outlook_forecast.csv")
    assert len(fc) == 72 and sorted(fc.neighborhood.unique()) == sorted(
        ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"])
    assert (fc.lo80 <= fc.value).all() and (fc.value <= fc.hi80).all()
    bt = pd.read_csv(root / "marts" / "outlook_backtest.csv"); assert len(bt) == 12
    its = pd.read_csv(root / "marts" / "outlook_its.csv")
    assert {"dsdp_adjusted_total", "gid_requests"} <= set(its.series)
    assert (its[its.scope == "downtown"].groupby("series").size() == 3).all()
    assert meta["interpolated_months"] == ["2025-07", "2025-08", "2025-10", "2025-11"]
    txt = (root / "docs" / "OUTLOOK_FINDINGS.md").read_text()
    assert "camping ban" in txt.lower() and "associated with" in txt and "reports" in txt
    assert "people fell" not in txt and "people rose" not in txt
    m = json.loads((root / "marts" / "outlook_meta.json").read_text())
    assert m["origin"] == "2025-12" and m["t0"] == "2023-08"
