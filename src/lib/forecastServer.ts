// Server-only. Serves the ML forecast produced by ml/forecast.py from the
// committed marts (marts/forecast_monthly.csv + marts/forecast_meta.json),
// alongside recent actual 311 history for charting. DuckDB reads the CSVs;
// results are cached for the server's lifetime (marts only change on re-run).
import { DuckDBInstance } from "@duckdb/node-api";
import fs from "node:fs";
import path from "node:path";

const MARTS = path.join(process.cwd(), "marts");
const HISTORY_MONTHS = 24;

export interface MonthPoint {
  month: string; // 'YYYY-MM'
  value: number;
}

export interface HoodForecast {
  id: string; // neighborhood key, matches zone ids
  label: string;
  lastActual: number; // most recent observed monthly 311 volume
  nextPredicted: number; // first forecast month
  share: number; // nextPredicted / sum(nextPredicted) across hoods
}

export interface ForecastPayload {
  meta: unknown; // ml/forecast.py's forecast_meta.json, verbatim
  total: { history: MonthPoint[]; forecast: MonthPoint[] }; // downtown-wide sums
  hoods: HoodForecast[];
}

function pretty(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function build(): Promise<ForecastPayload> {
  const history = path.join(MARTS, "monthly_by_neighborhood.csv").replace(/'/g, "''");
  const forecast = path.join(MARTS, "forecast_monthly.csv").replace(/'/g, "''");

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  // Downtown-wide monthly totals: recent actuals, then the forecast horizon.
  const histReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, SUM(value) AS value
    FROM read_csv_auto('${history}')
    WHERE metric = 'gid_requests'
    GROUP BY 1 ORDER BY 1 DESC LIMIT ${HISTORY_MONTHS}`);
  const totalHistory = histReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), value: Number(r.value) }))
    .reverse();

  const fcReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, neighborhood, value
    FROM read_csv_auto('${forecast}')
    ORDER BY obs_month, neighborhood`);
  const fcRows = fcReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), neighborhood: String(r.neighborhood), value: Number(r.value) }));

  const totalForecastMap = new Map<string, number>();
  for (const r of fcRows) totalForecastMap.set(r.month, (totalForecastMap.get(r.month) ?? 0) + r.value);
  const totalForecast = [...totalForecastMap.entries()]
    .map(([month, value]) => ({ month, value: Math.round(value) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Per-hood: last actual vs first predicted month.
  const lastReader = await conn.runAndReadAll(`
    SELECT neighborhood, value FROM (
      SELECT neighborhood, value,
             ROW_NUMBER() OVER (PARTITION BY neighborhood ORDER BY obs_month DESC) AS rn
      FROM read_csv_auto('${history}')
      WHERE metric = 'gid_requests'
    ) WHERE rn = 1`);
  const lastActual = new Map(
    lastReader.getRowObjects().map((r) => [String(r.neighborhood), Number(r.value)]),
  );

  const firstMonth = totalForecast[0]?.month;
  const next = fcRows.filter((r) => r.month === firstMonth);
  const nextSum = next.reduce((s, r) => s + r.value, 0);
  const hoods: HoodForecast[] = next
    .map((r) => ({
      id: r.neighborhood,
      label: pretty(r.neighborhood),
      lastActual: lastActual.get(r.neighborhood) ?? 0,
      nextPredicted: Math.round(r.value),
      share: nextSum > 0 ? r.value / nextSum : 0,
    }))
    .sort((a, b) => b.nextPredicted - a.nextPredicted);

  const meta = JSON.parse(fs.readFileSync(path.join(MARTS, "forecast_meta.json"), "utf8"));
  return { meta, total: { history: totalHistory, forecast: totalForecast }, hoods };
}

let cache: Promise<ForecastPayload> | null = null;

export function getForecast(): Promise<ForecastPayload> {
  cache ??= build();
  return cache;
}
