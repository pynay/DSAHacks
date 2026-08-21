import duckdb
from commons import db, docs_gen
from commons.staging import src_a


def test_registry_populated_by_docs_gen_import_alone():
    # regression: TABLE_DOCS is populated by register_table() side effects at each
    # staging module's import time. refresh.py imports only src_c/src_d, so if docs_gen
    # relied on its caller to have imported every source first, refresh.py would
    # regenerate a truncated dictionary. docs_gen must import all sources itself.
    from commons.registry import TABLE_DOCS
    assert len(TABLE_DOCS) >= 20


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
