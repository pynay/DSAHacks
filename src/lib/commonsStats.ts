// Server-only. Real context data from the data commons' hand-verified seeds
// (every row carries a source_url in the seed files):
//   - seeds/pit_annual.csv       -> HUD Point-in-Time counts, San Diego region
//   - seeds/capacity_manual.csv  -> SDHC city shelter roster + occupancy
// Read via DuckDB (quoted CSV fields), cached per server process.
import { DuckDBInstance } from "@duckdb/node-api";
import path from "node:path";

const SEEDS = path.join(process.cwd(), "seeds");

function pretty(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface PitYear {
  year: number;
  sheltered: number;
  unsheltered: number;
}

export interface ShelterSite {
  program: string;
  site: string;
  beds: number;
}

export interface OccupancyRow {
  category: string;
  month: string; // 'YYYY-MM'
  pct: number;
}

export interface CommonsStats {
  pit: PitYear[];
  shelters: {
    asOf: string; // 'YYYY-MM' of the roster snapshot
    totalBeds: number;
    siteCount: number;
    sites: ShelterSite[]; // sorted by beds desc
    occupancy: OccupancyRow[]; // latest month per category
  };
  // Downtown-wide monthly DSDP adjusted totals (the challenge's core historical
  // series, 2017-2025). value is null for the provider's true reporting gaps
  // (4 months in 2025) -- never zero-filled.
  dsdp: { month: string; value: number | null }[];
  // Source J: downtown paid-parking sessions per month (an activity proxy, NOT
  // a foot-traffic count), summed across the six neighborhoods, 2021-2026.
  parking: { month: string; sessions: number }[];
  // Source I: USDA FARA food-access rollup for La Jolla, by vintage.
  laJolla: {
    year: number;
    pop: number;
    lowAccess: number;
    lowAccessShare: number;
    lowIncomeLowAccess: number;
    snapHousing: number;
  }[];
  // Downtown-wide monthly 311 homelessness requests (for the indexed comparison).
  requests311: { month: string; value: number }[];
  // Per-neighborhood 311 over the recent window, for the need heatmap.
  heatmap: { months: string[]; rows: { neighborhood: string; label: string; values: number[] }[] };
}

async function build(): Promise<CommonsStats> {
  const pitCsv = path.join(SEEDS, "pit_annual.csv").replace(/'/g, "''");
  const capCsv = path.join(SEEDS, "capacity_manual.csv").replace(/'/g, "''");
  const martCsv = path.join(process.cwd(), "marts", "monthly_by_neighborhood.csv").replace(/'/g, "''");

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  const pitReader = await conn.runAndReadAll(`
    SELECT year, sheltered, unsheltered
    FROM read_csv_auto('${pitCsv}')
    WHERE geography = 'san_diego_region'
    ORDER BY year`);
  const pit: PitYear[] = pitReader.getRowObjects().map((r) => ({
    year: Number(r.year),
    sheltered: Number(r.sheltered),
    unsheltered: Number(r.unsheltered),
  }));

  const sitesReader = await conn.runAndReadAll(`
    SELECT program, site, beds, strftime(obs_month, '%Y-%m') AS month
    FROM read_csv_auto('${capCsv}')
    WHERE record_type = 'site_roster' AND beds IS NOT NULL
    ORDER BY beds DESC`);
  const siteRows = sitesReader.getRowObjects();
  const sites: ShelterSite[] = siteRows.map((r) => ({
    program: String(r.program),
    site: String(r.site),
    beds: Number(r.beds),
  }));
  const asOf = siteRows.length ? String(siteRows[0].month) : "";

  const occReader = await conn.runAndReadAll(`
    SELECT program AS category, strftime(obs_month, '%Y-%m') AS month, occupancy_pct AS pct
    FROM (
      SELECT program, obs_month, occupancy_pct,
             ROW_NUMBER() OVER (PARTITION BY program ORDER BY obs_month DESC) AS rn
      FROM read_csv_auto('${capCsv}')
      WHERE record_type = 'category_occupancy' AND occupancy_pct IS NOT NULL
    ) WHERE rn = 1
    ORDER BY pct DESC`);
  const occupancy: OccupancyRow[] = occReader.getRowObjects().map((r) => ({
    category: String(r.category),
    month: String(r.month),
    pct: Number(r.pct),
  }));

  // Downtown DSDP monthly series: sum the adjusted totals across all six
  // neighborhoods (every reported month carries all six), keep gaps as nulls.
  const dsdpReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, ROUND(SUM(value)) AS value
    FROM read_csv_auto('${martCsv}')
    WHERE metric = 'dsdp_adjusted_total'
    GROUP BY 1 ORDER BY 1`);
  const reported = new Map(
    dsdpReader.getRowObjects().map((r) => [String(r.month), Number(r.value)]),
  );
  const months = [...reported.keys()].sort();
  const dsdp: { month: string; value: number | null }[] = [];
  if (months.length) {
    const [firstY, firstM] = months[0].split("-").map(Number);
    const [lastY, lastM] = months[months.length - 1].split("-").map(Number);
    for (let y = firstY, m = firstM; y < lastY || (y === lastY && m <= lastM); m === 12 ? (y++, m = 1) : m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      dsdp.push({ month: key, value: reported.get(key) ?? null });
    }
  }

  // Source J: downtown paid-parking sessions per month (activity proxy).
  const parkingCsv = path.join(process.cwd(), "marts", "parking_activity_monthly.csv").replace(/'/g, "''");
  const parkReader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, ROUND(SUM(value)) AS sessions
    FROM read_csv_auto('${parkingCsv}')
    WHERE metric = 'paid_sessions'
    GROUP BY 1 ORDER BY 1`);
  const parking = parkReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), sessions: Number(r.sessions) }));

  // Source I: USDA FARA food access, La Jolla rollup by vintage.
  const faCsv = path.join(process.cwd(), "marts", "food_access_la_jolla.csv").replace(/'/g, "''");
  const faReader = await conn.runAndReadAll(`
    SELECT CAST(strftime(obs_month, '%Y') AS INTEGER) AS year,
           MAX(CASE WHEN metric = 'pop_total' THEN value END)                  AS pop,
           MAX(CASE WHEN metric = 'low_access_pop' THEN value END)             AS low_access,
           MAX(CASE WHEN metric = 'low_access_pop_share' THEN value END)       AS low_access_share,
           MAX(CASE WHEN metric = 'low_income_low_access_pop' THEN value END)  AS lila,
           MAX(CASE WHEN metric = 'snap_housing_units' THEN value END)         AS snap
    FROM read_csv_auto('${faCsv}')
    WHERE geography = 'la_jolla'
    GROUP BY 1 ORDER BY 1`);
  const laJolla = faReader.getRowObjects().map((r) => ({
    year: Number(r.year),
    pop: Number(r.pop),
    lowAccess: Number(r.low_access),
    lowAccessShare: Number(r.low_access_share),
    lowIncomeLowAccess: Number(r.lila),
    snapHousing: Number(r.snap),
  }));

  // Downtown-wide monthly 311 (for the indexed multi-signal comparison).
  const req311Reader = await conn.runAndReadAll(`
    SELECT strftime(obs_month, '%Y-%m') AS month, ROUND(SUM(value)) AS value
    FROM read_csv_auto('${martCsv}')
    WHERE metric = 'gid_requests'
    GROUP BY 1 ORDER BY 1`);
  const requests311 = req311Reader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), value: Number(r.value) }));

  // Per-neighborhood 311 over the last 18 months (need heatmap).
  const hmReader = await conn.runAndReadAll(`
    WITH recent AS (
      SELECT DISTINCT strftime(obs_month, '%Y-%m') AS month
      FROM read_csv_auto('${martCsv}') WHERE metric = 'gid_requests'
      ORDER BY 1 DESC LIMIT 18
    )
    SELECT strftime(obs_month, '%Y-%m') AS month, neighborhood, value
    FROM read_csv_auto('${martCsv}')
    WHERE metric = 'gid_requests' AND strftime(obs_month, '%Y-%m') IN (SELECT month FROM recent)`);
  const hmRows = hmReader
    .getRowObjects()
    .map((r) => ({ month: String(r.month), nb: String(r.neighborhood), v: Number(r.value) }));
  const hmMonths = [...new Set(hmRows.map((r) => r.month))].sort();
  const hmByNb = new Map<string, Map<string, number>>();
  for (const r of hmRows) {
    if (!hmByNb.has(r.nb)) hmByNb.set(r.nb, new Map());
    hmByNb.get(r.nb)!.set(r.month, r.v);
  }
  const heatmapRows = [...hmByNb.keys()]
    .map((nb) => ({
      neighborhood: nb,
      label: pretty(nb),
      values: hmMonths.map((m) => hmByNb.get(nb)?.get(m) ?? 0),
    }))
    .sort((a, b) => b.values.reduce((s, x) => s + x, 0) - a.values.reduce((s, x) => s + x, 0));

  return {
    pit,
    shelters: {
      asOf,
      totalBeds: sites.reduce((s, x) => s + x.beds, 0),
      siteCount: sites.length,
      sites,
      occupancy,
    },
    dsdp,
    parking,
    laJolla,
    requests311,
    heatmap: { months: hmMonths, rows: heatmapRows },
  };
}

let cache: Promise<CommonsStats> | null = null;

export function getCommonsStats(): Promise<CommonsStats> {
  cache ??= build();
  return cache;
}
