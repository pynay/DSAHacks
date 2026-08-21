# Parsel San Diego data-source catalog

This is the implementation queue behind [`data_source_catalog.csv`](data_source_catalog.csv).
It expands the hackathon commons beyond the supplied downtown counts while preserving the
repo's rule: every measure is a signal with known biases, not automatically a census.

The catalog contains **58 sources across eight domains**. Each row records access method,
grain, history, join key, recommended use, and the bias that must travel with the metric.
`P0` means implement or acquire first, `P1` is a strong second wave, `P2` is useful context,
and `P3` is restricted or a last resort. “Cataloged” means researched and ready for an
adapter; it does not mean the data has already been copied into this repository.

## Recommended data implementation order

1. **Food access and need:** current/historic SNAP retailers, county-month CalFresh,
   WIC vendors, school FRPM, then expand FARA from La Jolla to all San Diego tracts.
2. **Food-relief operations:** durable inventory, donation, distribution, expiration,
   partner-capacity, and outcome records at the lowest safe operational grain.
3. **Independent activity signals:** special events, MTS GTFS, SANDAG ridership and bicycle
   counters. Use these together; no single series is a foot-traffic count or food-need measure.
4. **Mobile-outreach context:** RTFH monthly HMIS entries/exits, project capacity, and tract
   PIT. These can prioritize verification but must not stand in for food insecurity.
5. **Affordability:** HUD CHAS, ACS, assisted housing/LIHTC, STRO, permits, parcels,
   business openings/closures, rents, and SANDAG population denominators.
6. **Street and health context:** selected non-personal 311 categories, aggregated Fire/EMS,
   police calls, overdose, treatment access, HPI, and CalEnviroScreen.

City paid-parking sessions are already implemented as Source J and remain useful as
context. Their implementation status does not make them a higher product priority than
food-access and food-flow data.

## Proxy map

| Question | Best available open signal | Pair with | Never claim |
|---|---|---|---|
| Is downtown activity changing? | paid parking sessions | bike counts, transit ridership, events, weather | pedestrians or unique visitors |
| Is food need changing? | CalFresh participation/benefits | FRPM, SNAP/WIC retailer access, pantry operations | household hunger from one proxy |
| Where should mobile food outreach verify first? | reviewed field observations | DSDP/PIT, HMIS, transit, events | food insecurity or meals required from visible people |
| Is homelessness-system pressure changing? | HMIS entries/exits and project use | DSDP/PIT, shelter beds, 311 | exact people on a block today |
| Is affordability worsening? | CHAS/ACS cost burden and ZORI | permits, subsidized stock, business and population change | individual displacement |
| Are public-realm conditions changing? | category-specific 311 and aggregate emergency activity | maintenance schedules, events, weather | prevalence from complaints alone |

## Join strategy

- Normalize points and polygons to census tract GEOID, DSDP neighborhood, and H3 only
  after retaining the publisher's original geography.
- Keep both `event_date` and `obs_month`; never smear sparse annual PIT observations into
  monthly values.
- Track source-vintage boundaries for ACS, HPI, CalEnviroScreen, parcels, and land use.
- For activity feeds, add coverage denominators (meters/counters/routes reporting) so a
  hardware or inventory change cannot masquerade as social change.
- Publish only aggregates that pass the existing privacy tier. Police, Fire/EMS, 311, and
  block-level homelessness records should not be exposed as precise public locations.

## Access constraints

The open-data-first plan avoids paid movement data. MTS real-time requires an API key,
HUD USPS vacancy has eligibility restrictions, and HPI downloads/API may require a key.
Commercial mobility products are intentionally `P3`: they can be useful for validation if
a sponsor provides a license, but their opaque models and device-selection bias make them
a poor foundation for the project.
