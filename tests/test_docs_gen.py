import duckdb
from commons import db, docs_gen
from commons.staging import src_a

def test_dictionary_contents(tmp_path):
    con = duckdb.connect(); db.ensure_schema(con); src_a.load(con)
    out = tmp_path / "DATA_DICTIONARY.md"
    res = docs_gen.write_data_dictionary(con, out)
    assert res.status == "ok"
    txt = out.read_text()
    assert "stg_a_observations" in txt and "Known bias" in txt
    assert "does NOT apply multipliers" in txt      # A's multiplier caveat present
    assert "NOT people" in txt or "not people" in txt.lower()  # complaint framing
    for t in ("dim_blocks", "stg_a_monthly_totals"):
        assert f"### `{t}`" in txt
