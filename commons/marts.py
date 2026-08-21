import json

import pandas as pd
from shapely import from_wkt
from shapely.geometry import mapping

from commons.config import MARTS_DIR as _MARTS_DIR
from commons.registry import LoadResult, register_table

MARTS_DIR = _MARTS_DIR

for t, g in [("mart_monthly_neighborhood", "month x downtown neighborhood x metric"),
             ("mart_monthly_block", "month x census block x metric"),
             ("mart_daily_downtown", "day x downtown neighborhood x metric"),
             ("mart_monthly_context", "month x geography x metric")]:
    register_table(t, grain=g, signal_type="mixed (tagged per row)", source_id="A",
        measures="Unified long-format signal mart; see signal_type+metric per row and the staging table docs for each source.",
        known_bias="Inherits each source's bias - JOIN meta_sources via source_id. Complaint/enforcement metrics are activity volumes, never people counts.",
        refresh="rebuilt every run")


def _has(con, table):
    return con.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_name=?", [table]
    ).fetchone()[0] > 0


def build(con) -> LoadResult:
    # Every branch below carries explicit column aliases matching its target mart's
    # schema (R2) - not just the first one - because the _has guards mean any branch
    # may end up first depending on which staging tables exist.
    parts_n, parts_b, parts_d, parts_c = [], [], [], []

    if _has(con, "stg_a_observations"):
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'observation' AS signal_type,
                 'observed_' || CASE entity_type WHEN 'individual' THEN 'individuals'
                    WHEN 'structure' THEN 'structures' ELSE 'vehicles' END AS metric,
                 count(*)::DOUBLE AS value, bool_or(is_imputed) AS is_imputed, 'A' AS source_id
          FROM stg_a_observations GROUP BY 1,2,4""")
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'observation' AS signal_type,
                 'observed_total_units' AS metric, count(*)::DOUBLE AS value,
                 bool_or(is_imputed) AS is_imputed, 'A' AS source_id
          FROM stg_a_observations GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month AS obs_month, geo_block AS geo_block, any_value(neighborhood) AS neighborhood,
                 'observation' AS signal_type, 'observed_total_units' AS metric, count(*)::DOUBLE AS value,
                 bool_or(is_imputed) AS is_imputed, 'A' AS source_id
          FROM stg_a_observations GROUP BY 1,2""")
    if _has(con, "stg_a_neighborhood_totals"):
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'observation' AS signal_type,
                 'dsdp_reported_total' AS metric, total::DOUBLE AS value, false AS is_imputed, 'A' AS source_id
          FROM stg_a_neighborhood_totals""")
    if _has(con, "stg_dsdp_monthly"):
        parts_n.append("""
          SELECT obs_month AS obs_month, coalesce(neighborhood, '_downtown_all') AS neighborhood,
                 'observation' AS signal_type, 'dsdp_reported_total' AS metric, total::DOUBLE AS value,
                 false AS is_imputed, 'B' AS source_id
          FROM stg_dsdp_monthly""")
    if _has(con, "stg_h_monthly"):
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'observation' AS signal_type,
                 'dsdp_adjusted_total' AS metric, value::DOUBLE AS value, false AS is_imputed, 'H' AS source_id
          FROM stg_h_monthly WHERE component='total' AND neighborhood IS NOT NULL AND value IS NOT NULL""")
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'observation' AS signal_type,
                 'dsdp_' || CASE component WHEN 'individual' THEN 'individuals'
                    WHEN 'tent' THEN 'tents' ELSE 'vehicles' END AS metric,
                 value::DOUBLE AS value, false AS is_imputed, 'H' AS source_id
          FROM stg_h_monthly WHERE component IN ('individual','tent','vehicle')
            AND neighborhood IS NOT NULL AND value IS NOT NULL""")
    if _has(con, "stg_h_blocklevel") and _has(con, "dim_h_blockgrid"):
        parts_b.append("""
          SELECT b.obs_month AS obs_month, g.geo_block AS geo_block, any_value(g.neighborhood) AS neighborhood,
                 'observation' AS signal_type, 'dsdp_units_total' AS metric,
                 sum(coalesce(b.individuals,0) + coalesce(b.tents_structures,0) + coalesce(b.vehicles,0))::DOUBLE AS value,
                 false AS is_imputed, 'H' AS source_id
          FROM stg_h_blocklevel b JOIN dim_h_blockgrid g USING (block_id)
          WHERE g.geo_block IS NOT NULL
          GROUP BY 1, 2""")
    if _has(con, "stg_gid_requests"):
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'complaint' AS signal_type,
                 'gid_requests' AS metric, count(*)::DOUBLE AS value, false AS is_imputed, 'C' AS source_id
          FROM stg_gid_requests WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month AS obs_month, geo_block AS geo_block, any_value(neighborhood) AS neighborhood,
                 'complaint' AS signal_type, 'gid_requests' AS metric, count(*)::DOUBLE AS value,
                 false AS is_imputed, 'C' AS source_id
          FROM stg_gid_requests WHERE geo_block IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
        parts_d.append("""
          SELECT requested_date AS obs_date, neighborhood AS neighborhood, 'complaint' AS signal_type,
                 'gid_requests' AS metric, count(*)::DOUBLE AS value, 'C' AS source_id
          FROM stg_gid_requests WHERE neighborhood IS NOT NULL AND NOT is_child_duplicate
          GROUP BY 1,2""")
    if _has(con, "stg_violations_72hr"):
        parts_n.append("""
          SELECT obs_month AS obs_month, neighborhood AS neighborhood, 'enforcement' AS signal_type,
                 'violations_72hr_reports' AS metric, count(*)::DOUBLE AS value, false AS is_imputed, 'D' AS source_id
          FROM stg_violations_72hr WHERE neighborhood IS NOT NULL GROUP BY 1,2""")
        parts_b.append("""
          SELECT obs_month AS obs_month, geo_block AS geo_block, any_value(neighborhood) AS neighborhood,
                 'enforcement' AS signal_type, 'violations_72hr_reports' AS metric, count(*)::DOUBLE AS value,
                 false AS is_imputed, 'D' AS source_id
          FROM stg_violations_72hr WHERE geo_block IS NOT NULL GROUP BY 1,2""")
        parts_d.append("""
          SELECT requested_date AS obs_date, neighborhood AS neighborhood, 'enforcement' AS signal_type,
                 'violations_72hr_reports' AS metric, count(*)::DOUBLE AS value, 'D' AS source_id
          FROM stg_violations_72hr WHERE neighborhood IS NOT NULL GROUP BY 1,2""")
    if _has(con, "stg_citations"):
        parts_c.append("""
          SELECT obs_month AS obs_month, 'san_diego_city' AS geography, 'enforcement' AS signal_type,
                 'citations_' || code_category AS metric, count(*)::DOUBLE AS value, 'D' AS source_id
          FROM stg_citations GROUP BY 1,4""")
    if _has(con, "stg_capacity_monthly"):
        parts_c.append("""
          SELECT obs_month AS obs_month, 'san_diego_city' AS geography, 'capacity' AS signal_type,
                 'shelter_beds' AS metric, sum(beds)::DOUBLE AS value, 'E' AS source_id
          FROM stg_capacity_monthly WHERE record_type='site_roster' GROUP BY 1""")
        parts_c.append("""
          SELECT obs_month AS obs_month, 'san_diego_city' AS geography, 'capacity' AS signal_type,
                 'shelter_occupancy_pct' AS metric, avg(occupancy_pct) AS value, 'E' AS source_id
          FROM stg_capacity_monthly WHERE record_type='category_occupancy' GROUP BY 1""")
    if _has(con, "stg_pit_annual"):
        parts_c.append("""
          SELECT make_date(year, 1, 1) AS obs_month, geography AS geography, 'observation' AS signal_type,
                 'pit_' || k AS metric, v::DOUBLE AS value, 'F' AS source_id
          FROM stg_pit_annual, LATERAL (VALUES ('sheltered', sheltered), ('unsheltered', unsheltered)) t(k, v)""")
    if _has(con, "stg_weather_daily"):
        parts_c.append("""
          SELECT date_trunc('month', obs_date)::DATE AS obs_month, 'san_diego_city' AS geography,
                 'context' AS signal_type, 'tmax_c_avg' AS metric, avg(tmax_c) AS value, 'G_weather' AS source_id
          FROM stg_weather_daily GROUP BY 1""")
        parts_c.append("""
          SELECT date_trunc('month', obs_date)::DATE AS obs_month, 'san_diego_city' AS geography,
                 'context' AS signal_type, 'prcp_mm_total' AS metric, sum(prcp_mm) AS value, 'G_weather' AS source_id
          FROM stg_weather_daily GROUP BY 1""")
        parts_d.append("""
          SELECT obs_date AS obs_date, NULL AS neighborhood, 'context' AS signal_type,
                 'tmax_c' AS metric, tmax_c AS value, 'G_weather' AS source_id
          FROM stg_weather_daily""")
        parts_d.append("""
          SELECT obs_date AS obs_date, NULL AS neighborhood, 'context' AS signal_type,
                 'prcp_mm' AS metric, prcp_mm AS value, 'G_weather' AS source_id
          FROM stg_weather_daily""")
    if _has(con, "stg_zori_monthly"):
        parts_c.append("""
          SELECT obs_month AS obs_month, 'zip_' || zip AS geography, 'context' AS signal_type,
                 'zori' AS metric, zori AS value, 'G_zori' AS source_id
          FROM stg_zori_monthly""")
    if _has(con, "stg_i_food_access"):
        parts_c.append("""
          SELECT make_date(vintage_year, 1, 1) AS obs_month, geography AS geography,
                 'food_access' AS signal_type, metric AS metric, value::DOUBLE AS value, 'I' AS source_id
          FROM stg_i_food_access""")

    def _make(table, cols, parts):
        if parts:
            con.execute(f"CREATE OR REPLACE TABLE {table} AS " + " UNION ALL ".join(f"({p})" for p in parts))
        else:
            con.execute(f"CREATE OR REPLACE TABLE {table} ({cols})")

    _make("mart_monthly_neighborhood",
          "obs_month DATE, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, is_imputed BOOLEAN, source_id TEXT",
          parts_n)
    _make("mart_monthly_block",
          "obs_month DATE, geo_block TEXT, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, is_imputed BOOLEAN, source_id TEXT",
          parts_b)
    _make("mart_daily_downtown",
          "obs_date DATE, neighborhood TEXT, signal_type TEXT, metric TEXT, value DOUBLE, source_id TEXT",
          parts_d)
    _make("mart_monthly_context",
          "obs_month DATE, geography TEXT, signal_type TEXT, metric TEXT, value DOUBLE, source_id TEXT",
          parts_c)
    n = sum(con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ["mart_monthly_neighborhood", "mart_monthly_block",
                      "mart_daily_downtown", "mart_monthly_context"])
    return LoadResult("ok", n, "")


def export(con) -> LoadResult:
    MARTS_DIR.mkdir(exist_ok=True)
    con.execute(f"COPY (SELECT * FROM mart_monthly_neighborhood ORDER BY obs_month, neighborhood, metric) TO '{MARTS_DIR}/monthly_by_neighborhood.csv' (HEADER)")
    con.execute(f"COPY (SELECT * FROM mart_monthly_block ORDER BY obs_month, geo_block, metric) TO '{MARTS_DIR}/monthly_by_block.csv' (HEADER)")
    con.execute(f"COPY (SELECT * FROM mart_daily_downtown ORDER BY obs_date, neighborhood, metric) TO '{MARTS_DIR}/daily_downtown.csv' (HEADER)")
    con.execute(f"COPY (SELECT * FROM mart_monthly_context WHERE source_id='I' ORDER BY obs_month, geography, metric) TO '{MARTS_DIR}/food_access_la_jolla.csv' (HEADER)")
    blocks = con.execute("SELECT geo_block, block_name, neighborhood, zip, geometry_wkt FROM dim_blocks").fetch_df()
    features = [{"type": "Feature",
                 "properties": {k: (None if pd.isna(v) else v) for k, v in row.items() if k != "geometry_wkt"},
                 "geometry": mapping(from_wkt(row["geometry_wkt"]))}
                for row in blocks.to_dict("records")]
    (MARTS_DIR / "blocks.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    return LoadResult("ok", len(features), "5 files exported")
