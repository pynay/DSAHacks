# Block-level hotspot model benchmark

Generated `2026-08-21` by `python3 ml/hotspot_benchmark.py`.

## Result

The selected initializer is **`stacked_hotspot_ensemble`**: a fixed blend of graph diffusion,
spatial KDE, and Tweedie XGBoost. Against the last-observation baseline it lowers mean MAE
by 6.4% (paired Wilcoxon p=0.034) and Poisson
deviance by 78.9% (p=0.0005). Its MAE gain
over the graph/KDE hybrid is small, but its count calibration is better
(Poisson-deviance p=0.034); the ensemble also avoids the hybrid's
larger positive total bias. The composite rank averages seven forward-test criteria and
does not substitute for field validation. For routing, `top_10pct_capture` is the share of
actually observed individuals located in the 10% of blocks ranked highest. MAE and
Poisson deviance measure count calibration; centroid error measures whether the overall
hotspot moved to the right part of downtown.

| overall_rank | model | mae | rmse | poisson_deviance | spearman | top_10pct_capture | top_10pct_jaccard | centroid_error_km | total_bias_pct |
|---|---|---|---|---|---|---|---|---|---|
| 1 | stacked_hotspot_ensemble | 1.789 | 3.515 | 2.367 | 0.655 | 0.483 | 0.468 | 0.067 | 3.770 |
| 2 | hybrid_graph_kde | 1.798 | 3.533 | 2.380 | 0.653 | 0.483 | 0.468 | 0.065 | 5.223 |
| 3 | xgboost_tweedie | 1.801 | 3.610 | 2.411 | 0.656 | 0.486 | 0.466 | 0.074 | -0.590 |
| 4 | hurdle_gbm | 1.829 | 3.664 | 2.428 | 0.656 | 0.487 | 0.476 | 0.078 | 4.247 |
| 5 | graph_diffusion_gbm | 1.813 | 3.641 | 2.415 | 0.654 | 0.481 | 0.464 | 0.064 | 3.661 |
| 6 | temporal_feature_fusion_gbm | 1.818 | 3.646 | 2.436 | 0.654 | 0.484 | 0.457 | 0.062 | 3.879 |
| 7 | xgboost_poisson | 1.847 | 3.676 | 2.448 | 0.651 | 0.486 | 0.472 | 0.072 | 2.679 |
| 8 | decayed_spatial_kde | 1.880 | 3.568 | 2.493 | 0.633 | 0.490 | 0.470 | 0.079 | 9.908 |
| 9 | pooled_ridge | 1.721 | 3.513 | 2.646 | 0.653 | 0.480 | 0.454 | 0.075 | -28.665 |
| 10 | approx_lgcp_rff | 1.862 | 3.709 | 2.550 | 0.640 | 0.482 | 0.466 | 0.071 | 1.502 |
| 11 | online_gamma_poisson | 1.848 | 3.817 | 2.949 | 0.644 | 0.484 | 0.461 | 0.078 | 9.770 |
| 12 | last_observation | 1.911 | 3.980 | 11.223 | 0.569 | 0.480 | 0.461 | 0.074 | 4.767 |
| 13 | tweedie_regression | 2.043 | 4.764 | 2.694 | 0.640 | 0.484 | 0.455 | 0.116 | 14.004 |
| 14 | dynamic_negative_binomial | 1.947 | 3.896 | 2.687 | 0.628 | 0.479 | 0.449 | 0.085 | 0.854 |
| 15 | low_rank_var | 2.108 | 4.939 | 5.421 | 0.584 | 0.436 | 0.406 | 0.106 | -9.535 |

## Test design

- Target: visible individuals per downtown census block per monthly DSDP count.
- Panel: 50 monthly snapshots x 287 blocks
  (47 observed months, 3 documented imputed months).
- Evaluation: the final 12 observed months, one-step-ahead, expanding-window.
- Leakage control: every lag, rolling feature, spatial diffusion and tuning decision uses
  only data available before its test month. Imputed months are never test folds.
- Primary operational metric: actual-person capture in the predicted top 10% of blocks.
- Limitation: this is historical early-morning block-count accuracy, not yet a drone model.
  It contains no altitude, camera footprint, occlusion, detector recall, time-of-day or
  delivery-uptake labels.

## What was actually tested

- `last_observation`: previous-count persistence baseline.
- `decayed_spatial_kde`: recency-weighted spatial kernel surface; decay, bandwidth and
  spatial weight selected inside each training window.
- `online_gamma_poisson`: discounted conjugate count filter with spatial shrinkage.
- `pooled_ridge`: current model family's regularized autoregression, moved to block grain.
- `dynamic_negative_binomial`: regularized overdispersed count regression with lag,
  seasonal, spatial-diffusion and static features, recency weighting, and nested
  regularization selection.
- `approx_lgcp_rff`: random-Fourier approximation to a spatiotemporal latent Gaussian
  log-intensity, fit with a Poisson observation model and recent-count features.
- `hurdle_gbm`: separate nonlinear presence and positive-count models for the zero-heavy
  target.
- `tweedie_regression`: compound Poisson-Gamma regression that permits exact zeros and
  overdispersed positive values.
- `low_rank_var`: reduced-rank vector autoregression over learned spatial count patterns.
- `xgboost_poisson` / `xgboost_tweedie`: regularized boosted trees with count-aware losses.
- `graph_diffusion_gbm`: nonlinear feasibility surrogate using first/second graph
  diffusion lags. It tests whether graph signal helps; it is **not a full DCRNN**.
- `hybrid_graph_kde`: a fixed graph/KDE blend; its 75% graph weight
  was selected on six observed months before every reported test fold.
- `stacked_hotspot_ensemble`: blends the graph/KDE hybrid with Tweedie XGBoost; its
  75% hybrid weight was also selected entirely before the test folds.
- `temporal_feature_fusion_gbm`: nonlinear feasibility surrogate over static, known-future
  and observed inputs. It tests feature-fusion value; it is **not a full TFT**.

## Models gated by the data

| Model | Benchmark status | Gate before a meaningful trial |
|---|---|---|
| Full DCRNN/ST-GNN | Not scored as a full deep model | 50 snapshots provide too few whole-graph sequences. Collect regular 15-30 minute cell observations across many days; compare only after the graph baseline above beats persistence. |
| Full Temporal Fusion Transformer | Not scored as a full TFT | Needs substantially longer per-cell histories plus known-future covariates. Current monthly panel cannot establish whether attention generalizes. |
| DeepSTPP | Not trainable on this target | Requires event-level continuous locations and times. Expanding monthly block counts into fake individual events would fabricate data and invalidate the score. |
| Graph WaveNet / AGCRN / STAEformer | Research candidates, not scored | Their adaptive graphs and long temporal receptive fields are valuable after high-frequency cell sequences exist; on 50 snapshots their parameter count makes a forward test uninformative. |
| Neural CDE | Research candidate, not scored | Well matched to irregular drone timestamps later, but the current primary benchmark is monthly and only 50 steps long. |

Those models should be activated only after drone/ground observations provide timestamps,
camera footprints, calibrated detection probability, and repeated coverage. A full deep
model is not "more accurate" until it beats the same persistence/KDE/count baselines on
held-out future days **and** held-out cells.

## Deployment implication

Use the stacked ensemble to initialize the block/H3 intensity surface, then use an online
Gamma-Poisson filter as the live-feedback layer. It updates immediately after each
aggregate drone observation and carries a natural uncertainty state. The app implements
this demo loop through `POST /api/hotspots/observe`. Once repeated drone passes estimate
detection probability, replace its direct-count likelihood with a binomial-detection
observation model over a dynamic negative-binomial latent count.

Primary model references: [Graph WaveNet (IJCAI 2019)](https://www.ijcai.org/proceedings/2019/264),
[AGCRN (NeurIPS 2020)](https://proceedings.neurips.cc/paper/2020/hash/ce1aad92b939420fc17005e5461e6f48-Abstract.html),
[STGCN (IJCAI 2018)](https://www.ijcai.org/proceedings/2018/505),
[Neural CDE (NeurIPS 2020)](https://proceedings.neurips.cc/paper/2020/hash/4a5876b450b45371f6cfe5047ac8cd45-Abstract.html),
[PatchTST (ICLR 2023)](https://openreview.net/forum?id=Jbdc0vTOcol), and
[N-HiTS (AAAI 2023)](https://ojs.aaai.org/index.php/AAAI/article/view/25854).
