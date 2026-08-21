from commons import db
from commons.staging import src_a

STEPS = []  # (name, source_id, fn) appended as loaders land
STEPS.append(("load_src_a", "A", src_a.load))

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    return results

if __name__ == "__main__":
    main()
