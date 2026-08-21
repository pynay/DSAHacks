import duckdb
from commons import db, registry

def test_schema_and_source_upsert():
    con = duckdb.connect()
    db.ensure_schema(con)
    db.record_load(con, "C", registry.LoadResult("ok", 123, "loaded"))
    row = con.execute("SELECT source_id, load_status, rows_loaded FROM meta_sources WHERE source_id='C'").fetchone()
    assert row == ("C", "ok", 123)
    assert registry.SOURCES["C"]["signal_type"] == "complaint"
    for t, doc in registry.TABLE_DOCS.items():
        assert doc["measures"] and doc["known_bias"], t

def test_fail_soft_runner():
    con = duckdb.connect()
    db.ensure_schema(con)
    def boom(con): raise RuntimeError("nope")
    results = db.run_steps(con, [("bad_step", "C", boom)])
    assert results["bad_step"].status == "failed" and "nope" in results["bad_step"].note
