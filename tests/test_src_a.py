import duckdb
from commons import db
from commons.staging import src_a

def test_src_a_load_real():
    con = duckdb.connect()
    db.ensure_schema(con)
    res = src_a.load(con)   # uses raw/ cache; downloads on first run
    assert res.status == "ok"
    # imputed flag: exactly the 3 documented months
    months = con.execute("""
        SELECT DISTINCT strftime(obs_month, '%Y-%m') FROM stg_a_observations
        WHERE is_imputed ORDER BY 1""").fetchall()
    assert [m[0] for m in months] == ["2014-08", "2014-09", "2015-06"]
    # every observation carries geo_block and h3
    n_bad = con.execute("SELECT count(*) FROM stg_a_observations WHERE geo_block IS NULL OR h3_r8 IS NULL").fetchone()[0]
    assert n_bad == 0
    # blocks dim populated with valid WKT polygons and neighborhoods
    n_blocks, n_hood = con.execute(
        "SELECT count(*), count(neighborhood) FROM dim_blocks").fetchone()
    assert n_blocks > 100 and n_hood > 0
    # geo_block is unique in dim_blocks (DuckDB CREATE TABLE AS can't enforce the PK)
    n_rows, n_distinct = con.execute(
        "SELECT count(*), count(DISTINCT geo_block) FROM dim_blocks").fetchone()
    assert n_rows == n_distinct
    # monthly totals reach back to 2012 and forward to 2019
    lo, hi = con.execute("SELECT min(obs_month), max(obs_month) FROM stg_a_monthly_totals").fetchone()
    assert str(lo) == "2012-01-01" and str(hi) >= "2019-04-01"
