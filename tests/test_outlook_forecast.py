import numpy as np
import pandas as pd
from ml.outlook_forecast import make_frame, backtest, forecast, interpolated_months

HOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]


def _panel(n=108, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2017-01-01", periods=n, freq="MS")
    rows = []
    for i, h in enumerate(HOODS):
        base = 100 * (i + 1)
        y = base + 20 * np.sin(2 * np.pi * idx.month / 12) + rng.normal(0, 8, n)
        rows.append(pd.DataFrame({"obs_month": idx, "neighborhood": h, "y": y}))
    p = pd.concat(rows, ignore_index=True)
    gaps = p["obs_month"].isin(pd.to_datetime(["2025-07-01", "2025-08-01", "2025-10-01", "2025-11-01"]))
    p.loc[gaps, "y"] = np.nan
    return p


def test_interp_flags_exactly_the_gaps():
    f = make_frame(_panel())
    assert interpolated_months(f) == ["2025-07", "2025-08", "2025-10", "2025-11"]
    assert f["y_filled"].notna().all()


def test_backtest_shape_and_baselines():
    f = make_frame(_panel())
    origins = list(pd.date_range("2023-01-01", "2024-12-01", freq="MS"))
    table, resid = backtest(f, origins)
    assert list(table["horizon"]) == list(range(1, 13))
    assert (table["n"] > 0).all() and set(resid) == set(range(1, 13))
    # on a clean seasonal series the model should actually beat seasonal naive, not just
    # be in the same league
    assert table["model_mae"].mean() < table["seasonal_naive_mae"].mean()


def test_forecast_shape_bands_and_kind():
    f = make_frame(_panel())
    _, resid = backtest(f, list(pd.date_range("2023-01-01", "2024-12-01", freq="MS")))
    fc = forecast(f, pd.Timestamp("2025-12-01"), resid, run_month=pd.Timestamp("2026-08-01"))
    assert len(fc) == 72 and fc[["value", "lo80", "hi80"]].notna().all().all()
    assert (fc["lo80"] <= fc["value"]).all() and (fc["value"] <= fc["hi80"]).all()
    assert set(fc["kind"]) == {"nowcast", "forecast"}
    assert fc.loc[fc.obs_month == "2026-08-01", "kind"].eq("nowcast").all()
    assert fc.loc[fc.obs_month == "2026-09-01", "kind"].eq("forecast").all()
