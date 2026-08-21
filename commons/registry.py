from dataclasses import dataclass

@dataclass
class LoadResult:
    status: str  # ok | partial | failed | stubbed
    rows: int = 0
    note: str = ""

SOURCES = {
    "A": dict(name="Downtown block-level monthly counts (sandiegodata.org)",
        url="https://data.sandiegodata.org/dataset/sandiegodata-org-dowtown-homeless/",
        signal_type="observation", refresh_cadence="static (2014-2019 archive)",
        measures="People, tent/structures, and vehicles physically counted on downtown streets monthly by Downtown San Diego Partnership contractors.",
        known_bias="Single monthly early-morning count; undercounts people in vehicles/hidden locations. 3 months imputed (Aug/Sep 2014, Jun 2015). Methodology changed Apr 2017 (occupancy multipliers) but THIS dataset does NOT apply multipliers - series is raw counted units throughout."),
    "B": dict(name="Downtown SD Partnership monthly report totals",
        url="https://downtownsandiego.org/",
        signal_type="observation", refresh_cadence="monthly (manual/PDF)",
        measures="Monthly unsheltered totals reported by DSDP for downtown neighborhoods.",
        known_bias="Same single-count limits as A; post-2017 reports may apply occupancy multipliers, so levels are not directly comparable to source A raw counts. Collected partly from press coverage."),
    "C": dict(name="Get It Done 311 requests (homelessness-related)",
        url="https://data.sandiego.gov/datasets/get-it-done-311/",
        signal_type="complaint", refresh_cadence="daily (auto)",
        measures="Resident-submitted 311 reports whose service category relates to homelessness (encampments, outreach requests). Measures complaint volume, NOT people.",
        known_bias="Reporting propensity varies by neighborhood, app adoption, and category renames over time. One encampment can generate many reports. Never interpret as a count of people."),
    "D": dict(name="Enforcement: 72-hr violations + selected parking citations",
        url="https://data.sandiego.gov/datasets/parking-citations/",
        signal_type="enforcement", refresh_cadence="daily/annual (auto)",
        measures="72-hour parking violation reports and citations under oversize-vehicle/72-hour/habitation-adjacent codes. Measures enforcement activity, NOT people.",
        known_bias="Driven by complaint volume and patrol priorities; policy changes shift enforcement independent of homelessness. Citations lack coordinates (citywide only)."),
    "E": dict(name="Shelter capacity (City/SDHC monthly reports)",
        url="https://www.sandiego.gov/homelessness-strategies-and-solutions/data-reports",
        signal_type="capacity", refresh_cadence="monthly (manual/PDF)",
        measures="Shelter beds available and occupancy by program/site.",
        known_bias="Reporting formats change; some programs missing months; occupancy definitions vary by provider."),
    "F": dict(name="Annual Point-in-Time counts (RTFH)",
        url="https://www.rtfhsd.org/",
        signal_type="observation", refresh_cadence="annual (manual seed)",
        measures="Annual one-night sheltered/unsheltered counts.",
        known_bias="One night per year; methodology changes across years; known undercount of hidden homelessness."),
    "G_weather": dict(name="NOAA GHCN-Daily USW00023188", url="https://www.ncei.noaa.gov/",
        signal_type="context", refresh_cadence="daily (auto)",
        measures="Daily TMAX/TMIN (C) and precipitation (mm) at San Diego Intl Airport.",
        known_bias="Single station; microclimates differ across the city."),
    "G_zori": dict(name="Zillow ZORI zip-level rents", url="https://www.zillow.com/research/data/",
        signal_type="context", refresh_cadence="monthly (auto)",
        measures="Smoothed typical asking rent by zip.",
        known_bias="Asking rents of listed units only; smoothed/seasonally adjusted; zips partially covered."),
    "G_events": dict(name="Policy events (hand-curated)", url="seeds/events.csv",
        signal_type="context", refresh_cadence="manual",
        measures="Dated policy/shelter/sweep events with source URLs.",
        known_bias="Curated selection; some dates uncertain and flagged for verification."),
}

TABLE_DOCS: dict[str, dict] = {}  # table_name -> doc dict; loaders register at import

def register_table(name, grain, signal_type, source_id, measures, known_bias, refresh):
    TABLE_DOCS[name] = dict(grain=grain, signal_type=signal_type, source_id=source_id,
                            source_url=SOURCES[source_id]["url"], refresh=refresh,
                            measures=measures, known_bias=known_bias)
