import duckdb
import pandas as pd
from commons import db
from commons.staging import src_e

def test_seed_schema_and_load():
    m = pd.read_csv("seeds/capacity_manual.csv")
    assert {"obs_month", "program", "site", "beds", "occupancy_pct", "source_url"} <= set(m.columns)
    assert m.source_url.notna().all()
    con = duckdb.connect(); db.ensure_schema(con)
    res = src_e.load(con)
    assert res.status in ("ok", "stubbed")
    n = con.execute("SELECT count(*) FROM stg_capacity_monthly").fetchone()[0]
    assert n == len(m)  # no PDFs present -> exactly the seed rows
    assert con.execute("SELECT count(*) FROM stg_capacity_monthly WHERE method='manual_seed'").fetchone()[0] == n
    assert res.status == "stubbed"  # no raw/capacity_pdfs present in this environment
