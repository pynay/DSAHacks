# SD Homelessness Data Commons
Reproducible pipeline fusing San Diego homelessness signals into one DuckDB.
## Run
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python run.py        # full build
    python refresh.py    # incremental refresh of 311 + enforcement only
