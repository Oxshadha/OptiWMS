from __future__ import annotations

import textwrap
import json
import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"


def md(text: str):
    return {"cell_type": "markdown", "metadata": {}, "source": textwrap.dedent(text).strip().splitlines(keepends=True)}


def code(text: str):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": textwrap.dedent(text).strip().splitlines(keepends=True)}


SETUP = """
from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

ROOT = Path.cwd()
if not (ROOT / "outputs").exists():
    ROOT = Path("Ai miroservices/modeling/project_operational_baseline").resolve()
OUT = ROOT / "outputs"
EVAL = OUT / "evaluator"
sns.set_theme(style="whitegrid")
"""


def _book(title: str, purpose: str, cells: list) -> dict:
    notebook_cells = [md(f"# {title}\n\n{purpose}"), code(SETUP), *cells]
    for index, cell in enumerate(notebook_cells):
        source = "".join(cell["source"])
        cell["id"] = hashlib.sha1(f"{title}:{index}:{source}".encode()).hexdigest()[:12]
    return {
        "cells": notebook_cells,
        "metadata": {
            "kernelspec": {"display_name": "OptiWMS Evaluator (Python 3.12)", "language": "python", "name": "optiwms-evaluator"},
            "language_info": {"name": "python", "version": "3.12"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


def build_notebooks() -> list[Path]:
    books = {
        "00_Data_Contract_And_Lineage.ipynb": _book(
            "Data Contract And Lineage",
            "Proves the exact generated operational dataset, row counts, stable hash, source boundary and relational coverage.",
            [
                code("manifest = json.loads((OUT / 'manifest.json').read_text())\nmanifest"),
                code("pd.DataFrame({'table': manifest['row_counts'].keys(), 'rows': manifest['row_counts'].values()}).sort_values('rows', ascending=False)"),
                code("materials = pd.read_csv(OUT / 'materials.csv.gz')\nmaterials.info()\ndisplay(materials.head())\ndisplay(materials.groupby(['material_type','category']).size().rename('rows').reset_index())"),
                md("**Claim boundary.** These rows are the permanent project-operational baseline because external customer history is unavailable. They are suitable for reproducible system validation, but they are not externally observed customer records."),
            ],
        ),
        "01_Generation_Methods_And_Causal_Proof.ipynb": _book(
            "Generation Methods And Causal Proof",
            "Documents fixed-seed generation, FG production dynamics, BOM explosion, latent shocks and leakage separation.",
            [
                code("production = pd.read_csv(OUT / 'production_history.csv.gz', parse_dates=['month'])\nbom = pd.read_csv(OUT / 'bom_components.csv.gz')\ndemand = pd.read_csv(OUT / 'demand_history.csv.gz', parse_dates=['month'])\ndisplay(production.describe(include='all').T)\ndisplay(bom.groupby('parent_code').size().describe())"),
                code("sample = production[production.parent_code.isin(production.parent_code.unique()[:4])]\nfig, ax = plt.subplots(figsize=(14,5))\nsns.lineplot(data=sample, x='month', y='actual_fg_units', hue='parent_code', ax=ax)\nax.set_title('Generated FG production with seasonality, regimes and shocks'); plt.show()"),
                code("check = demand.groupby('month')[['planned_bom_requirement','demand_units']].sum()\nprint('Spearman causal association:', check.corr(method='spearman').iloc[0,1])\ncheck.plot(figsize=(14,5), title='BOM requirement and resulting RM/PM issue demand'); plt.show()"),
                md("Generator-only latent noise and shock magnitudes are not model features. Models receive lagged demand, declared calendar/plan signals and master data only, preventing direct target leakage."),
            ],
        ),
        "02_RM_PM_EDA_And_Time_Series_Evidence.ipynb": _book(
            "RM/PM EDA And Time-Series Evidence",
            "Examines missingness, demand distributions, intermittency, seasonality, autocorrelation, scale variance and concentration before modeling.",
            [
                code("demand = pd.read_csv(OUT / 'demand_history.csv.gz', parse_dates=['month'])\nquality = pd.DataFrame({'missing': demand.isna().sum(), 'missing_pct': demand.isna().mean()*100})\ndisplay(quality[quality.missing.gt(0)])\ndisplay(demand.groupby('material_type').demand_units.describe(percentiles=[.5,.9,.95,.99]))"),
                code("summary = demand.groupby(['material_id','material_code','material_type']).demand_units.agg(['mean','std',lambda s:(s==0).mean()]).reset_index()\nsummary.columns=['material_id','material_code','material_type','mean','std','zero_share']\nfig, axes = plt.subplots(1,2,figsize=(14,5))\nsns.histplot(data=summary,x='mean',hue='material_type',log_scale=True,ax=axes[0])\nsns.scatterplot(data=summary,x='mean',y='std',hue='material_type',ax=axes[1]); plt.show()"),
                code("monthly = demand.groupby(['material_type','month']).demand_units.sum().reset_index()\nmonthly['month_of_year']=monthly.month.dt.month\nseason = monthly.groupby(['material_type','month_of_year']).demand_units.mean().reset_index()\nseason['index']=season.demand_units/season.groupby('material_type').demand_units.transform('mean')\nsns.lineplot(data=season,x='month_of_year',y='index',hue='material_type',marker='o'); plt.axhline(1,color='black',lw=1); plt.show()"),
                code("from statsmodels.graphics.tsaplots import plot_acf, plot_pacf\nfrom statsmodels.tsa.seasonal import STL\naggregate=demand.groupby('month').demand_units.sum().sort_index()\nfig,axes=plt.subplots(1,2,figsize=(14,5)); plot_acf(np.log1p(aggregate),lags=24,ax=axes[0]); plot_pacf(np.log1p(aggregate),lags=24,ax=axes[1],method='ywm'); plt.tight_layout(); plt.show()\ndecomposition=STL(np.log1p(aggregate),period=12,robust=True).fit(); decomposition.plot(); plt.suptitle('Robust STL decomposition of aggregate RM/PM demand'); plt.show()"),
                code("spectral=pd.read_csv(EVAL/'spectral_evidence.csv')\ndisplay(spectral.groupby('material_type')[['annual_power_ratio','seasonal_strength','adf_p_value','kpss_trend_p_value']].agg(['mean','median']))\ndisplay(spectral[['material_code','annual_power_ratio','annual_red_noise_fdr_p_value','annual_seasonality_evidence','stationarity_evidence']].sort_values('annual_power_ratio',ascending=False).head(20))"),
                code("from IPython.display import Image, display\ndisplay(Image(filename=str(EVAL/'plots'/'04_frequency_domain_evidence.png')))"),
                md("Annual/semiannual sine and cosine encodings remove the artificial December-to-January boundary. Frequency-domain summaries are calculated from each historical input window only; full-series periodograms are EDA evidence and are never injected into an earlier forecast origin."),
            ],
        ),
        "03_ABC_FMS_And_Layout_Evidence.ipynb": _book(
            "ABC/FMS And Layout Evidence",
            "Implements the supervisor report: cumulative issued volume for ABC, issue frequency for FMS, both calculated within RM/PM physical subtypes.",
            [
                code("classes=pd.read_csv(OUT/'material_classifications.csv.gz')\nthresholds=pd.read_csv(OUT/'classification_thresholds.csv.gz')\ndisplay(thresholds)\ndisplay(pd.crosstab(classes.abc_class, classes.fms_class, margins=True))"),
                code("matrix=classes.pivot_table(index='abc_class',columns='fms_class',values='material_id',aggfunc='count',fill_value=0)\nsns.heatmap(matrix,annot=True,fmt='g',cmap='YlGnBu'); plt.title('Amalgamated ABC/FMS material counts'); plt.show()"),
                code("for key, group in classes.groupby(['material_type','category']):\n    if len(group)>=5:\n        ordered=group.sort_values('issue_volume_12m',ascending=False)\n        assert ordered.cumulative_usage_share.is_monotonic_increasing\nprint('All subtype cumulative-volume classifications are monotonic and threshold evidence is persisted.')"),
            ],
        ),
        "04_Model_Selection_And_Untouched_Test.ipynb": _book(
            "Model Selection And Untouched Test",
            "Compares statistical and ML candidates using rolling origins, then evaluates the locked selection champion on a separate final window.",
            [
                code("leaderboard=pd.read_csv(OUT/'model_leaderboard.csv')\nsummary=json.loads((OUT/'forecast_evidence_summary.json').read_text())\ndisplay(leaderboard)\nsummary"),
                code("sns.barplot(data=leaderboard,x='WAPE',y='model_name',hue='split'); plt.axvline(.15,color='red',ls='--'); plt.show()"),
                code("paired=pd.read_csv(OUT/'paired_model_tests.csv')\ndisplay(paired)\nprint('Champion was selected only from the selection split:', summary['champion'])"),
                code("evaluator=json.loads((EVAL/'evaluator_run_summary.json').read_text())\nevaluator_board=pd.read_csv(EVAL/'model_leaderboard.csv')\nhypothesis=pd.read_csv(EVAL/'model_hypothesis_tests.csv')\ndisplay(evaluator_board[evaluator_board.population.eq('RM_PM_PRIMARY')])\ndisplay(evaluator_board[evaluator_board.population.eq('FG_SECONDARY')])\ndisplay(hypothesis)\nevaluator"),
            ],
        ),
        "04A_Conv1D_Attention_Challenger.ipynb": _book(
            "Global Conv1D Attention Challenger",
            "Reproduces the evaluator architecture with causal convolutions, self-attention, spectral and known-future branches, ordered quantiles, five deterministic seeds and a challenger-only promotion gate.",
            [
                md("""
                ## Architecture and claim boundary

                - Input: 24 historical months; direct output: H1-H12.
                - Two causal Conv1D layers use 3- and 6-month kernels.
                - Two residual four-head self-attention blocks learn non-local dependence.
                - Calendar, spectral, static and origin-known future features join after temporal pooling.
                - P10/P50/P90 and cost-sensitive quantiles are ordered by construction.

                Attention is descriptive, not a causal explanation. The network becomes champion only if locked pre-test evidence supports it.
                """),
                code("summary=json.loads((EVAL/'evaluator_run_summary.json').read_text())\nseed=pd.read_csv(EVAL/'neural_seed_stability.csv')\nablations=pd.read_csv(EVAL/'feature_group_ablations.csv')\ndisplay(pd.DataFrame([summary]).T)\ndisplay(seed.groupby('origin_month')[['WAPE','RMSE','epochs']].agg(['mean','std','min','max']))\ndisplay(ablations.sort_values('WAPE'))"),
                code("attention=pd.read_csv(EVAL/'attention_weights.csv')\nocclusion=pd.read_csv(EVAL/'lag_occlusion_sensitivity.csv')\npermutation=pd.read_csv(EVAL/'heldout_group_permutation.csv')\nfig,axes=plt.subplots(1,2,figsize=(14,5))\nsns.lineplot(data=attention,x='lag_position',y='mean_attention_weight',marker='o',ax=axes[0])\nsns.barplot(data=occlusion.sort_values('WAPE_increase',ascending=False).head(12),x='WAPE_increase',y='lag_position',orient='h',ax=axes[1]); plt.tight_layout(); plt.show()\ndisplay(permutation.sort_values('WAPE_increase',ascending=False))"),
                code("history=pd.read_csv(EVAL/'neural_training_history.csv')\nsns.lineplot(data=history,x='epoch',y='validation_loss',hue='origin_month',legend=False); plt.title('Validation loss by rolling origin and seed'); plt.show()"),
            ],
        ),
        "05_Residuals_Intervals_And_Risk.ipynb": _book(
            "Residuals, Intervals And Risk",
            "Tests whether forecast errors are centered, stable across scale and adequately covered by empirical prediction intervals.",
            [
                code("rows=pd.read_csv(OUT/'champion_test_backtest_rows.csv.gz',parse_dates=['origin_month'])\nfig,axes=plt.subplots(2,2,figsize=(14,10))\nsns.scatterplot(data=rows,x='prediction',y='residual',hue='material_type',alpha=.45,ax=axes[0,0]); axes[0,0].axhline(0,color='black')\nsns.histplot(rows.residual,kde=True,ax=axes[0,1])\nsns.lineplot(data=rows.groupby('origin_month').residual.mean().reset_index(),x='origin_month',y='residual',marker='o',ax=axes[1,0]); axes[1,0].axhline(0,color='black')\nsns.scatterplot(data=rows,x='prediction',y='absolute_error',hue='amalgamated_class',alpha=.4,legend=False,ax=axes[1,1]); plt.tight_layout(); plt.show()"),
                code("coverage=rows.groupby(['material_type','amalgamated_class']).interval_covered.agg(['mean','size']).reset_index()\ndisplay(coverage.sort_values('mean'))\nprint('Aggregate empirical coverage:',rows.interval_covered.mean())"),
                code("from scipy import stats\nprint('Jarque-Bera:',stats.jarque_bera(rows.residual))\nprint('Spearman |residual| vs fitted:',stats.spearmanr(rows.absolute_error,rows.prediction))"),
                code("assumptions=pd.read_csv(EVAL/'assumption_registry.csv')\nresidual_tests=pd.read_csv(EVAL/'residual_diagnostics.csv')\ncalibration=pd.read_csv(EVAL/'interval_calibration.csv')\ndisplay(assumptions)\ndisplay(residual_tests)\ndisplay(calibration)"),
            ],
        ),
        "06_Inventory_Policy_And_Slotting_Readiness.ipynb": _book(
            "Inventory Policy And Slotting Readiness",
            "Shows empirical lead-time `(s,S)` decisions, service classes, handling-unit rounding and physical space requirements used by the optimizer.",
            [
                code("policy=pd.read_csv(OUT/'inventory_policy.csv.gz')\nmaterials=pd.read_csv(OUT/'materials.csv.gz')\nlocations=pd.read_csv(OUT/'locations.csv.gz')\ndisplay(policy.groupby('amalgamated_class')[['target_service_level','safety_stock','required_handling_units']].agg(['mean','median','sum']))"),
                code("assert (policy.max_stock>=policy.min_stock).all()\nassert (policy.order_quantity%policy.units_per_handling_unit==0).all()\nprint('Policy feasibility checks passed.')\nprint('Required handling units:',policy.required_handling_units.sum(),'Available pallet-capacity units:',locations.max_pallet_capacity.sum())"),
                code("print('Required pallet positions:',policy.required_pallet_positions.sum(),'Available pallet positions:',locations.max_pallet_capacity.sum())\nsns.scatterplot(data=policy,x='expected_holding_cost',y='expected_shortage_cost',hue='amalgamated_class',alpha=.55); plt.xscale('symlog'); plt.yscale('symlog'); plt.show()"),
                code("cost=pd.read_csv(EVAL/'decision_cost_sensitivity.csv')\nprimary_cost=cost[cost.population.eq('RM_PM_PRIMARY')]\ndisplay(primary_cost.sort_values(['under_to_over_cost_ratio','weighted_total_cost_proxy']))\ndisplay(cost[cost.population.eq('FG_SECONDARY')].sort_values(['under_to_over_cost_ratio','weighted_total_cost_proxy']))\nsns.catplot(data=primary_cost,x='weighted_total_cost_proxy',y='model_name',col='under_to_over_cost_ratio',kind='bar',col_wrap=2,sharex=False,height=4); plt.show()"),
                md("The 1:1, 2:1, 3:1 and 5:1 results are sensitivity evidence. No cost ratio is promoted to a production objective until shortage, holding and service costs are supplied and approved."),
            ],
        ),
        "07_Executive_End_To_End_Evidence.ipynb": _book(
            "Executive End-To-End Evidence",
            "Presents the final claim boundary, dataset scale, forecast gate, planning outputs and operational lifecycle evidence.",
            [
                code("manifest=json.loads((OUT/'manifest.json').read_text())\nevidence=json.loads((OUT/'forecast_evidence_summary.json').read_text())\npd.DataFrame([{'dataset':manifest['dataset_version'],'hash':manifest['dataset_hash'],'materials':manifest['row_counts']['materials'],'locations':manifest['row_counts']['locations'],'orders':manifest['row_counts']['orders'],'tasks':manifest['row_counts']['tasks'],'champion':evidence['champion'],'test_wape':evidence['test_metrics']['WAPE'],'coverage':evidence['interval_empirical_coverage'],'promotion_status':evidence['promotion_status']}]).T"),
                code("for key,value in evidence['promotion_gate'].items(): print(('PASS' if value else 'FAIL'),key)"),
                code("evaluator=json.loads((EVAL/'evaluator_run_summary.json').read_text())\nclaims=pd.read_csv(EVAL/'claim_evidence_matrix.csv')\nassumptions=pd.read_csv(EVAL/'assumption_registry.csv')\ndisplay(pd.DataFrame([evaluator]).T)\ndisplay(claims)\ndisplay(assumptions[['assumption','status','evidence','action']])"),
                md("**Supported conclusion:** OptiWMS can execute a reproducible, statistically controlled warehouse lifecycle using the generated operational baseline. **Unsupported conclusion:** these results establish performance on an unseen external customer warehouse."),
            ],
        ),
    }
    paths = []
    for filename, notebook in books.items():
        path = ROOT / filename
        path.write_text(json.dumps(notebook, indent=1))
        paths.append(path)
    return paths


if __name__ == "__main__":
    for notebook_path in build_notebooks():
        print(notebook_path)
