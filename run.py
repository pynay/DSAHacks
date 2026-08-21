from commons import db, marts
from commons.staging import src_a, src_b, src_c, src_d, src_e, src_f, src_g, src_h

STEPS = []  # (name, source_id, fn) appended as loaders land
# NOTE: src_c's *download/effort priority* is ahead of src_a (it's Source C, priority 1),
# but src_a is a hard dependency of geo.enrich (dim_blocks must exist first) and src_a is
# tiny/fast, so src_a runs first here. src_h has no ordering dependency on src_c.
STEPS.append(("load_src_a", "A", src_a.load))
STEPS.append(("load_src_h", "H", src_h.load))
STEPS.append(("load_src_c", "C", src_c.load))
STEPS.append(("load_src_d_72hr", "D", src_d.load_72hr))
STEPS.append(("load_src_d_citations", "D", src_d.load_citations))
STEPS.append(("load_src_b_dsdp", "B", src_b.load))
STEPS.append(("load_src_f_pit", "F", src_f.load))
STEPS.append(("load_src_e_capacity", "E", src_e.load))
STEPS.append(("load_src_g_weather", "G_weather", src_g.load_weather))
STEPS.append(("load_src_g_zori", "G_zori", src_g.load_zori))
STEPS.append(("load_src_g_events", "G_events", src_g.load_events))
STEPS.append(("build_marts", None, marts.build))
STEPS.append(("export_marts", None, marts.export))

def main():
    con = db.connect()
    db.ensure_schema(con)
    results = db.run_steps(con, STEPS)
    return results

if __name__ == "__main__":
    main()
