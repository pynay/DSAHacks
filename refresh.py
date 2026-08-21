"""Incremental refresh of auto-updating layers only (311 + enforcement),
then rebuild marts, dictionary, and QA. Other sources keep their last load."""
from commons import db, docs_gen, marts, qa
from commons.staging import src_c, src_d

STEPS = [
    # conditional GET makes unchanged year-files free; current year + open file actually refresh
    ("refresh_311", "C", src_c.load),
    ("refresh_72hr", "D", src_d.load_72hr),
    ("refresh_citations", "D", src_d.load_citations),
    ("build_marts", None, marts.build),
    ("export_marts", None, marts.export),
]

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    results["data_dictionary"] = docs_gen.write_data_dictionary(con)
    results["qa_report"] = qa.write_qa_report(con, results)
    print("\nRefresh done. See QA_REPORT.md and DATA_DICTIONARY.md")
    return results

if __name__ == "__main__":
    main()
