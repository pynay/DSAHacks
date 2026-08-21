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
BACKTEST_ORIGINS = list(pd.date_range("2023-01-01", "2024-12-01", freq="MS"))
# Pre-window robustness sweep for the DSDP downtown ITS post estimate (S2): refit with
# ITS_START swept across these starts and report how much the headline number moves.
ROBUSTNESS_STARTS = [pd.Timestamp(x) for x in
                     ("2020-01-01", "2021-01-01", "2021-07-01", "2022-01-01", "2022-07-01")]


def load_panels(mart_csv: Path, run_month: pd.Timestamp):
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
    # The raw 311 feed ends mid-month, so the current run month is always partial (e.g. a
    # 2026-08 run sees only part of August) -- drop it so the ITS fit never treats a
    # partial month as a real observation.
    req_dt = req_dt[req_dt.index < run_month]
    return panel, req_dt, dsdp_dt


def _derive_origin(dsdp_dt: pd.Series) -> pd.Timestamp:
    """Last month with a published (non-NaN) DSDP value across all 6 neighborhoods."""
    return dsdp_dt.dropna().index.max()


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


def _robustness_sweep(dsdp_dt: pd.Series) -> dict:
    """Refit the DSDP downtown ITS post (level change) estimate with ITS_START swept across
    ROBUSTNESS_STARTS, so the headline number's sensitivity to the pre-window choice is
    reported rather than assumed."""
    out = {}
    for start in ROBUSTNESS_STARTS:
        y = dsdp_dt[dsdp_dt.index >= start]
        r = fit_its(y, T0)
        out[start.strftime("%Y-%m")] = {"estimate": r["post"]["estimate"], "p": r["post"]["p"]}
    return out


def run(root: Path, run_month: pd.Timestamp) -> dict:
    panel, req_dt, dsdp_dt = load_panels(root / "marts" / "monthly_by_neighborhood.csv", run_month)
    origin = _derive_origin(dsdp_dt)
    frame = make_frame(panel)
    bt, resid = backtest(frame, BACKTEST_ORIGINS)
    fc = forecast(frame, origin, resid, run_month)
    its_rows = []
    its_rows_d, r_d, p_d = _its_rows("dsdp_adjusted_total", "downtown", dsdp_dt); its_rows += its_rows_d
    its_rows_r, r_r, p_r = _its_rows("gid_requests", "downtown", req_dt); its_rows += its_rows_r
    for h in HOODS:
        y = panel[panel.neighborhood == h].set_index("obs_month")["y"]
        its_rows += _its_rows("dsdp_adjusted_total", h, y)[0]
    robustness = _robustness_sweep(dsdp_dt)

    beats_sn = bt[bt.model_mae < bt.seasonal_naive_mae]["horizon"].astype(int).tolist()
    beats_lv = bt[bt.model_mae < bt.last_value_mae]["horizon"].astype(int).tolist()
    dec = fc[fc.obs_month == fc.obs_month.max()]
    meta = {
        "model": "Pooled Ridge (alpha=1.0), direct multi-horizon 1-12, log1p target, lags 0/1/2/3/12 + roll3 + month Fourier + neighborhood one-hots",
        "target": "dsdp_adjusted_total (DSDP published, multiplier-adjusted counted units)",
        "origin": origin.strftime("%Y-%m"), "run_month": run_month.strftime("%Y-%m"),
        "horizons": 12, "t0": T0.strftime("%Y-%m"), "placebo_t0": PLACEBO_T0.strftime("%Y-%m"),
        "its_window_start": ITS_START.strftime("%Y-%m"),
        "its_window_end_requests": req_dt.index.max().strftime("%Y-%m"),
        "its_window_end_dsdp": dsdp_dt.dropna().index.max().strftime("%Y-%m"),
        "interpolated_months": interpolated_months(frame),
        "backtest": {"origins": [o.strftime("%Y-%m") for o in BACKTEST_ORIGINS],
                     "beats_seasonal_naive_at_horizons": beats_sn,
                     "beats_last_value_at_horizons": beats_lv},
        "robustness": {"post_by_window_start": robustness},
        "headline": {
            "downtown_forecast_last_month": dec.obs_month.max().strftime("%Y-%m"),
            "downtown_point": round(float(dec.value.sum())),
            "downtown_lo80_sum": round(float(dec.lo80.sum())), "downtown_hi80_sum": round(float(dec.hi80.sum())),
            "ban_level_change_dsdp": r_d["post"], "ban_level_change_requests": r_r["post"],
            "ban_slope_change_dsdp": r_d["post_t"], "ban_slope_change_requests": r_r["post_t"],
            "ban_effect_12m_dsdp": r_d["effect_12m"], "ban_effect_12m_requests": r_r["effect_12m"],
            "placebo_level_change_dsdp": p_d["post"], "placebo_level_change_requests": p_r["post"],
            "placebo_slope_change_dsdp": p_d["post_t"], "placebo_slope_change_requests": p_r["post_t"],
            "placebo_effect_12m_dsdp": p_d["effect_12m"], "placebo_effect_12m_requests": p_r["effect_12m"],
            "pre_mean_dsdp": r_d["pre_mean"], "pre_mean_requests": r_r["pre_mean"],
        },
        "notes": [
            "Forecast unit = DSDP published totals (occupancy multipliers applied) - not raw counted people and not comparable to RTFH/PIT raw counts.",
            "Missing 2025 months interpolated for lag features only; never targets, never plotted.",
            "80% bands = empirical 10th/90th percentiles of log-space backtest residuals per horizon; band sums across neighborhoods are approximations.",
            "ITS is quasi-experimental: the ban coincided with shelter openings and sweeps; read effects as 'associated with'.",
            "311 is complaint volume, never a headcount.",
            "post is the gap between the post-ban segment and the pre-ban trend extrapolated to T0 (a "
            "counterfactual-relative estimate), not an observed month-over-month change; treat it as the "
            "least trend-dependent estimate, since effect_12m compounds 12 more months of an assumed trend.",
            "80% bands are summed across neighborhoods and are therefore wider than a true 80% interval for the downtown total.",
            "HAC 95% CIs read as roughly 85–90% in samples of ~60 months.",
        ],
    }
    marts = root / "marts"
    fc.assign(obs_month=fc.obs_month.dt.strftime("%Y-%m-%d")).to_csv(marts / "outlook_forecast.csv", index=False)
    bt.to_csv(marts / "outlook_backtest.csv", index=False)
    pd.DataFrame(its_rows).to_csv(marts / "outlook_its.csv", index=False)
    (marts / "outlook_meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    write_findings(meta, bt, root / "docs" / "OUTLOOK_FINDINGS.md")
    return meta


def _sig(e):
    return not (e["ci_lo"] <= 0 <= e["ci_hi"])


def _fmt_p(p):
    return "p<0.001" if p < 0.001 else f"p={p:.3f}"


def _continuation_phrase(r, p, with_year=False):
    """Phrase (with its own leading connector) describing what happens after the initial
    (post) jump, derived from the sign relationship between post and post_t: same sign
    means the level keeps moving the same way; opposite sign means it fades back toward
    the pre-existing trend. Gated on the same _slope_comparable predicate _fmt_slope_line
    uses: a same-direction slope only supports a persistence claim ("stayed lower/higher")
    when it is itself distinguishable from placebo noise -- otherwise asserting persistence
    would contradict the slope line right below it."""
    post_e, post_t_e = r["post"]["estimate"], r["post_t"]["estimate"]
    same_dir = (post_e >= 0) == (post_t_e >= 0)
    suffix = " over the following year" if with_year else ""
    if same_dir:
        if _slope_comparable(r["post_t"], p["post_t"]):
            return " (subsequent trend not distinguishable from noise)"
        return f" and stayed {'lower' if post_e < 0 else 'higher'}"
    verb = "eased back toward its prior trend" if post_e < 0 else "decayed toward its prior trend"
    return f", then {verb}{suffix}"


def _placebo_survives_post(e, pe):
    """The immediate level change 'survives' the placebo check unless the placebo moves the
    SAME direction and is a comparable magnitude (>=50% of the real estimate)."""
    if e["estimate"] == 0:
        return True
    same_sign = (e["estimate"] >= 0) == (pe["estimate"] >= 0)
    comparable = abs(pe["estimate"]) >= 0.5 * abs(e["estimate"])
    return not (same_sign and comparable)


def _slope_comparable(e, pe):
    if e["estimate"] == 0:
        return False
    return abs(pe["estimate"]) >= 0.5 * abs(e["estimate"])


def _fmt_horizons(hs):
    """Compress a list of ints into range notation, e.g. [4,5,6,7,9] -> '4-7, 9'."""
    hs = sorted(hs)
    if not hs:
        return "none"
    runs, start, prev = [], hs[0], hs[0]
    for x in hs[1:]:
        if x == prev + 1:
            prev = x
            continue
        runs.append((start, prev)); start = prev = x
    runs.append((start, prev))
    return ", ".join(f"{a}" if a == b else f"{a}-{b}" for a, b in runs)


def _pre_window_span():
    """Human-readable pre-ban window used as the % denominator, e.g. '2021–Jul-2023'."""
    return f"{ITS_START.year}–{(T0 - pd.DateOffset(months=1)).strftime('%b-%Y')}"


def _fmt_placebo_ci(pe):
    sig_note = "" if pe["p"] < 0.05 else " — not significant"
    return f"(95% CI {pe['ci_lo']:.0f} to {pe['ci_hi']:.0f}; {_fmt_p(pe['p'])}{sig_note})"


def _fmt_post_line(subject, unit, r, p):
    e, pe = r["post"], p["post"]
    pct = 100 * e["estimate"] / r["pre_mean"] if r["pre_mean"] else float("nan")
    direction = "lower" if e["estimate"] < 0 else "higher"
    check = "survives the placebo check" if _placebo_survives_post(e, pe) else "is not clearly distinguishable from placebo noise"
    return (f"- {subject}: an estimated {e['estimate']:+.0f} {unit} {direction} than the pre-ban trend "
            f"projected for {T0.strftime('%b %Y')} ({pct:+.0f}% of the {_pre_window_span()} average monthly "
            f"count; 95% CI {e['ci_lo']:.0f} to {e['ci_hi']:.0f}; {_fmt_p(e['p'])}) in the first full "
            f"enforcement month{_continuation_phrase(r, p)}; placebo (fake ban {PLACEBO_T0.strftime('%b %Y')}) "
            f"{pe['estimate']:+.0f} {_fmt_placebo_ci(pe)}, so this {check}.")


def _fmt_slope_line(subject, unit, r, p):
    e, pe = r["post_t"], p["post_t"]
    line = (f"- {subject} slope after the break: {e['estimate']:+.1f} {unit}/month "
            f"(95% CI {e['ci_lo']:.1f} to {e['ci_hi']:.1f}; {_fmt_p(e['p'])}); placebo {pe['estimate']:+.1f}/month "
            f"{_fmt_placebo_ci(pe)}.")
    if _slope_comparable(e, pe):
        line += " This is comparable to the placebo, so the slope component is not distinguishable from trend noise."
    return line


def _fmt_effect12_line(subject, unit, r, p):
    e, pe = r["effect_12m"], p["effect_12m"]
    span = f"{ITS_START.year}–{T0.year % 100:02d}"
    return (f"- {subject}, 12 months out: {e['estimate']:+.0f} {unit} relative to a counterfactual that "
            f"assumes the {span} pre-ban trend continued linearly for 12 more months "
            f"(95% CI {e['ci_lo']:.0f} to {e['ci_hi']:.0f}; placebo {pe['estimate']:+.0f}, "
            f"95% CI {pe['ci_lo']:.0f} to {pe['ci_hi']:.0f}).")


def _fmt_robustness_line(robustness):
    parts = [f"{start} {v['estimate']:+.0f}" for start, v in robustness.items()]
    all_sig = all(v["p"] < 0.001 for v in robustness.values())
    tail = " (all p<0.001)" if all_sig else " (p-values vary by window — see meta.json)"
    return f"Post estimate by pre-window start: {'; '.join(parts)}{tail}."


def _read_together(r_d, p_d, r_r, p_r):
    sig_d, sig_r = _sig(r_d["post"]), _sig(r_r["post"])
    if not (sig_d or sig_r):
        return ("Neither series shows a statistically significant immediate level change at the ban date, so "
                "the data does not support a directional claim about the ordinance's effect; read the 12-month "
                "figures above as illustrative, not evidence of impact.")
    parts = []
    if sig_d:
        pct_d = round(abs(100 * r_d["post"]["estimate"] / r_d["pre_mean"]) / 5) * 5
        rel_d = "below" if r_d["post"]["estimate"] < 0 else "above"
        parts.append(f"Counted units were ~{pct_d}% {rel_d} the pre-ban trend immediately after "
                     f"enforcement began{_continuation_phrase(r_d, p_d)}")
    if sig_r:
        pct_r = round(abs(100 * r_r["post"]["estimate"] / r_r["pre_mean"]) / 5) * 5
        rel_r = "above" if r_r["post"]["estimate"] > 0 else "below"
        parts.append(f"311 reports ran ~{pct_r}% {rel_r} trend immediately after "
                     f"enforcement began{_continuation_phrase(r_r, p_r, with_year=True)}")
    lead = "; ".join(parts) + "."
    fall_word = "fall" if (sig_d and r_d["post"]["estimate"] < 0) else "rise"
    desc_r = "spike" if (sig_r and r_r["post"]["estimate"] > 0) else "drop"
    qualifier = "temporary " if sig_r and (r_r["post"]["estimate"] >= 0) != (r_r["post_t"]["estimate"] >= 0) else ""
    return (f"{lead} A {fall_word} in people seen on sweep mornings alongside a {qualifier}{desc_r} in reports is "
            "consistent with displacement into less-visible locations and with enforcement-driven reporting; "
            "it is associated with — not proven caused by — the ordinance, which coincided with shelter openings and sweeps.")


def _fmt_bullet_311_shift(r_r):
    if not _sig(r_r["post"]):
        return "- 311 report volume did not show a statistically significant immediate shift at the ban date — avoid reading a trend narrative into noise."
    pct_r = round(abs(100 * r_r["post"]["estimate"] / r_r["pre_mean"]) / 5) * 5
    if r_r["post"]["estimate"] <= 0:
        return (f"- 311 reports ran roughly {pct_r}% below the pre-ban trend immediately after enforcement began "
                "— treat this as a reporting-volume shift, not evidence about the underlying population, when briefing decision-makers.")
    fading = (r_r["post"]["estimate"] >= 0) != (r_r["post_t"]["estimate"] >= 0)
    if fading:
        return (f"- 311 reports ran roughly {pct_r}% above the pre-ban trend immediately after enforcement began, then decayed back "
                "toward their prior trend within the following year — treat it as a temporary reporting shift, not a lasting change in the underlying population.")
    return (f"- 311 reports ran roughly {pct_r}% above the pre-ban trend immediately after enforcement began and stayed elevated "
            "— treat this as a reporting-volume shift, not a population count, when briefing decision-makers.")


def write_findings(meta, bt, path: Path):
    h = meta["headline"]
    r_d = {"post": h["ban_level_change_dsdp"], "post_t": h["ban_slope_change_dsdp"],
           "effect_12m": h["ban_effect_12m_dsdp"], "pre_mean": h["pre_mean_dsdp"]}
    p_d = {"post": h["placebo_level_change_dsdp"], "post_t": h["placebo_slope_change_dsdp"],
           "effect_12m": h["placebo_effect_12m_dsdp"]}
    r_r = {"post": h["ban_level_change_requests"], "post_t": h["ban_slope_change_requests"],
           "effect_12m": h["ban_effect_12m_requests"], "pre_mean": h["pre_mean_requests"]}
    p_r = {"post": h["placebo_level_change_requests"], "post_t": h["placebo_slope_change_requests"],
           "effect_12m": h["placebo_effect_12m_requests"]}

    beats_sn = meta["backtest"]["beats_seasonal_naive_at_horizons"]
    beats_lv = meta["backtest"]["beats_last_value_at_horizons"]
    not_lv = [x for x in range(1, 13) if x not in beats_lv]
    honesty = (f"Honesty check: in a 24-origin rolling backtest the model beats seasonal-naive at horizons "
               f"{_fmt_horizons(beats_sn)} of 1-12. Against naive persistence (last published value carried "
               f"forward) it wins at horizons {_fmt_horizons(beats_lv)}"
               + (f"; at shorter horizons ({_fmt_horizons(not_lv)}) it is no better than carrying the last "
                  "published value forward." if not_lv else ".")
               + " Where it does not beat a baseline, the band is the useful output, not the point.\n")

    lines = [
        "# Outlook — where downtown San Diego homelessness is headed",
        f"_Auto-generated by ml/outlook.py on {meta['run_month']}. Numbers are DSDP published (multiplier-adjusted) counted units unless labeled reports._\n",
        "## 1. Twelve-month outlook",
        f"Downtown total (6 core neighborhoods) for {h['downtown_forecast_last_month']}: **{h['downtown_point']:,}** "
        f"(80% band {h['downtown_lo80_sum']:,}–{h['downtown_hi80_sum']:,}), forecast from the last published month {meta['origin']}. "
        "Bands are summed across neighborhoods and are therefore wider than a true 80% interval for the downtown total.",
        honesty,
        "| horizon | model MAE | seasonal-naive MAE | last-value MAE |", "|---|---|---|---|",
        *[f"| {int(r.horizon)} | {r.model_mae:.0f} | {r.seasonal_naive_mae:.0f} | {r.last_value_mae:.0f} |" for r in bt.itertuples()],
        "\n## 2. What the camping ban was associated with (interrupted time series, T0 = Aug 2023)",
        "HAC 95% CIs read as roughly 85–90% in samples of ~60 months.\n",
        "**Immediate level change — the least trend-dependent estimate:**",
        _fmt_post_line("Counted units (DSDP)", "units", r_d, p_d),
        _fmt_post_line("311 reports (GID requests)", "reports/month", r_r, p_r),
        "\n**Slope after the break (per month):**",
        _fmt_slope_line("Counted units (DSDP)", "units", r_d, p_d),
        _fmt_slope_line("311 reports (GID requests)", "reports", r_r, p_r),
        "\n**Twelve months out (`effect_12m`):**",
        _fmt_effect12_line("Counted units (DSDP)", "units", r_d, p_d),
        _fmt_effect12_line("311 reports (GID requests)", "reports/month", r_r, p_r),
        "With a steep pre-ban upswing, this counterfactual is generous; read the immediate level change above as the least trend-dependent effect.\n",
        f"**Read together:** {_read_together(r_d, p_d, r_r, p_r)}\n",
        f"**Robustness:** {_fmt_robustness_line(meta['robustness']['post_by_window_start'])}\n",
        "## 3. What this should tell the people working on it",
        "- Plan capacity against the band, not the point: the 80% range is the honest planning envelope.",
        "- Target outreach at the blocks the complaint signal misses: QA_REPORT.md shows 311 volume explains only a fraction of block-level counts "
        "(r≈0.23), and the block map shows counted people on blocks with zero reports. Complaint-driven deployment under-serves them.",
        "- Do not read enforcement as need: coded citation volume is negatively correlated with complaints (r≈−0.49) — it tracks policy cycles.",
        _fmt_bullet_311_shift(r_r),
    ]
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    today = date.today().replace(day=1)
    m = run(root, pd.Timestamp(today))
    print(json.dumps(m["headline"], indent=2))
