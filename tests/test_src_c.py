import duckdb
import pandas as pd
from commons import db
from commons.staging import src_a, src_c

def test_service_map_covers_and_filters():
    m = pd.read_csv("seeds/gid_service_map.csv")
    assert {"case_record_type","service_name","service_name_detail","canon_category","include","rationale"} <= set(m.columns)
    assert (m["include"] == True).any() and m["rationale"].notna().all()

def test_src_c_load_one_year():
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    res = src_c.load(con, years=[2024])
    assert res.status == "ok"
    df = con.execute("""SELECT count(*) n,
        sum(CASE WHEN canon_category IS NULL THEN 1 ELSE 0 END) uncat,
        sum(CASE WHEN neighborhood IS NOT NULL THEN 1 ELSE 0 END) downtown,
        sum(CASE WHEN is_child_duplicate THEN 1 ELSE 0 END) dupes
        FROM stg_gid_requests""").fetch_df().iloc[0]
    assert df.n > 1000          # 2024 had tens of thousands of encampment reports
    assert df.uncat == 0        # every kept row categorized
    assert df.downtown > 100    # downtown block assignment works
    assert df.dupes >= 0
    cols = {r[0] for r in con.execute("DESCRIBE stg_gid_requests").fetchall()}
    assert "public_description" not in cols and "street_address" not in cols  # PII guard
