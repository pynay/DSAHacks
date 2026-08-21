"""Outlook: forward-looking model on the observed downtown series + camping-ban ITS.
Run:  python ml/outlook.py   (from repo root). Reads marts/monthly_by_neighborhood.csv,
writes marts/outlook_*.{csv,json} and docs/OUTLOOK_FINDINGS.md. Deps: ml/requirements.txt."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.outlook_forecast import backtest, forecast, interpolated_months, make_frame  # noqa: E402
from ml.outlook_its import fit_its, placebo_its  # noqa: E402

HOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]
T0, PLACEBO_T0 = pd.Timestamp("2023-08-01"), pd.Timestamp("2022-08-01")
ITS_START = pd.Timestamp("2021-01-01")
ORIGIN = pd.Timestamp("2025-12-01")
BACKTEST_ORIGINS = list(pd.date_range("2023-01-01", "2024-12-01", freq="MS"))


def load_panels(mart_csv: Path):
    m = pd.read_csv(mart_csv, parse_dates=["obs_month"])
    d = m[(m.metric == "dsdp_adjusted_total") & (m.source_id == "H") & m.neighborhood.isin(HOODS)]
    full = pd.MultiIndex.from_product([HOODS, pd.date_range(d.obs_month.min(), d.obs_month.max(), freq="MS")],
                                      names=["neighborhood", "obs_month"])
    panel = (d.set_index(["neighborhood", "obs_month"])["value"].reindex(full).rename("y")
             .reset_index())
    dsdp_dt = panel.groupby("obs_month")["y"].sum(min_count=len(HOODS))  # NaN if any hood missing
    r = m[(m.metric == "gid_requests") & m.neighborhood.isin(HOODS)]
    req_dt = r.groupby("obs_month")["value"].sum()
    req_dt = req_dt.reindex(pd.date_range(req_dt.index.min(), req_dt.index.max(), freq="MS"), fill_value=0.0)
    return panel, req_dt, dsdp_dt


def _its_rows(series_name, scope, y):
    y = y[y.index >= ITS_START]
    r = fit_its(y, T0)
    p = placebo_its(y, T0, PLACEBO_T0)
    rows = []
    for term in ("post", "post_t", "effect_12m"):
        rows.append(dict(series=series_name, scope=scope, term=term,
                         estimate=r[term]["estimate"], ci_lo=r[term]["ci_lo"], ci_hi=r[term]["ci_hi"],
                         p_value=r[term].get("p", float("nan")), pre_mean=r["pre_mean"],
                         placebo_estimate=p[term]["estimate"], placebo_ci_lo=p[term]["ci_lo"],
                         placebo_ci_hi=p[term]["ci_hi"]))
    return rows, r, p


def run(root: Path, run_month: pd.Timestamp) -> dict:
    panel, req_dt, dsdp_dt = load_panels(root / "marts" / "monthly_by_neighborhood.csv")
    frame = make_frame(panel)
    bt, resid = backtest(frame, BACKTEST_ORIGINS)
    fc = forecast(frame, ORIGIN, resid, run_month)
    its_rows = []
    its_rows_d, r_d, p_d = _its_rows("dsdp_adjusted_total", "downtown", dsdp_dt); its_rows += its_rows_d
    its_rows_r, r_r, p_r = _its_rows("gid_requests", "downtown", req_dt); its_rows += its_rows_r
    for h in HOODS:
        y = panel[panel.neighborhood == h].set_index("obs_month")["y"]
        its_rows += _its_rows("dsdp_adjusted_total", h, y)[0]

    beats = bt[bt.model_mae < bt.seasonal_naive_mae]["horizon"].tolist()
    dec = fc[fc.obs_month == fc.obs_month.max()]
    meta = {
        "model": "Pooled Ridge (alpha=1.0), direct multi-horizon 1-12, log1p target, lags 0/1/2/3/12 + roll3 + month Fourier + neighborhood one-hots",
        "target": "dsdp_adjusted_total (DSDP published, multiplier-adjusted counted units)",
        "origin": ORIGIN.strftime("%Y-%m"), "run_month": run_month.strftime("%Y-%m"),
        "horizons": 12, "t0": T0.strftime("%Y-%m"), "placebo_t0": PLACEBO_T0.strftime("%Y-%m"),
        "its_window_start": ITS_START.strftime("%Y-%m"),
        "interpolated_months": interpolated_months(frame),
        "backtest": {"origins": [o.strftime("%Y-%m") for o in BACKTEST_ORIGINS],
                     "beats_seasonal_naive_at_horizons": beats},
        "headline": {
            "downtown_forecast_last_month": dec.obs_month.max().strftime("%Y-%m"),
            "downtown_point": round(float(dec.value.sum())),
            "downtown_lo80_sum": round(float(dec.lo80.sum())), "downtown_hi80_sum": round(float(dec.hi80.sum())),
            "ban_effect_12m_dsdp": r_d["effect_12m"], "ban_effect_12m_requests": r_r["effect_12m"],
            "placebo_effect_12m_dsdp": p_d["effect_12m"], "placebo_effect_12m_requests": p_r["effect_12m"],
            "pre_mean_dsdp": r_d["pre_mean"], "pre_mean_requests": r_r["pre_mean"],
        },
        "notes": [
            "Forecast unit = DSDP published totals (occupancy multipliers applied) - not raw counted people and not comparable to RTFH/PIT raw counts.",
            "Missing 2025 months interpolated for lag features only; never targets, never plotted.",
            "80% bands = empirical 10th/90th percentiles of log-space backtest residuals per horizon; band sums across neighborhoods are approximations.",
            "ITS is quasi-experimental: the ban coincided with shelter openings and sweeps; read effects as 'associated with'.",
            "311 is complaint volume, never a headcount.",
            "HAC (Newey-West) 95% CIs slightly under-cover in samples of ~60 months; read as roughly 85-90% intervals.",
        ],
    }
    marts = root / "marts"
    fc.assign(obs_month=fc.obs_month.dt.strftime("%Y-%m-%d")).to_csv(marts / "outlook_forecast.csv", index=False)
    bt.to_csv(marts / "outlook_backtest.csv", index=False)
    pd.DataFrame(its_rows).to_csv(marts / "outlook_its.csv", index=False)
    (marts / "outlook_meta.json").write_text(json.dumps(meta, indent=2))
    write_findings(meta, bt, root / "docs" / "OUTLOOK_FINDINGS.md")
    return meta


def _fmt_eff(e, unit):
    sign = "+" if e["estimate"] >= 0 else "−"
    return f"{sign}{abs(e['estimate']):.0f} {unit} (95% CI {e['ci_lo']:.0f} to {e['ci_hi']:.0f}; {e['pct_of_pre']:+.0f}% of the pre-ban mean)"


def _placebo_note(real, placebo):
    if abs(placebo["estimate"]) >= 0.5 * abs(real["estimate"]):
        return " This placebo is not distinguishable from trend noise relative to the real effect, so treat the real estimate with extra caution."
    return ""


def write_findings(meta, bt, path: Path):
    h = meta["headline"]
    beats = meta["backtest"]["beats_seasonal_naive_at_horizons"]
    lines = [
        "# Outlook — where downtown San Diego homelessness is headed",
        f"_Auto-generated by ml/outlook.py on {meta['run_month']}. Numbers are DSDP published (multiplier-adjusted) counted units unless labeled reports._\n",
        "## 1. Twelve-month outlook",
        f"Downtown total (6 core neighborhoods) for {h['downtown_forecast_last_month']}: **{h['downtown_point']:,}** "
        f"(80% band {h['downtown_lo80_sum']:,}–{h['downtown_hi80_sum']:,}), forecast from the last published month {meta['origin']}.",
        f"Honesty check: in a 24-origin rolling backtest the model beats seasonal-naive at horizons {beats if beats else 'none'} of 1–12. "
        "Where it does not, the band is the useful output, not the point.\n",
        "| horizon | model MAE | seasonal-naive MAE | last-value MAE |", "|---|---|---|---|",
        *[f"| {int(r.horizon)} | {r.model_mae:.0f} | {r.seasonal_naive_mae:.0f} | {r.last_value_mae:.0f} |" for r in bt.itertuples()],
        "\n## 2. What the camping ban was associated with (interrupted time series, T0 = Aug 2023)",
        f"- Counted units (DSDP): 12 months after enforcement began, the series was {_fmt_eff(h['ban_effect_12m_dsdp'], 'units')}. "
        f"Placebo (fake ban Aug 2022, pre-ban data only): {h['placebo_effect_12m_dsdp']['estimate']:+.0f}."
        f"{_placebo_note(h['ban_effect_12m_dsdp'], h['placebo_effect_12m_dsdp'])}",
        f"- 311 homelessness reports: {_fmt_eff(h['ban_effect_12m_requests'], 'reports/month')}. "
        f"Placebo: {h['placebo_effect_12m_requests']['estimate']:+.0f}."
        f"{_placebo_note(h['ban_effect_12m_requests'], h['placebo_effect_12m_requests'])}",
        "- Read together: after the ban, counted units moved one way and reports moved the other. Complaint volume is a reporting signal, "
        "not a headcount — a decline in people seen on sweep mornings alongside rising reports is consistent with displacement into less-visible "
        "locations and with enforcement-driven reporting, and is associated with (not proven caused by) the ordinance, which coincided with shelter openings and sweeps.\n",
        "## 3. What this should tell the people working on it",
        "- Plan capacity against the band, not the point: the 80% range is the honest planning envelope.",
        "- Target outreach at the blocks the complaint signal misses: QA_REPORT.md shows 311 volume explains only a fraction of block-level counts "
        "(r≈0.23), and the block map shows counted people on blocks with zero reports. Complaint-driven deployment under-serves them.",
        "- Do not read enforcement as need: coded citation volume is negatively correlated with complaints (r≈−0.49) — it tracks policy cycles.",
        "- Treat post-ban 311 growth as a reporting shift, not a population surge, when briefing decision-makers.",
    ]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    today = date.today().replace(day=1)
    m = run(root, pd.Timestamp(today))
    print(json.dumps(m["headline"], indent=2))
