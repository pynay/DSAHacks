import pandas as pd

from commons.config import SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_i_food_access", grain="census tract x vintage (+ la_jolla rollup)",
    signal_type="food_access", source_id="I", refresh="periodic (USDA FARA release; edit seed)",
    measures="Long-format USDA FARA food-access metrics for La Jolla tracts, plus a population-weighted la_jolla rollup.",
    known_bias="Distance-based low-access definition; periodic snapshots on 2010 tract boundaries; SNAP counts housing units; at geography='la_jolla' lila_flag is the SHARE of La Jolla tracts flagged (0-1) and low_access_pop_share is recomputed from summed counts.")

_METRICS = ["pop_total", "low_access_pop", "low_access_pop_share",
            "low_income_low_access_pop", "lila_flag", "snap_housing_units"]
_SUMMABLE = ["pop_total", "low_access_pop", "low_income_low_access_pop", "snap_housing_units"]


def load(con) -> LoadResult:
    seed = pd.read_csv(SEEDS_DIR / "food_access_la_jolla.csv")
    seed["census_tract"] = seed["census_tract"].astype(str).str.zfill(11)
    for m in _METRICS:
        seed[m] = pd.to_numeric(seed[m], errors="coerce")
    src_url = seed["source_url"].iloc[0]

    # per-tract long rows
    per = seed.melt(id_vars=["vintage_year", "census_tract", "source_url"],
                    value_vars=_METRICS, var_name="metric", value_name="value").dropna(subset=["value"])
    per["geography"] = "tract_" + per["census_tract"]
    per = per[["geography", "vintage_year", "metric", "value", "source_url"]]

    # la_jolla rollup per vintage
    roll_rows = []
    for yr, g in seed.groupby("vintage_year"):
        n_tracts = len(g)
        pop_sum = g["pop_total"].sum()
        vals = {m: g[m].sum() for m in _SUMMABLE}
        vals["low_access_pop_share"] = (100.0 * vals["low_access_pop"] / pop_sum) if pop_sum else None
        vals["lila_flag"] = g["lila_flag"].mean() if g["lila_flag"].notna().any() else None  # share of tracts flagged
        for m in _METRICS:
            v = vals.get(m)
            if v is not None and not pd.isna(v):
                roll_rows.append({"geography": "la_jolla", "vintage_year": int(yr),
                                  "metric": m, "value": float(v), "source_url": src_url})
    roll = pd.DataFrame(roll_rows, columns=["geography", "vintage_year", "metric", "value", "source_url"])

    out = pd.concat([per, roll], ignore_index=True)
    con.register("_df", out)
    con.execute("CREATE OR REPLACE TABLE stg_i_food_access AS SELECT * FROM _df")
    con.unregister("_df")
    note = f"{seed['census_tract'].nunique()} tracts x {seed['vintage_year'].nunique()} vintages; {len(roll)} rollup rows"
    return LoadResult("ok", len(out), note)
