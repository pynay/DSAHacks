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
        known_bias="Single monthly early-morning count; undercounts people in vehicles/hidden locations. 3 months imputed (Aug/Sep 2014, Jun 2015). The point-level table (stg_a_observations) is raw counted units with NO occupancy multipliers applied. The pre-aggregated monthly/neighborhood totals (stg_a_monthly_totals, stg_a_neighborhood_totals) are DSDP-published figures that ARE occupancy-multiplier-adjusted from the Apr 2017 methodology change onward (2.00/2.00 pre-2017, then 1.75 tents / 1.66-2.03 vehicles - see stg_h_method_periods); they match Source H's published totals exactly from 2017-04 on."),
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
    "H": dict(name="Hackathon curated DSDP downtown counts bundle (Data Science Alliance)",
        url="https://downtownsandiego.org/clean-and-safe/unhoused-care/",
        signal_type="observation", refresh_cadence="static bundle (2017-2025), committed in data/hackathon/",
        measures="Verified published DSDP monthly unsheltered totals by area (2017-2025), digitized block-level counts (2018-2025, 12 count dates), block-grid polygons, area crosswalk, and the multiplier schedule.",
        known_bias="Published totals ARE occupancy-multiplier-adjusted (tents x1.75-2.00, vehicles x1.66-2.03) - not comparable to raw counted units (source A) nor to post-2020 RTFH/PIT raw counts. Components digitized from map images (secondary reliability, 2018+). Block footprint grew 261->382 in Jan 2022. Counting effort varied (fellowship months 2017-2020). Four 2025 months unreported."),
    "I": dict(name="USDA Food Access Research Atlas - La Jolla",
        url="https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data",
        signal_type="food_access", refresh_cadence="periodic (USDA FARA release; manual seed)",
        measures="USDA FARA census-tract food-access indicators for La Jolla (ZIP 92037): population, low-access population and share (>1mi urban to nearest supermarket), low-income-and-low-access population, the LILA food-desert flag, and housing units receiving SNAP. Vintages 2010/2015/2019 on 2010 tract boundaries.",
        known_bias="Low access is defined purely by distance to a supermarket, not affordability or actual need. Periodic snapshots, not a continuous series. SNAP figure counts housing units, not people. Field availability varies by vintage (see each row's note). Not comparable to the downtown homelessness signals; provided as area food-insecurity context only."),
    "J": dict(name="Downtown paid-parking activity proxy (City of San Diego)",
        url="https://data.sandiego.gov/datasets/parking-meters-transactions-daily/",
        signal_type="activity_proxy", refresh_cadence="daily files, annual partitions (auto)",
        measures="Daily paid parking transactions and payment revenue per meter, mapped to the six DSDP downtown neighborhoods. This is a repeatable activity/visitation signal, not a pedestrian counter.",
        known_bias="Paid parking sessions are NOT foot traffic or people counts. The signal excludes walking, biking, transit, ride-hail, free parking, pass holders, unpaid/failed sessions, and people who do not park. It changes with meter inventory, rates, operating hours, enforcement, holidays, events, construction, remote work, payment behavior, and modal shift. One transaction may cover several occupants or no completed visit. Historic meters absent from the current location file use a coarser City parking-area crosswalk; mixed Core-Columbia rows fall back to city_center and should be treated as lower spatial confidence."),
}

TABLE_DOCS: dict[str, dict] = {}  # table_name -> doc dict; loaders register at import

def register_table(name, grain, signal_type, source_id, measures, known_bias, refresh):
    TABLE_DOCS[name] = dict(grain=grain, signal_type=signal_type, source_id=source_id,
                            source_url=SOURCES[source_id]["url"], refresh=refresh,
                            measures=measures, known_bias=known_bias)
