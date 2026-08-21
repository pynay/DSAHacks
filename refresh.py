"""Incremental refresh of auto-updating layers (311, enforcement, parking activity),
then rebuild marts, dictionary, and QA. Other sources keep their last load."""
import sys

from commons import db, docs_gen, marts, qa
from commons.staging import src_c, src_d, src_j

STEPS = [
    # conditional GET makes unchanged year-files free; current year + open file actually refresh
    ("refresh_311", "C", src_c.load),
    ("refresh_72hr", "D", src_d.load_72hr),
    ("refresh_citations", "D", src_d.load_citations),
    ("refresh_parking_activity", "J", src_j.load),
    ("build_marts", None, marts.build),
    ("export_marts", None, marts.export),
]

def main():
    con = db.connect()
    db.ensure_schema(con)
    if con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name='dim_blocks'").fetchone()[0] == 0:
        print("commons.duckdb not initialized - run `python run.py` first")
        sys.exit(1)
    results = db.run_steps(con, STEPS)
    results["data_dictionary"] = docs_gen.write_data_dictionary(con)
    results["qa_report"] = qa.write_qa_report(con, results)
    print("\nRefresh done. See QA_REPORT.md and DATA_DICTIONARY.md")
    return results

if __name__ == "__main__":
    main()
