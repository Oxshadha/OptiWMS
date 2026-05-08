# Forecast Leaderboard Round Log

Purpose: preserve every leaderboard round so reruns do not lose prior results.

Each entry stores:
- the exact source leaderboard file,
- an archived CSV snapshot,
- a ranked summary table.

## ROUND-20260420T141853Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T141853Z_portable_fair_play_leaderboard.csv`
- Note: Baseline capture before next rerun; portable fair-play leaderboard.

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 2 | P | ETS | test | 0 | 3456 | 0.279660 | 2891.550 | 61.659 | 0.947901 | 0.427662 |
| 3 | P | RANDOM_FOREST | test | 0 | 41472 | 0.297371 | 2978.164 | 161.123 | 0.952498 | 0.374445 |
| 4 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 5 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 6 | P | LIGHTGBM | test | 0 | 41472 | 0.531594 | 4446.457 | 266.395 | 1.471762 | 0.397304 |
| 7 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

## ROUND-20260420T143456Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T143456Z_portable_fair_play_leaderboard.csv`
- Note: 04_fair_play_model_comparison rerun; winner=ARIMA

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 2 | P | ETS | test | 0 | 3456 | 0.279660 | 2891.550 | 61.659 | 0.947901 | 0.427662 |
| 3 | P | RANDOM_FOREST | test | 0 | 41472 | 0.297371 | 2978.164 | 161.123 | 0.952498 | 0.374445 |
| 4 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 5 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 6 | P | LIGHTGBM | test | 0 | 41472 | 0.531594 | 4446.457 | 266.395 | 1.471762 | 0.397304 |
| 7 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

## ROUND-20260420T150954Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T150954Z_portable_fair_play_leaderboard.csv`
- Note: 04_fair_play_model_comparison rerun; winner=ARIMA

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 2 | P | ETS | test | 0 | 3456 | 0.279660 | 2891.550 | 61.659 | 0.947901 | 0.427662 |
| 3 | P | RANDOM_FOREST | test | 0 | 41472 | 0.297371 | 2978.164 | 161.123 | 0.952498 | 0.374445 |
| 4 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 5 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 6 | P | LIGHTGBM | test | 0 | 41472 | 0.531594 | 4446.457 | 266.395 | 1.471762 | 0.397304 |
| 7 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

## ROUND-20260420T162746Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T162746Z_portable_fair_play_leaderboard.csv`
- Note: 04_fair_play_model_comparison rerun; winner=ARIMA

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 2 | P | ETS | test | 0 | 3456 | 0.279660 | 2891.550 | 61.659 | 0.947901 | 0.427662 |
| 3 | P | RANDOM_FOREST | test | 0 | 41472 | 0.297371 | 2978.164 | 161.123 | 0.952498 | 0.374445 |
| 4 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 5 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 6 | P | LIGHTGBM | test | 0 | 41472 | 0.531594 | 4446.457 | 266.395 | 1.471762 | 0.397304 |
| 7 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

## ROUND-20260420T182338Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/portable_fair_play_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T182338Z_portable_fair_play_leaderboard.csv`
- Note: 04_fair_play_model_comparison rerun; winner=ARIMA

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 2 | P | ETS | test | 0 | 3456 | 0.279660 | 2891.550 | 61.659 | 0.947901 | 0.427662 |
| 3 | P | RANDOM_FOREST | test | 0 | 41472 | 0.297371 | 2978.164 | 161.123 | 0.952498 | 0.374445 |
| 4 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 5 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 6 | P | LIGHTGBM | test | 0 | 41472 | 0.531594 | 4446.457 | 266.395 | 1.471762 | 0.397304 |
| 7 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

## ROUND-20260420T200411Z
- Source leaderboard: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/pv2_external_ablation_full_leaderboard.csv`
- Archived snapshot: `/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/reports/history/leaderboards/20260420T200411Z_pv2_external_ablation_full_leaderboard.csv`
- Note: Full fair-play A/B run for `P` (base portable) vs `PV2` (external-signals enriched), same model family and split protocol.

### Ranked Summary
| Rank | Dataset | Model | Split | Horizon | n_obs | WAPE | RMSE | Bias | MASE | Under-forecast |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | PV2 | CATBOOST | test | 0 | 13824 | 0.193944 | 465.608 | -31.216 | 0.916691 | 0.488715 |
| 2 | PV2 | ARIMA | test | 0 | 1152 | 0.205663 | 506.522 | -60.842 | 0.972827 | 0.513021 |
| 3 | PV2 | XGBOOST | test | 0 | 13824 | 0.207437 | 496.855 | -20.959 | 0.972814 | 0.493128 |
| 4 | PV2 | ETS | test | 0 | 1152 | 0.245244 | 580.740 | -86.640 | 1.166462 | 0.545139 |
| 5 | P | ARIMA | test | 0 | 3456 | 0.269123 | 2745.101 | 60.652 | 0.837422 | 0.416377 |
| 6 | PV2 | SARIMA | test | 0 | 1152 | 0.275878 | 670.236 | -20.554 | 1.306188 | 0.537326 |
| 7 | P | ETS | test | 0 | 3456 | 0.289864 | 2890.399 | 16.072 | 0.954068 | 0.427662 |
| 8 | P | CATBOOST | test | 0 | 41472 | 0.320995 | 2971.725 | 112.331 | 7.850909 | 0.310836 |
| 9 | P | XGBOOST | test | 0 | 41472 | 0.321966 | 3190.205 | 167.419 | 1.792354 | 0.352021 |
| 10 | P | SARIMA | test | 0 | 3456 | 27.073855 | 2493513.908 | 48738.717 | 1124.788645 | 0.424190 |

### A/B Delta Summary (PV2 minus P)
| Model | delta WAPE | delta RMSE | delta MASE |
|---|---:|---:|---:|
| CATBOOST | -0.127051 | -2506.117 | -6.934219 |
| XGBOOST | -0.114529 | -2693.350 | -0.819540 |
| ARIMA | -0.063461 | -2238.578 | +0.135404 |
| ETS | -0.044620 | -2309.659 | +0.212394 |
| SARIMA | -26.797977 | -2492843.672 | -1123.482457 |
