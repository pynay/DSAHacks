from commons import db

STEPS = []  # (name, source_id, fn) appended as loaders land

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    return results

if __name__ == "__main__":
    main()
