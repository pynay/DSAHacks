import re
from pathlib import Path

import pandas as pd
import pdfplumber

from commons.config import RAW_DIR, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_dsdp_monthly", grain="month x (neighborhood|downtown-wide NULL)",
    signal_type="observation", source_id="B", refresh="monthly (manual PDF drop or seed edit)",
    measures="DSDP-reported monthly unsheltered totals for downtown.",
    known_bias="Post-2017 DSDP methodology may apply occupancy multipliers - levels not directly comparable to source A raw counts. Rows collected from press coverage carry transcription risk (source_url per row). Source H already covers verified DSDP totals 2017-2025; this seed only carries months outside that bundle (2025 reporting gaps or later), and is header-only where no verifiable month total could be sourced this session.")

MONTHS = {m: i for i, m in enumerate(
    ["january","february","march","april","may","june","july","august",
     "september","october","november","december"], start=1)}


def _parse_pdfs():
    rows = []
    for pdf_path in sorted((RAW_DIR / "dsdp_pdfs").glob("*.pdf")):
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        # pattern: "<Month> <YYYY> ... <total>" - DSDP reports state a single monthly total
        m = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d\d)", text)
        t = re.search(r"([\d,]{3,6})\s+(?:total\s+)?(?:unsheltered|individuals)", text, re.I)
        if m and t:
            month = f"{int(m.group(2))}-{MONTHS[m.group(1).lower()]:02d}-01"
            rows.append(dict(obs_month=month, neighborhood=None,
                             total=int(t.group(1).replace(",", "")),
                             source_url=f"file://{pdf_path.name}", method="pdf_parsed"))
    return pd.DataFrame(rows)


def load(con) -> LoadResult:
    seed = pd.read_csv(SEEDS_DIR / "dsdp_manual.csv", dtype={"neighborhood": str})
    seed["method"] = "manual_seed"
    seed = seed[["obs_month", "neighborhood", "total", "source_url", "method"]]
    parsed = _parse_pdfs()
    df = pd.concat([parsed, seed], ignore_index=True)
    df["obs_month"] = pd.to_datetime(df["obs_month"]).dt.date
    df = df.drop_duplicates(["obs_month", "neighborhood"], keep="first")  # pdf wins over seed
    con.register("_df", df)
    con.execute("CREATE OR REPLACE TABLE stg_dsdp_monthly AS SELECT * FROM _df")
    con.unregister("_df")
    status = "ok" if len(parsed) else "stubbed"
    return LoadResult(status, len(df), f"pdf_rows={len(parsed)} seed_rows={len(seed)}")
