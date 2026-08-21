import re

import pandas as pd
import pdfplumber

from commons.config import RAW_DIR, SEEDS_DIR
from commons.registry import LoadResult, register_table

register_table("stg_capacity_monthly", grain="month x record_type x program x site",
    signal_type="capacity", source_id="E", refresh="monthly (manual PDF drop or seed edit)",
    measures="Shelter beds and occupancy by program/site.",
    known_bias="Reporting formats vary by month/provider; occupancy definitions differ; months missing where reports unpublished. Two incompatible row shapes share this table, distinguished by record_type: 'site_roster' rows are point-in-time bed counts per named site (obs_month is the fetch month - the source page carries no published as-of date, not a real historical month), while 'category_occupancy' rows are true monthly occupancy-rate aggregates published per shelter category. Never join or sum across the two record_types without filtering to one - a roster row's beds and a category row's occupancy_pct do not describe the same population.")


def _parse_pdfs():
    """Mirrors src_b: any PDFs dropped in raw/capacity_pdfs/*.pdf get table-extracted.
    Expects rows shaped (program/site, beds, occupancy) somewhere in an extracted table;
    obs_month is taken from the filename (YYYY-MM*.pdf convention). Parsed rows are treated
    as site_roster (per-site beds/occupancy for a real reporting month, unlike the seed's
    fetch-dated roster rows)."""
    rows = []
    for pdf_path in sorted((RAW_DIR / "capacity_pdfs").glob("*.pdf")):
        m = re.match(r"(\d{4})-(\d{2})", pdf_path.stem)
        if not m:
            continue
        obs_month = f"{m.group(1)}-{m.group(2)}-01"
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables() or []:
                    for row in table:
                        cells = [c.strip() if isinstance(c, str) else c for c in row]
                        if len(cells) < 3 or not cells[0] or cells[0].lower() in ("program", "site"):
                            continue
                        beds_val = next((c for c in cells[1:] if c and re.fullmatch(r"\d+", str(c))), None)
                        occ_val = next((c for c in cells[1:] if c and re.fullmatch(r"\d+(\.\d+)?%?", str(c)) and c != beds_val), None)
                        if beds_val is None and occ_val is None:
                            continue
                        rows.append(dict(
                            record_type="site_roster", obs_month=obs_month, program=cells[0], site=cells[0],
                            beds=int(beds_val) if beds_val else None,
                            occupancy_pct=float(str(occ_val).rstrip("%")) if occ_val else None,
                            source_url=f"file://{pdf_path.name}", method="pdf_parsed"))
    return pd.DataFrame(rows)


def load(con) -> LoadResult:
    seed = pd.read_csv(SEEDS_DIR / "capacity_manual.csv")
    seed["method"] = "manual_seed"
    seed = seed[["record_type", "obs_month", "program", "site", "beds", "occupancy_pct", "source_url", "method"]]
    parsed = _parse_pdfs()
    df = pd.concat([parsed, seed], ignore_index=True)
    df["obs_month"] = pd.to_datetime(df["obs_month"]).dt.date
    df["beds"] = pd.to_numeric(df["beds"], errors="coerce").astype("Int64")
    df["occupancy_pct"] = pd.to_numeric(df["occupancy_pct"], errors="coerce")
    df = df.drop_duplicates(["obs_month", "record_type", "program", "site"], keep="first")  # pdf wins over seed
    con.register("_df", df)
    con.execute("CREATE OR REPLACE TABLE stg_capacity_monthly AS SELECT * FROM _df")
    con.unregister("_df")
    status = "ok" if len(parsed) else "stubbed"
    return LoadResult(status, len(df), f"pdf_rows={len(parsed)} seed_rows={len(seed)}")
