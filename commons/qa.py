import datetime as dt

import pandas as pd

from commons.config import ROOT
from commons.registry import LoadResult


def pearson(df: pd.DataFrame, xcol: str, ycol: str):
    d = df[[xcol, ycol]].dropna()
    if len(d) < 2:
        return float("nan"), len(d)
    return float(d[xcol].corr(d[ycol])), len(d)


def _has(con, t):
    return con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name=?", [t]).fetchone()[0] > 0


def _corr_311_vs_dsdp(con):
    """(i) monthly downtown 311 volume vs observed/reported downtown totals, overlapping months."""
    if not (_has(con, "stg_gid_requests") and (_has(con, "stg_a_neighborhood_totals")
                                                or _has(con, "stg_dsdp_monthly") or _has(con, "stg_h_monthly"))):
        return None
    obs_parts = []
    if _has(con, "stg_a_neighborhood_totals"):
        obs_parts.append("SELECT obs_month, sum(total) t FROM stg_a_neighborhood_totals GROUP BY 1")
    if _has(con, "stg_dsdp_monthly"):
        obs_parts.append("SELECT obs_month, sum(total) t FROM stg_dsdp_monthly GROUP BY 1")
    if _has(con, "stg_h_monthly"):
        obs_parts.append("SELECT obs_month, sum(value) t FROM stg_h_monthly "
                          "WHERE component='total' AND neighborhood IS NOT NULL GROUP BY 1")
    df = con.execute(f"""
      WITH obs AS (SELECT obs_month, max(t) t FROM ({' UNION ALL '.join(obs_parts)}) GROUP BY 1),
      gid AS (SELECT obs_month, count(*) g FROM stg_gid_requests
              WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate GROUP BY 1)
      SELECT obs.t, gid.g FROM obs JOIN gid USING (obs_month)""").fetch_df()
    return pearson(df, "t", "g")


def _corr_311_vs_blocks(con):
    """(ii) block-month grain: 311 vs 2014-18 counted units. By design: no time overlap
    (stg_a_observations ends 2018-02; 311 homelessness categories begin 2018-08) - ruling R13."""
    if not (_has(con, "stg_gid_requests") and _has(con, "stg_a_observations")):
        return None
    df = con.execute("""
      WITH a AS (SELECT obs_month, geo_block, count(*) units FROM stg_a_observations GROUP BY 1,2),
      g AS (SELECT obs_month, geo_block, count(*) reqs FROM stg_gid_requests
            WHERE geo_block IS NOT NULL AND NOT is_child_duplicate GROUP BY 1,2)
      SELECT units, reqs FROM a JOIN g USING (obs_month, geo_block)""").fetch_df()
    return pearson(df, "units", "reqs")


def _corr_311_vs_h_blocks(con):
    """(ii-b) census-block-month grain: 311 vs Source H digitized block-level units."""
    if not (_has(con, "stg_gid_requests") and _has(con, "stg_h_blocklevel") and _has(con, "dim_h_blockgrid")):
        return None
    df = con.execute("""
      WITH h AS (
        SELECT b.obs_month, g.geo_block,
               sum(coalesce(b.individuals,0)+coalesce(b.tents_structures,0)+coalesce(b.vehicles,0)) units
        FROM stg_h_blocklevel b JOIN dim_h_blockgrid g USING (block_id)
        WHERE g.geo_block IS NOT NULL GROUP BY 1,2),
      g311 AS (
        SELECT obs_month, geo_block, count(*) reqs FROM stg_gid_requests
        WHERE geo_block IS NOT NULL AND NOT is_child_duplicate GROUP BY 1,2)
      SELECT h.units, g311.reqs FROM h JOIN g311 USING (obs_month, geo_block)""").fetch_df()
    return pearson(df, "units", "reqs")


def _corr_citations(con):
    """(iii) monthly selected-citation volume vs downtown observed AND vs 311."""
    out = {}
    if _has(con, "stg_citations"):
        cit = "SELECT obs_month, count(*) c FROM stg_citations GROUP BY 1"
        if _has(con, "stg_a_monthly_totals"):
            df = con.execute(f"""SELECT t.total, c.c FROM stg_a_monthly_totals t
                JOIN ({cit}) c USING (obs_month)""").fetch_df()
            out["citations_vs_downtown_observed"] = pearson(df, "total", "c")
        if _has(con, "stg_gid_requests"):
            df = con.execute(f"""
              WITH g AS (SELECT obs_month, count(*) g FROM stg_gid_requests
                         WHERE NOT is_child_duplicate GROUP BY 1)
              SELECT g.g, c.c FROM g JOIN ({cit}) c USING (obs_month)""").fetch_df()
            out["citations_vs_311"] = pearson(df, "g", "c")
    return out


def _fmt(name, res, interp):
    if res is None:
        return f"- **{name}**: insufficient overlapping data (a source failed or has no overlap).\n"
    r, n = res
    if n < 3 or r != r:
        return f"- **{name}**: insufficient overlapping data (n={n}).\n"
    return f"- **{name}**: r = {r:.3f} (n={n} pairs). {interp(r)}\n"


def write_qa_report(con, results, path=ROOT / "QA_REPORT.md") -> LoadResult:
    L = [f"# QA Report - generated {dt.datetime.now():%Y-%m-%d %H:%M}\n", "## Run summary\n",
         "| step | status | rows | note |", "|---|---|---|---|"]
    for name, r in results.items():
        L.append(f"| {name} | {r.status} | {r.rows} | {((r.note or '').splitlines() or [''])[0][:120]} |")

    # Source load state: read from meta_sources, not the in-memory results dict, so that
    # a refresh.py run (which only touches C/D) still reports the persisted status of
    # every other source (e.g. B/E stubbed) rather than omitting them entirely.
    src_rows = con.execute("""SELECT source_id, load_status, rows_loaded, load_note, loaded_at
                               FROM meta_sources ORDER BY source_id""").fetchall()
    L.append("\n## Source load state\n")
    L.append("| source_id | load_status | rows_loaded | loaded_at | note |")
    L.append("|---|---|---|---|---|")
    for sid, status, rows, note, loaded_at in src_rows:
        L.append(f"| {sid} | {status or 'never run'} | {rows if rows is not None else ''} | "
                 f"{loaded_at or ''} | {((note or '').splitlines() or [''])[0][:120]} |")

    gap_lines = [f"- `{sid}`: {status} - {((note or '').splitlines() or [''])[0][:200]}"
                 for sid, status, rows, note, loaded_at in src_rows if status in ("failed", "stubbed", "partial")]
    gap_lines += [f"- `{n}`: {r.status} - {((r.note or '').splitlines() or [''])[0][:200]}"
                  for n, r in results.items() if r.status in ("failed", "stubbed", "partial")]
    L.append("\n## Source gaps\n")
    L.append("None - all steps ok.\n" if not gap_lines else "\n".join(gap_lines) + "\n")

    L.append("## Table inventory\n\n| table | rows | min date | max date |\n|---|---|---|---|")
    for (t,) in con.execute("""SELECT table_name FROM information_schema.tables
                               WHERE table_name LIKE 'stg%' OR table_name LIKE 'mart%' OR table_name LIKE 'dim%'
                               ORDER BY 1""").fetchall():
        datecol = next((c for c, in con.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=? AND column_name IN ('obs_month','obs_date','requested_date','issue_date','event_date') ORDER BY 1 LIMIT 1",
            [t]).fetchall()), None)
        n = con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        if datecol:
            lo, hi = con.execute(f"SELECT min({datecol}), max({datecol}) FROM {t}").fetchone()
        else:
            lo = hi = ""
        L.append(f"| {t} | {n} | {lo} | {hi} |")

    L.append("\n## Data quality\n")
    if _has(con, "stg_gid_requests"):
        q = con.execute("""SELECT count(*) n,
              round(100.0*sum(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END)/count(*),1) pct_no_coords,
              round(100.0*sum(CASE WHEN is_child_duplicate THEN 1 ELSE 0 END)/count(*),1) pct_child_dupes,
              round(100.0*count(geo_block)/count(*),2) pct_downtown_block
              FROM stg_gid_requests""").fetch_df().iloc[0]
        L.append(f"- 311: {int(q.n)} rows; {q.pct_no_coords}% missing coords (geocode failures); "
                 f"{q.pct_child_dupes}% flagged child duplicates (excluded from marts); "
                 f"{q.pct_downtown_block}% fall in downtown blocks (rest are citywide - expected).")
    if _has(con, "stg_citations"):
        L.append("- Citations: source has no coordinates; geo columns intentionally NULL (citywide analysis only).")
    if _has(con, "stg_a_observations"):
        imp = con.execute("SELECT count(*) FROM stg_a_observations WHERE is_imputed").fetchone()[0]
        L.append(f"- Source A: {imp} rows from imputed months (flagged is_imputed).")
    if _has(con, "stg_h_monthly"):
        nr = con.execute("SELECT count(*) FROM stg_h_monthly WHERE flag='not_reported'").fetchone()[0]
        nr_2025 = con.execute(
            "SELECT count(DISTINCT obs_month) FROM stg_h_monthly WHERE flag='not_reported' AND obs_month >= '2025-01-01'"
        ).fetchone()[0]
        L.append(f"- Source H: {nr} not_reported rows (incl. {nr_2025} unpublished 2025 months); "
                 f"individual/tent/vehicle components are digitized from map images (secondary reliability vs the published total).")

    L.append("\n## Validation Correlations: do independent signals agree?\n")
    L.append(_fmt("(i) 311 downtown volume vs observed downtown totals - A/DSDP/H (monthly)", _corr_311_vs_dsdp(con),
        lambda r: "Complaints track observed street population direction" + (" strongly" if r > .6 else " only loosely" if r > .3 else " weakly - complaint volume is NOT a proxy for people") + ". Correlation of volumes, not a people count. Where H anchors the series, note H totals are occupancy-multiplier-adjusted volumes, not raw counted units. Observed series merges source A (stg_a_neighborhood_totals) and source H per month via max(); both are DSDP-published, multiplier-adjusted totals from 2017-04 onward and are basis-consistent with each other in that window (pre-2017 source A months are pre-methodology-change published figures), so r is an apples-to-apples comparison of published totals throughout."))
    L.append(_fmt("(ii) 311 vs Source A counted units at block-month grain (2016-2018 overlap; note: stg_a_observations ends 2018-02 and 311 homelessness categories begin 2018-08 - by design the two series do not overlap in time)",
        _corr_311_vs_blocks(con),
        lambda r: "Block-level agreement is " + ("strong" if r > .6 else "moderate" if r > .3 else "weak") + " - fine-grained complaint data locates hotspots" + ("" if r > .3 else " poorly") + "."))
    L.append(_fmt("(ii-b) 311 vs DSDP block-level units at census-block-month grain (2019-2025)", _corr_311_vs_h_blocks(con),
        lambda r: "Block-level agreement is " + ("strong" if r > .6 else "moderate" if r > .3 else "weak") + " - fine-grained complaint data locates hotspots" + ("" if r > .3 else " poorly") + ". These are raw counted units (component sums), not multiplier-adjusted."))
    for name, res in _corr_citations(con).items():
        note = ""
        if name == "citations_vs_downtown_observed":
            note = ("Note: the observed series here (stg_a_monthly_totals) switches basis at 2017-04 - "
                     "pre-2017-04 months are raw counted units, 2017-04 onward is DSDP-published, "
                     "occupancy-multiplier-adjusted (methodology change). ")
        L.append(_fmt(f"(iii) {name} (monthly, citations are citywide)", res,
            lambda r, note=note: note
            + ("Note the NEGATIVE correlation: citation volume moves opposite to this series over the overlap window. " if r < 0 else "")
            + "Enforcement volume reflects policy/patrol priorities as much as street population; treat as pressure signal, not headcount."))
    path.write_text("\n".join(L))
    return LoadResult("ok", 0, str(path))
