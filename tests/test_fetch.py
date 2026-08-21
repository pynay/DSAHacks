import json
from unittest import mock
import commons.fetch as fetch_mod
from commons.fetch import fetch

def _resp(status=200, body=b"a,b\n1,2\n", headers=None):
    r = mock.Mock()
    r.status_code = status
    r.headers = headers or {"ETag": '"abc"'}
    r.iter_content = lambda chunk_size: iter([body])
    return r

def test_downloads_then_caches(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", return_value=_resp()) as g:
        r1 = fetch("http://x/f.csv", "t/f.csv")
    assert r1.status == "downloaded" and r1.path.read_bytes() == b"a,b\n1,2\n"
    man = json.loads((tmp_path / "_manifest.json").read_text())
    assert man["t/f.csv"]["etag"] == '"abc"'
    # second call: server says 304 -> cached, no rewrite
    with mock.patch("commons.fetch.requests.get", return_value=_resp(status=304)) as g:
        r2 = fetch("http://x/f.csv", "t/f.csv")
        sent = g.call_args.kwargs["headers"]
    assert r2.status == "cached" and sent.get("If-None-Match") == '"abc"'

def test_failure_with_cache_falls_back(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", return_value=_resp()):
        fetch("http://x/f.csv", "t/f.csv")
    with mock.patch("commons.fetch.requests.get", side_effect=OSError("net down")):
        r = fetch("http://x/f.csv", "t/f.csv")
    assert r.status == "cached" and r.path.exists()

def test_failure_no_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_mod, "RAW_DIR", tmp_path)
    with mock.patch("commons.fetch.requests.get", side_effect=OSError("net down")):
        r = fetch("http://x/g.csv", "t/g.csv")
    assert r.status == "failed"
