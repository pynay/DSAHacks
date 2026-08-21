import pandas as pd

from commons.config import SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_pit_annual", grain="year x geography", signal_type="observation",
    source_id="F", refresh="annual (edit seed)",
    measures="Annual one-night Point-in-Time sheltered/unsheltered counts (RTFH).",
    known_bias="One night per year; methodology varies by year (2021 unsheltered count skipped - RTFH received a HUD COVID exception and only conducted the sheltered/HIC count that year, so 2021 is absent here rather than faked as zero); undercounts hidden homelessness. Region vs city geography noted per row. From 2020 on, RTFH/PIT reports raw one-night counts with no occupancy multiplier, while DSDP (source B/H) applies tent/vehicle occupancy multipliers to its totals - PIT figures are therefore NOT directly comparable to DSDP-adjusted totals from 2020 onward (see docs/hackathon/METHODOLOGY_CHANGELOG.md).")


def load(con) -> LoadResult:
    df = pd.read_csv(SEEDS_DIR / "pit_annual.csv")
    df["total"] = df["sheltered"].fillna(0).astype(int) + df["unsheltered"].fillna(0).astype(int)
    con.register("_df", df[["year", "geography", "sheltered", "unsheltered", "total", "source_url"]])
    con.execute("CREATE OR REPLACE TABLE stg_pit_annual AS SELECT * FROM _df")
    con.unregister("_df")
    return LoadResult("ok", len(df), "")
