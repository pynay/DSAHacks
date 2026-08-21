import duckdb
import pandas as pd
from commons import db
from commons.staging import src_a, src_d

def test_violation_codes_seed():
    m = pd.read_csv("seeds/violation_codes.csv")
    assert set(m.code_category) <= {"oversize_vehicle", "72_hour", "habitation_adjacent"}
    assert m.vio_code.notna().all() and m.interpretation.notna().all() and m.source_url.notna().all()

def test_72hr_load():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_d.load_72hr(con)
    assert res.status == "ok"
    n, downtown = con.execute(
        "SELECT count(*), count(neighborhood) FROM stg_violations_72hr").fetchone()
    assert n > 10000 and downtown > 0

def test_citations_load_one_year():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_d.load_citations(con, years=[2024])
    assert res.status == "ok"
    df = con.execute("""SELECT count(*) n, count(geo_block) geo,
        count(DISTINCT code_category) cats FROM stg_citations""").fetch_df().iloc[0]
    assert df.n > 0 and df.geo == 0 and df.cats >= 1  # geo intentionally NULL
