import duckdb
import pandas as pd
from commons import db
from commons.staging import src_f

def test_pit_seed_and_load():
    m = pd.read_csv("seeds/pit_annual.csv")
    assert {"year","geography","sheltered","unsheltered","source_url"} <= set(m.columns)
    assert m.year.between(2010, 2026).all() and m.source_url.notna().all()
    con = duckdb.connect(); db.ensure_schema(con)
    res = src_f.load(con)
    assert res.status == "ok"
    tot = con.execute("SELECT total, sheltered+unsheltered FROM stg_pit_annual LIMIT 1").fetchone()
    assert tot[0] == tot[1]  # total is derived, consistent
    n_years = con.execute("SELECT count(DISTINCT year) FROM stg_pit_annual").fetchone()[0]
    assert n_years >= 6
