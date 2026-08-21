# Hackathon mandatory dataset — provenance

Files in `data/hackathon/` were provided as the hackathon's mandatory datasets by
Data Science Alliance (owner: adir@datasciencealliance.org), shared via Google Drive
on 2026-08-20 and committed here verbatim for reproducibility (Drive requires auth).

Derived from Downtown San Diego Partnership (DSDP) Clean & Safe monthly
*Unsheltered Sleep Count* reports: https://downtownsandiego.org/clean-and-safe/unhoused-care/

| File | Drive ID |
|---|---|
| DowntownCounts_Monthly.csv | 1IBT1zLBwPokrwza9CN6mC4GmEVI7jneu |
| BlockLevel_Counts.csv | 1d_iVqnk6-2LVeG4uZoMwSWG7aYMx3qPi |
| BlockLevel_Counts_Panel261.csv | 1vb5fSEFFviEEslz9yKna1rWbbxVpWpn5 |
| Downtown_BlockGrid.csv | 1i6ljE2XHE0Xp3yMSz7MlQU_H2TIz2Eok |
| Downtown_BlockGrid.geojson | 1pQCrewIluVKYR6Y3m6-KcaKPTVEQim8X |
| Area_Crosswalk.csv | 14C-C7Raf7lAZVxCuPq57w3CrOq2IGkqq |
| Methodology_Periods.csv | 1u3jewT4cLEso9ki6l0rY14PxiUL2Qt-f |

Accompanying docs (exported to this directory as markdown):
- DATA_DICTIONARY_hackathon.md (Drive 1az166yF0iZjzl7EdObMyUlVzGT-H7Qtkv_nOY4HTq68)
- METHODOLOGY_CHANGELOG.md (Drive 1HmFjjicDj2mbZVQt2JEVA7lZgNYsJCIiheSUwjbK-oo)
- RESOURCES_OVERVIEW.md (Drive 1RTJKvCxEgvYvIayiHdruuTKfT9oXXpIo4oHzokeI-As)

## Critical analysis notes (from the providers' docs — read before using)

1. `total` in DowntownCounts_Monthly is the PUBLISHED, MULTIPLIER-ADJUSTED figure
   (individuals + tent_multiplier x tents + vehicle_multiplier x vehicles). Never sum
   `total` with the component rows. Components are a map-digitization product
   (secondary reliability, 2018+ only).
2. Post-2020, RTFH reports raw counts while DSDP continues multipliers — comparing
   DSDP totals to RTFH/PIT figures from 2020 on is adjusted-vs-unadjusted.
3. Block footprint expanded 261 -> 382 blocks in Jan 2022 (Barrio Logan, Golden Hill,
   Sherman Heights). Use BlockLevel_Counts_Panel261.csv for longitudinal analysis.
4. "East Village" in monthly counts != block-grid "East Village" (grid splits it).
   Join on the canonical `area` column / Area_Crosswalk.csv.
5. fellowship_month marks extra-volunteer months (10/12 in 2017, none after 2020) —
   a counting-effort confounder for 2017-2021 trends.
6. Outside Perimeter is null (not zero) before April 2021. Jul/Aug/Oct/Nov 2025 are
   true reporting gaps (no report published).
7. Two block centroids fall outside their own polygon — use polygon geometry, not
   centroids, for spatial joins.
