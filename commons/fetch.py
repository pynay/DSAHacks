import datetime as dt
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import requests

from commons.config import RAW_DIR as _RAW_DIR

RAW_DIR = _RAW_DIR  # module attr so tests can monkeypatch


@dataclass
class FetchResult:
    path: Path
    status: str  # downloaded | cached | failed
    fetched_at: str | None = None


def _manifest_path() -> Path:
    return RAW_DIR / "_manifest.json"


def _load_manifest() -> dict:
    p = _manifest_path()
    return json.loads(p.read_text()) if p.exists() else {}


def _save_manifest(man: dict) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    _manifest_path().write_text(json.dumps(man, indent=1))


def fetch(url: str, rel_path: str, force: bool = False, timeout: int = 120) -> FetchResult:
    dest = RAW_DIR / rel_path
    man = _load_manifest()
    entry = man.get(rel_path, {})
    headers = {}
    if dest.exists() and not force:
        if entry.get("etag"):
            headers["If-None-Match"] = entry["etag"]
        if entry.get("last_modified"):
            headers["If-Modified-Since"] = entry["last_modified"]
    try:
        resp = requests.get(url, headers=headers, timeout=timeout, stream=True)
    except Exception:
        if dest.exists():
            return FetchResult(dest, "cached", entry.get("fetched_at"))
        return FetchResult(dest, "failed")
    if resp.status_code == 304 and dest.exists():
        return FetchResult(dest, "cached", entry.get("fetched_at"))
    if resp.status_code != 200:
        if dest.exists():
            return FetchResult(dest, "cached", entry.get("fetched_at"))
        return FetchResult(dest, "failed")
    dest.parent.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            f.write(chunk)
            h.update(chunk)
    man[rel_path] = {
        "url": url,
        "etag": resp.headers.get("ETag"),
        "last_modified": resp.headers.get("Last-Modified"),
        "sha256": h.hexdigest(),
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        "size": dest.stat().st_size,
    }
    _save_manifest(man)
    return FetchResult(dest, "downloaded", man[rel_path]["fetched_at"])
