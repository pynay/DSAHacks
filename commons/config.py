import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "raw"
HACKATHON_DIR = ROOT / "data" / "hackathon"
MARTS_DIR = ROOT / "marts"
SEEDS_DIR = ROOT / "seeds"
DB_PATH = ROOT / "commons.duckdb"

_METATAB = "http://library.metatab.org/sandiegodata.org-dowtown_homeless-2.1.1/data"
SRC_A_FILES = {  # rel raw path -> url
    "src_a/homeless_counts.csv": f"{_METATAB}/homeless_counts.csv",
    "src_a/imputed_counts.csv": f"{_METATAB}/imputed_counts.csv",
    "src_a/monthly_totals.csv": f"{_METATAB}/monthly_totals.csv",
    "src_a/neighborhood_totals.csv": f"{_METATAB}/neighborhood_totals.csv",
    "src_a/downtown_blocks.csv": f"{_METATAB}/downtown_blocks.csv",
}
SRC_A_PAGE = "https://data.sandiegodata.org/dataset/sandiegodata-org-dowtown-homeless/"

GID_YEARS = range(2016, dt.date.today().year + 1)
GID_CLOSED_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_closed_{year}_datasd.csv"
GID_OPEN_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_open_datasd.csv"
GID_DICT_URL = "https://seshat.datasd.org/get_it_done_reports/get_it_done_requests_dictionary_datasd.csv"
GID_PAGE = "https://data.sandiego.gov/datasets/get-it-done-311/"

V72_URL = "https://seshat.datasd.org/get_it_done_parking_violations/get_it_done_72_hour_violation_requests_datasd.csv"
V72_PAGE = "https://data.sandiego.gov/datasets/gid-72-hour-violation/"
CITATION_YEARS = range(2014, dt.date.today().year + 1)
CITATIONS_URL = "https://seshat.datasd.org/parking_citations/parking_citations_{year}_part{part}_datasd.csv"
CITATIONS_PAGE = "https://data.sandiego.gov/datasets/parking-citations/"

PARKING_METER_YEARS = range(2021, dt.date.today().year + 1)
PARKING_METER_DAILY_URL = (
    "https://seshat.datasd.org/parking_meters_transactions_daily/"
    "treas_meters_{year}_pole_by_mo_day_datasd.csv"
)
PARKING_METER_LOCATIONS_URL = (
    "https://seshat.datasd.org/parking_meters_locations/parking_meters_current.csv"
)
PARKING_METER_PAGE = "https://data.sandiego.gov/datasets/parking-meters-transactions-daily/"

NOAA_STATION = "USW00023188"  # San Diego Intl Airport
NOAA_URL = (
    "https://www.ncei.noaa.gov/access/services/data/v1"
    "?dataset=daily-summaries&stations=USW00023188&dataTypes=TMAX,TMIN,PRCP"
    "&startDate=2012-01-01&endDate={end}&format=csv&units=metric"
)
ZORI_URL = "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv"

DOWNTOWN_NEIGHBORHOODS = ["east_village", "city_center", "columbia", "marina", "cortez", "gaslamp"]
DOWNTOWN_ZIP = "92101"
