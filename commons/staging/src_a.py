import pandas as pd
import h3

from commons import fetch
from commons.config import SRC_A_FILES, DOWNTOWN_ZIP
from commons.registry import LoadResult, register_table

register_table("stg_a_observations", grain="one row per counted entity (person/structure/vehicle) per count date",
    signal_type="observation", source_id="A", refresh="static archive",
    measures="Each row is one unit physically counted downtown on the count date.",
    known_bias="Raw counted units; NO occupancy multipliers applied (a structure = 1, not est. occupants). Imputed months flagged is_imputed.")
register_table("stg_a_monthly_totals", grain="month", signal_type="observation", source_id="A", refresh="static archive",
    measures="Downtown total counted units per month, 2012-2019.",
    known_bias="Pre-2014 rows lack point detail; single-count-per-month.")
register_table("stg_a_neighborhood_totals", grain="month x neighborhood", signal_type="observation", source_id="A", refresh="static archive",
    measures="Counted units per downtown neighborhood per month (2018-2019 DSDP-era).",
    known_bias="Overlaps DSDP reporting era; may not match sum of point data months.")
register_table("dim_blocks", grain="2010 census block", signal_type="context", source_id="A", refresh="static archive",
    measures="Downtown block polygons (WKT) with derived neighborhood.",
    known_bias="neighborhood derived as modal neighborhood of source-A observations per block; blocks with no observations have NULL neighborhood.")


def _points(path, is_imputed_file):
    df = pd.read_csv(path)
    df["obs_date"] = pd.to_datetime(df["date"]).dt.date
    df["obs_month"] = pd.to_datetime(df["date"]).dt.to_period("M").dt.to_timestamp().dt.date
    # geometry is 'POINT (lon lat)'
    coords = df["geometry"].str.extract(r"POINT \(([-\d.]+) ([-\d.]+)\)").astype(float)
    df["lon"], df["lat"] = coords[0], coords[1]
    df["h3_r8"] = [h3.latlng_to_cell(la, lo, 8) for la, lo in zip(df["lat"], df["lon"])]
    df = df.rename(columns={"type": "entity_type", "geoid": "geo_block"})
    df["zip"] = DOWNTOWN_ZIP
    df["source_file"] = path.name
    return df[["obs_date", "obs_month", "neighborhood", "entity_type", "geo_block",
               "lon", "lat", "h3_r8", "zip", "source_file"]]


def load(con) -> LoadResult:
    paths, statuses = {}, []
    for rel, url in SRC_A_FILES.items():
        r = fetch.fetch(url, rel)
        statuses.append(r.status)
        if r.status == "failed":
            return LoadResult("failed", 0, f"unreachable: {url}")
        paths[rel.split("/")[-1]] = r.path

    base = _points(paths["homeless_counts.csv"], False)
    imputed_all = _points(paths["imputed_counts.csv"], True)
    # imputed file = full series with gaps filled; keep only months absent from base
    base_months = set(base["obs_month"].unique())
    imputed_only = imputed_all[~imputed_all["obs_month"].isin(base_months)].copy()
    base["is_imputed"] = False
    imputed_only["is_imputed"] = True
    obs = pd.concat([base, imputed_only], ignore_index=True)

    mt = pd.read_csv(paths["monthly_totals.csv"])
    mt["obs_month"] = pd.to_datetime(mt["date"]).dt.date
    mt = mt.rename(columns={"count": "total"})[["obs_month", "total"]]

    nt = pd.read_csv(paths["neighborhood_totals.csv"])
    nt["obs_month"] = pd.to_datetime(nt["date"]).dt.date
    nt = nt.drop(columns=["date"]).melt(id_vars="obs_month", var_name="neighborhood", value_name="total")

    blocks = pd.read_csv(paths["downtown_blocks.csv"], dtype={"geoid10": str})
    hood = (obs.groupby(["geo_block", "neighborhood"]).size().reset_index(name="n")
            .sort_values("n", ascending=False).drop_duplicates("geo_block")
            [["geo_block", "neighborhood"]])
    blocks = blocks.rename(columns={"geoid10": "geo_block", "name10": "block_name",
                                    "aland10": "aland_m2", "intptlat10": "intpt_lat",
                                    "intptlon10": "intpt_lon", "geometry": "geometry_wkt"})
    blocks = blocks.merge(hood, on="geo_block", how="left")
    blocks["zip"] = DOWNTOWN_ZIP
    blocks = blocks[["geo_block", "block_name", "neighborhood", "zip", "aland_m2",
                     "intpt_lat", "intpt_lon", "geometry_wkt"]]

    for name, frame in [("stg_a_observations", obs), ("stg_a_monthly_totals", mt),
                        ("stg_a_neighborhood_totals", nt), ("dim_blocks", blocks)]:
        con.register("_df", frame)
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df")
        con.unregister("_df")
    return LoadResult("ok", len(obs), f"files: {statuses}; imputed rows: {int(obs.is_imputed.sum())}")
