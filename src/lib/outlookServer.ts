// Server-only. Serves the DSDP outlook forecast + camping-ban ITS results
// produced by ml/outlook.py from the committed marts (marts/outlook_*.csv,
// marts/outlook_meta.json), alongside recent actual DSDP and 311 history for
// charting. DuckDB reads the CSVs; results are cached for the server's lifetime
// (marts only change on re-run).
import { DuckDBInstance } from "@duckdb/node-api";
import fs from "node:fs";
import path from "node:path";
import { sumBands, beatsNaiveThrough, beatsLastValueFrom } from "./outlookShape";

const MARTS = path.join(process.cwd(), "marts");
const REQUESTS_MONTHS = 36;

// Downtown = the six neighborhoods the model is fit and forecast over.
const DOWNTOWN_HOODS = ["city_center", "columbia", "cortez", "east_village", "gaslamp", "marina"];

export interface MonthPoint {
  month: string; // 'YYYY-MM'
  value: number;
}

export interface ForecastPoint {
  month: string;
  value: number;
  lo: number;
  hi: number;
  kind: "nowcast" | "forecast";
}

export interface BacktestRow {
  horizon: number;
  model_mae: number;
  seasonal_naive_mae: number;
  last_value_mae: number;
}

export interface ItsSeries {
  post: { estimate: number; lo: number; hi: number; pct: number; p: number; placebo: number };
  effect12: { estimate: number; lo: number; hi: number; placebo: number };
  preMean: number;
}

// Subset of ml/outlook.py's outlook_meta.json that the frontend reads directly (the
// index signature keeps the rest of the file, e.g. headline/notes, available too).
export interface OutlookMeta {
  origin: string;
  run_month: string;
  t0: string;
  placebo_t0: string;
  interpolated_months: string[];
  its_window_end_requests?: string;
  its_window_end_dsdp?: string;
  robustness?: { post_by_window_start: Record<string, { estimate: number; p: number }> };
  [key: string]: unknown;
}

export interface OutlookPayload {
  meta: OutlookMeta; // ml/outlook.py's outlook_meta.json, verbatim
  history: MonthPoint[]; // downtown DSDP sum, published months only
  forecast: ForecastPoint[]; // downtown DSDP sum, nowcast + forecast horizon
  requests: MonthPoint[]; // downtown 311 sum, last 36 months (reality check)
  its: Partial<Record<"dsdp_adjusted_total" | "gid_requests", ItsSeries>>;
  backtest: BacktestRow[];
  beatsNaiveThrough: number;
  beatsLastValueFrom: number;
}

async function build(): Promise<OutlookPayload> {
  const byHood = path.join(MARTS, "monthly_by_neighborhood.csv").replace(/'/g, "''");
  const forecastCsv = path.join(MARTS, "outlook_forecast.csv").replace(/'/g, "''");
  const backtestCsv = path.join(MARTS, "outlook_backtest.csv").replace(/'/g, "''");
  const itsCsv = path.join(MARTS, "outlook_its.csv").replace(/'/g, "''");
  const hoodList = DOWNTOWN_HOODS.map((h) => `'${h}'`).join(", ");

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  // Downtown DSDP totals, published months only (HAVING drops months where
  // any of the six neighborhoods is unpublished, so partial-coverage months
  // never masquerade as a full downtown total).
  const histReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, SUM(value) AS value
    FROM read_csv_auto('${byHood}')
    WHERE metric = 'dsdp_adjusted_total' AND source_id = 'H' AND neighborhood IN (${hoodList})
    GROUP BY 1 HAVING COUNT(*) = 6 ORDER BY 1`);
  const history: MonthPoint[] = histReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), value: Math.round(Number(r.value)) }));

  // Downtown 311 totals, last 36 months (reality check against the DSDP series).
  const reqReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, SUM(value) AS value
    FROM read_csv_auto('${byHood}')
    WHERE metric = 'gid_requests' AND neighborhood IN (${hoodList})
    GROUP BY 1 ORDER BY 1 DESC LIMIT ${REQUESTS_MONTHS}`);
  const requests: MonthPoint[] = reqReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), value: Math.round(Number(r.value)) }))
    .reverse();

  // Forecast: sum neighborhood-level point + band per month, keeping the kind
  // (nowcast when the target month is <= run_month, i.e. not yet actually published;
  // forecast thereafter -- see ml/outlook_forecast.py's forecast()) from each month's rows.
  const fcReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, neighborhood, value, lo80 AS lo, hi80 AS hi, kind
    FROM read_csv_auto('${forecastCsv}')
    ORDER BY 1, 2`);
  const fcRows = fcReader.getRowObjects().map((r) => ({
    month: String(r.month),
    value: Number(r.value),
    lo: Number(r.lo),
    hi: Number(r.hi),
    kind: String(r.kind) as "nowcast" | "forecast",
  }));
  const kindByMonth = new Map<string, "nowcast" | "forecast">();
  for (const r of fcRows) if (!kindByMonth.has(r.month)) kindByMonth.set(r.month, r.kind);
  const forecast: ForecastPoint[] = sumBands(fcRows).map((r) => ({
    ...r,
    kind: kindByMonth.get(r.month) ?? "forecast",
  }));

  // ITS: downtown-scope post (immediate level change) and effect_12m
  // (vs. a counterfactual extending the pre-ban trend) per series.
  const itsReader = await conn.runAndReadAll(`
    SELECT series, term, estimate, ci_lo, ci_hi, p_value, pre_mean, placebo_estimate
    FROM read_csv_auto('${itsCsv}')
    WHERE scope = 'downtown' AND term IN ('post', 'effect_12m')`);
  const itsRows = itsReader.getRowObjects();
  const its = {} as OutlookPayload["its"];
  for (const series of ["dsdp_adjusted_total", "gid_requests"] as const) {
    const post = itsRows.find((r) => r.series === series && r.term === "post");
    const eff = itsRows.find((r) => r.series === series && r.term === "effect_12m");
    if (!post || !eff) continue;
    const preMean = Number(post.pre_mean);
    its[series] = {
      post: {
        estimate: Number(post.estimate),
        lo: Number(post.ci_lo),
        hi: Number(post.ci_hi),
        pct: Math.round((100 * Number(post.estimate)) / preMean),
        p: Number(post.p_value),
        placebo: Number(post.placebo_estimate),
      },
      effect12: {
        estimate: Number(eff.estimate),
        lo: Number(eff.ci_lo),
        hi: Number(eff.ci_hi),
        placebo: Number(eff.placebo_estimate),
      },
      preMean,
    };
  }

  const btReader = await conn.runAndReadAll(`
    SELECT horizon, model_mae, seasonal_naive_mae, last_value_mae
    FROM read_csv_auto('${backtestCsv}') ORDER BY horizon`);
  const backtest: BacktestRow[] = btReader.getRowObjects().map((r) => ({
    horizon: Number(r.horizon),
    model_mae: Number(r.model_mae),
    seasonal_naive_mae: Number(r.seasonal_naive_mae),
    last_value_mae: Number(r.last_value_mae),
  }));

  const meta: OutlookMeta = JSON.parse(fs.readFileSync(path.join(MARTS, "outlook_meta.json"), "utf8"));

  return {
    meta,
    history,
    forecast,
    requests,
    its,
    backtest,
    beatsNaiveThrough: beatsNaiveThrough(backtest),
    beatsLastValueFrom: beatsLastValueFrom(backtest),
  };
}

let cache: Promise<OutlookPayload> | null = null;

export function getOutlook(): Promise<OutlookPayload> {
  cache ??= build();
  return cache;
}
