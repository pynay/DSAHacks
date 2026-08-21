import duckdb
import pandas as pd
from commons import db, qa
from commons.registry import LoadResult

def test_pearson():
    df = pd.DataFrame({"x": [1, 2, 3, 4], "y": [2, 4, 6, 8]})
    r, n = qa.pearson(df, "x", "y")
    assert abs(r - 1.0) < 1e-9 and n == 4
    r2, n2 = qa.pearson(pd.DataFrame({"x": [1], "y": [2]}), "x", "y")
    assert n2 == 1 and r2 != r2  # nan for insufficient pairs

def test_report_written_with_gaps(tmp_path):
    con = duckdb.connect(); db.ensure_schema(con)
    results = {"load_src_c": LoadResult("failed", 0, "network down")}
    out = tmp_path / "QA_REPORT.md"
    res = qa.write_qa_report(con, results, out)
    assert res.status == "ok"
    txt = out.read_text()
    assert "network down" in txt and "Correlation" in txt
    assert "insufficient overlapping data" in txt  # honest when sources missing

def test_report_written_with_empty_note(tmp_path):
    # a step can complete with note="" (e.g. load_src_d_72hr); must not crash on ''.splitlines()[0]
    con = duckdb.connect(); db.ensure_schema(con)
    results = {"load_src_d_72hr": LoadResult("ok", 334073, "")}
    out = tmp_path / "QA_REPORT.md"
    res = qa.write_qa_report(con, results, out)
    assert res.status == "ok"
    assert "load_src_d_72hr" in out.read_text()

def test_corr_h_blocks_shape():
    # structural: function exists and returns (r, n) or None without a populated db
    import duckdb
    from commons import db, qa
    con = duckdb.connect(); db.ensure_schema(con)
    assert qa._corr_311_vs_h_blocks(con) is None  # tables absent -> None
