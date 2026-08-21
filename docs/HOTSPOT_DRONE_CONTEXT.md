# Parsel hotspot + drone system context

Last updated: 2026-08-21

Repository: `pynay/DSAHacks`

Working branch: `codex/hotspot-model-feedback`

This is the detailed model and drone handoff. For the current system boundary,
runtime responsibilities, and production evolution path, use
[`ARCHITECTURE.md`](ARCHITECTURE.md) as the source of truth. The root
[`README.md`](../README.md) is the canonical setup and operator entry point.

## Executive handoff

Parsel is a food-inventory, donation, allocation, and delivery application for
downtown San Diego. The product goal is to forecast where visible unhoused
populations are likely to concentrate, send a real or simulated drone to verify
aggregate demand with EyePop.ai, update the hotspot map from that observation,
and recommend how much food should be delivered. The dashboard should ultimately
show predicted people, verified people, food loaded, delivered, taken, returned,
and wasted.

The best model supported by the data currently available is:

- **Offline initializer:** `stacked_hotspot_ensemble`
  - 56.25% graph-diffusion gradient boosting
  - 18.75% recency-weighted spatial KDE
  - 25% Tweedie XGBoost
- **Live feedback layer:** an online Gamma-Poisson update over the block-level
  intensity surface.

This division is intentional. The ensemble provides a reasonable initial map;
each stabilized drone observation makes the map more current and can move the
six delivery centers immediately. A single deep model is not presently the best
choice because there are only 50 historical whole-map snapshots and 12 newer
panel snapshots.

## Intended operating loop

```text
predict block intensities
  -> choose highest-priority movable hotspot
  -> inspect and pack safe food
  -> fly real drone or 3D mission
  -> capture one stabilized EyePop count
  -> assimilate aggregate count into nearby blocks
  -> move/re-rank hotspots
  -> recalculate recommended food quantity
  -> complete safe handoff
  -> record uptake, surplus, return, and waste
```

Do not automatically submit every video frame. The same people occur across
many adjacent frames, so doing that would multiply-count them. Drone Ops instead
lets an operator select a target and explicitly apply one stabilized frame count.

## What is implemented

### Model research and evaluation

`ml/hotspot_benchmark.py` performs leakage-safe expanding-window evaluation on
the complete Source A block panel. It evaluates 15 executable candidates:

1. Last observation
2. Decayed spatial KDE
3. Online Gamma-Poisson
4. Pooled Ridge
5. Dynamic negative binomial
6. Approximate LGCP with random Fourier features
7. Hurdle gradient boosting
8. Tweedie regression
9. Low-rank VAR
10. XGBoost Poisson
11. XGBoost Tweedie
12. Graph-diffusion GBM
13. Graph/KDE hybrid
14. Stacked hotspot ensemble
15. Temporal feature-fusion GBM

The final 12 observed months are forward test folds. Selection uses MAE, RMSE,
Poisson deviance, Spearman rank correlation, top-10% observed-person capture,
top-10% hotspot Jaccard, weighted-centroid error, and total-count bias.

The selected ensemble achieved:

| Metric | Stacked ensemble | Last observation |
|---|---:|---:|
| MAE per block | 1.789 | 1.911 |
| Poisson deviance | 2.367 | 11.223 |
| Top-10% capture | 48.3% | 48.0% |
| Centroid error | 67 m | 74 m |
| Total bias | +3.8% | +4.8% |

This is a balanced operational selection. Pooled Ridge has lower raw MAE
(1.721) but underpredicts the total by 28.7%, which is unsafe for food allocation.
Spatial KDE has the highest top-10% capture but worse calibration and positive
bias. The ensemble is the best compromise across routing, calibration, and count
accuracy.

The full report and fold-level results are in:

- `docs/HOTSPOT_MODEL_BENCHMARK.md`
- `marts/hotspot_benchmark.csv`
- `marts/hotspot_benchmark_folds.csv`
- `marts/hotspot_benchmark_meta.json`

### Production seed model

`ml/hotspot_production.py` fits the selected architecture to the newer DSDP
261-block longitudinal panel and exports the server-runtime seed files.

Secondary validation on the newer panel:

| Metric | Ensemble | Last observation |
|---|---:|---:|
| Four-fold MAE | 1.618 | 1.690 |
| Four-fold Poisson deviance | 2.554 | 12.424 |

Outputs:

- `marts/hotspot_blocks.json`: 261 block predictions and Gamma prior state.
- `marts/hotspot_zones.json`: six initial movable hotspot centers.

The newest source observation is **2025-01-01**. The application therefore marks
the current forecast stale and asks for drone or ground verification before any
dispatch. The target month in the committed artifact is 2026-08.

### Application integration

- `src/lib/hotspotState.ts`
  - Loads block-level Gamma priors.
  - Accepts an aggregate observation.
  - Applies confidence- and coverage-aware updates to nearby blocks.
  - Recomputes six spatially separated hotspot centers.
  - Keeps only process-memory state for the current demo.
- `POST /api/hotspots/observe`
  - Validates and assimilates an aggregate drone or ground count.
  - Returns the accepted observation, updated zones, and model metadata.
- `GET /api/zones`
  - Returns model-derived zones plus neighborhood 311, tent, vehicle, and other
    context from the committed marts.
- Delivery page
  - Displays movable predicted hotspots, model/source information, stale-data
    warnings, and drone-updated status.
- Allocation page
  - Uses predicted hotspot demand by default.
  - Can optionally reweight the same hotspot positions with the separate 311
    pressure forecast.
- Drone Ops page
  - Displays the real EyePop bridge feed.
  - Lets an operator select a predicted target.
  - Applies one stabilized live count to the hotspot model and refreshes targets.

Example request:

```bash
curl -X POST http://localhost:3000/api/hotspots/observe \
  -H 'content-type: application/json' \
  -d '{
    "lat": 32.7097,
    "lng": -117.1545,
    "count": 42,
    "confidence": 0.88,
    "coverage": 0.90,
    "radiusKm": 0.18,
    "observedAt": "2026-08-21T12:00:00.000Z"
  }'
```

`count` must be an integer from 0 to 5000. `confidence` is in `(0, 1]`,
`coverage` is in `[0.05, 1]`, and `radiusKm` is in `[0.03, 2]`.

## Data currently available

### Primary count panels

- Historical Source A: 50 monthly snapshots × 287 blocks; 47 observed months
  and three documented imputed months.
- Modern DSDP panel: 12 monthly snapshots × 261 blocks, ending January 2025.

### Context and proxy data

- Downtown neighborhood monthly homelessness signals.
- 311/Get It Done request pressure.
- Tents and vehicles.
- Historical observed individuals and enforcement reports.
- Parking activity as a mobility/activity proxy.
- Block geometry and neighborhood crosswalks.

See `docs/DATA_SOURCE_CATALOG.md`, `docs/hackathon/PROVENANCE.md`, and
`docs/hackathon/DATA_DICTIONARY_hackathon.md` for provenance and limitations.
Bike, parking, transit, pedestrian, weather, event, shelter, and meal-service
signals are useful covariates, but none should be mislabeled as a headcount.

## Why the large deep models are gated

Graph WaveNet, AGCRN, STGCN/DCRNN, STAEformer, Temporal Fusion Transformer,
PatchTST, N-HiTS, Neural CDE, and DeepSTPP were researched. They should not be
presented as more accurate until their input requirements exist:

- Full graph neural networks and graph transformers need many regular
  whole-graph sequences, ideally 15-30 minute cells across many days.
- Neural CDE is a strong later candidate for irregular timestamped drone events.
- DeepSTPP needs continuous event-level times and locations. Expanding aggregate
  counts into fake person events would fabricate training data.
- Transformers need longer per-cell histories and known-future covariates than
  the current panels provide.

After adequate drone data exists, compare these models using held-out future days
**and** held-out spatial cells. Do not select on random train/test splits.

## Highest-value next work

### P0: Persist the feedback loop

Replace process-memory state with durable tables. At minimum record:

```text
drone_observations:
  observation_id, mission_id, zone_id, observed_at,
  latitude, longitude, altitude_m,
  footprint_radius_km, coverage,
  raw_frame_count, deduplicated_count,
  detector_confidence, detector_version,
  human_corrected_count

mission_outcomes:
  mission_id, predicted_people, verified_people,
  servings_recommended, servings_loaded,
  servings_delivered, servings_taken,
  servings_returned, servings_wasted,
  handoff_status, completed_at
```

Use aggregate observations only. Do not persist faces, identities, embeddings,
or person-level trajectories.

### P1: Use real drone location and footprint

Drone Ops currently applies the EyePop count to the selected target coordinates.
The next integration should send actual GPS, altitude, camera field of view,
footprint polygon, and observation coverage from telemetry. That makes the
Bayesian update spatially correct.

### P1: Finish the operational dashboard

Display, per mission:

- Forecast versus verified count.
- Lower/upper forecast interval.
- Food recommended, approved, loaded, delivered, taken, returned, and wasted.
- Model version, source timestamp, observation timestamp, and human correction.
- Why a recommendation changed after feedback.

Inventory should decrement at an approved handoff or recorded distribution—not
merely when a drone is dispatched.

### P2: Collect training data

For at least 4-8 weeks, collect repeated observations at regular service windows
and retain weather, event, shelter/meal-service schedules, camera coverage, and
delivery outcomes. Then benchmark:

1. Current stacked ensemble + Gamma-Poisson updater.
2. Dynamic negative-binomial state-space model with a detection/coverage layer.
3. Graph WaveNet or AGCRN for regular sequences.
4. Neural CDE for irregular sequences.

Promote a replacement only if it improves routing capture, calibrated count
error, and uncertainty on forward-time and held-out-location tests.

## Safety and product boundaries

- EyePop detections estimate visible people; they are not identities, complete
  population counts, or evidence of consent.
- Occlusion, lighting, altitude, camera angle, and detector recall can bias a
  count. Always show confidence and allow human correction.
- Deliver food through an authorized distribution point or ground partner. Do
  not drop packages directly on or near detected people.
- A vision system may quarantine suspect food for review, but a person should
  approve disposal. The drone should not autonomously remove food.
- The January 2025 source data is stale. Drone/ground verification is required
  before using the estimate operationally.

## Reproduction and validation

```bash
python3 -m pip install -r ml/requirements.txt
python3 ml/hotspot_benchmark.py
python3 ml/hotspot_production.py
python3 -m pytest -q

npm install
npm test
npx tsc --noEmit
npm run lint
npx next build --webpack
```

Validation at the time of this handoff:

- 46 Python tests passed.
- 28 frontend tests passed.
- TypeScript passed.
- Production webpack build passed.
- Live `POST /api/hotspots/observe` smoke test returned HTTP 200 and moved or
  reweighted all six zones.
- ESLint has one warning inherited from `src/app/food-check/page.tsx` and no
  errors in the hotspot implementation.

## Current Git state

- Remote branch: `codex/hotspot-model-feedback`
- Latest pushed commit at handoff: `0ab2591`
- Direct PR creation was blocked by the installed GitHub integration with HTTP
  403. The branch itself is pushed and can be opened as a PR against `main`.
