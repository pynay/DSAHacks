// Server-only. Real context data from the data commons' hand-verified seeds
// (every row carries a source_url in the seed files):
//   - seeds/pit_annual.csv       -> HUD Point-in-Time counts, San Diego region
//   - seeds/capacity_manual.csv  -> SDHC city shelter roster + occupancy
// Read via DuckDB (quoted CSV fields), cached per server process.
import { DuckDBInstance } from "@duckdb/node-api";
import path from "node:path";

const SEEDS = path.join(process.cwd(), "seeds");

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
}

async function build(): Promise<CommonsStats> {
  const pitCsv = path.join(SEEDS, "pit_annual.csv").replace(/'/g, "''");
  const capCsv = path.join(SEEDS, "capacity_manual.csv").replace(/'/g, "''");

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

  return {
    pit,
    shelters: {
      asOf,
      totalBeds: sites.reduce((s, x) => s + x.beds, 0),
      siteCount: sites.length,
      sites,
      occupancy,
    },
  };
}

let cache: Promise<CommonsStats> | null = null;

export function getCommonsStats(): Promise<CommonsStats> {
  cache ??= build();
  return cache;
}
