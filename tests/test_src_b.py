import duckdb
import pandas as pd
from commons import db
from commons.staging import src_b

def test_seed_schema_and_load():
    m = pd.read_csv("seeds/dsdp_manual.csv")
    assert {"obs_month", "neighborhood", "total", "source_url"} <= set(m.columns)
    if len(m):
        assert m.source_url.notna().all()
    con = duckdb.connect(); db.ensure_schema(con)
    res = src_b.load(con)
    assert res.status in ("ok", "stubbed")
    n = con.execute("SELECT count(*) FROM stg_dsdp_monthly").fetchone()[0]
    assert n == len(m)  # no PDFs present -> exactly the seed rows
    if n:
        assert con.execute("SELECT count(*) FROM stg_dsdp_monthly WHERE method='manual_seed'").fetchone()[0] == n
