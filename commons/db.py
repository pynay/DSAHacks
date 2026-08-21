import datetime as dt
import traceback

import duckdb

from commons.config import DB_PATH
from commons.registry import SOURCES, LoadResult

META_DDL = """
CREATE TABLE IF NOT EXISTS meta_sources (
  source_id TEXT PRIMARY KEY, name TEXT, url TEXT, signal_type TEXT,
  refresh_cadence TEXT, measures TEXT, known_bias TEXT,
  load_status TEXT, rows_loaded BIGINT, load_note TEXT, loaded_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS meta_runs (
  run_at TIMESTAMP, step TEXT, source_id TEXT, status TEXT, rows BIGINT, note TEXT);
"""

def connect(path=DB_PATH):
    return duckdb.connect(str(path))

def ensure_schema(con):
    con.execute(META_DDL)
    for sid, s in SOURCES.items():
        con.execute("""
            INSERT INTO meta_sources (source_id,name,url,signal_type,refresh_cadence,measures,known_bias)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT (source_id) DO UPDATE SET name=excluded.name, url=excluded.url,
              signal_type=excluded.signal_type, refresh_cadence=excluded.refresh_cadence,
              measures=excluded.measures, known_bias=excluded.known_bias
        """, [sid, s["name"], s["url"], s["signal_type"], s["refresh_cadence"], s["measures"], s["known_bias"]])

def record_load(con, source_id, res: LoadResult):
    now = dt.datetime.now()
    con.execute("UPDATE meta_sources SET load_status=?, rows_loaded=?, load_note=?, loaded_at=? WHERE source_id=?",
                [res.status, res.rows, res.note, now, source_id])

def run_steps(con, steps):
    """steps: list of (step_name, source_id, fn(con)->LoadResult). Fail-soft."""
    results = {}
    for name, source_id, fn in steps:
        try:
            res = fn(con)
        except Exception as e:
            res = LoadResult("failed", 0, f"{type(e).__name__}: {e}\n{traceback.format_exc(limit=3)}")
        results[name] = res
        if source_id:
            record_load(con, source_id, res)
        con.execute("INSERT INTO meta_runs VALUES (?,?,?,?,?,?)",
                    [dt.datetime.now(), name, source_id, res.status, res.rows, res.note[:500]])
        print(f"[{res.status:>7}] {name}: {res.rows} rows. {res.note.splitlines()[0] if res.note else ''}")
    return results
