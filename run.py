from commons import db
from commons.staging import src_a, src_c, src_h

STEPS = []  # (name, source_id, fn) appended as loaders land
# NOTE: src_c's *download/effort priority* is ahead of src_a (it's Source C, priority 1),
# but src_a is a hard dependency of geo.enrich (dim_blocks must exist first) and src_a is
# tiny/fast, so src_a runs first here. src_h has no ordering dependency on src_c.
STEPS.append(("load_src_a", "A", src_a.load))
STEPS.append(("load_src_h", "H", src_h.load))
STEPS.append(("load_src_c", "C", src_c.load))

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    return results

if __name__ == "__main__":
    main()
