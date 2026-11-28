---
title: The ML Lifecycle on Snowflake: Experiments, Datasets, Feature Store, Model Registry, Lineage, Code Bundles and Model Monitors
minutes: 70
group: Quality, ML and serving
lessons: a3325, a3214
---
:::goals What you will be able to do
- Track runs with Experiments, freeze training data as versioned Datasets, and define features once in the Feature Store (declarative, offline and online)
- Register models with versions and metadata, run them in batch, and follow lineage from source table to served prediction
- Monitor a model in production for drift and performance with a model monitor, and package code with Code Bundles
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
A model on Snowflake is not a file: it is a chain of objects (features, datasets, experiment runs, model versions, monitors) that Snowflake can link, version and govern like everything else.
:::

## The problem

Brightwell's demand model was retrained by hand from a notebook. When forecasts drifted, nobody could say which data version trained the current model, which features it used, or when it started to degrade.

## The objects and their status

| Stage | Snowflake object or tool | Status (2026) |
|---|---|---|
| Track runs | ML **Experiments**: parameters, metrics and artifacts per run, compared in Snowsight | GA 19 Feb |
| Freeze data | **Datasets** (`SNOWFLAKE.ML.DATASET`): immutable, versioned snapshots; also used by AI Function evaluation (lesson 33.11) | GA |
| Define features | **Feature Store**: entities, feature views (backed by dynamic tables), point-in-time correct training sets | GA |
| Features as code | **Declarative Feature Store**: YAML or Python specs, plan and apply with `snow feature` | GA 21 Oct |
| Low-latency features | **Online Feature Store** for real-time serving | Preview 10 Jul, GA 20 Oct |
| Train | ML Jobs on the Container Runtime (lesson 33.25); custom runtime images | Images GA 22 Oct |
| Package code | **Code Bundles**: non-SQL code packaged as an object, used by ML Jobs (formerly notebook project objects) | GA 19 Nov |
| Register | **Model Registry**: versions, metrics, aliases such as `PRODUCTION`, warehouse or container inference | GA |
| Trace | **ML Lineage**: source tables to feature views, datasets, models and services; extended to model monitors and Cortex Search in Oct 2026 | GA |
| Watch | **Model monitors** (ML Observability): drift, performance and statistics over time | GA |

## The chain in code

```pyshow
from snowflake.ml.feature_store import FeatureStore, Entity, FeatureView, CreationMode
from snowflake.ml.registry import Registry

fs = FeatureStore(session, database="ML", name="FEATURES", default_warehouse="ML_WH", creation_mode=CreationMode.CREATE_IF_NOT_EXIST)
store = Entity(name="STORE", join_keys=["STORE_ID"])
fs.register_entity(store)
fv = FeatureView(name="STORE_WEEKLY", entities=[store], feature_df=weekly_features_df, refresh_freq="1 day")
fv = fs.register_feature_view(fv, version="V1")

train = fs.generate_dataset(name="ML.DATA.DEMAND_TRAIN", spine_df=spine_df, features=[fv], version="2026_11")   # point-in-time join, frozen

reg = Registry(session=session, database_name="ML", schema_name="REGISTRY")
mv = reg.log_model(model, model_name="DEMAND_FORECAST", version_name="V4",
                   sample_input_data=train.read.to_pandas().drop(columns=["UNITS"]).head(100),
                   metrics={"mae_holdout": 2.06, "naive_mae": 2.99}, comment="Trained on DEMAND_TRAIN 2026_11")
predictions = mv.run(scoring_df, function_name="predict")            # batch scoring in the warehouse
```

```sql
CREATE MODEL MONITOR ml.monitoring.demand_monitor WITH
  MODEL = ml.registry.demand_forecast  VERSION = 'V4'  FUNCTION = 'predict'
  SOURCE = ml.monitoring.demand_scored          -- predictions joined to actuals as they arrive
  BASELINE = ml.monitoring.demand_baseline      -- the training-time distribution
  TIMESTAMP_COLUMN = scored_at
  PREDICTION_SCORE_COLUMNS = (prediction)  ACTUAL_SCORE_COLUMNS = (actual_units)
  ID_COLUMNS = (row_id)
  WAREHOUSE = ml_wh  REFRESH_INTERVAL = '1 day'  AGGREGATION_WINDOW = '1 day';
```

A model monitor's source and model cannot be changed after creation, so create a new monitor for a new version. For real-time services, inference logs can be captured automatically and become the monitor's source.

## Locally: drift with the population stability index

```python
import numpy as np
r = np.random.default_rng(3)
baseline = r.normal(100, 15, 20_000)                 # a feature at training time (weekly units)
weeks = {"week 1": r.normal(100, 15, 2_000), "week 6": r.normal(107, 17, 2_000), "week 12": r.normal(118, 22, 2_000)}

def psi(expected, actual, bins=10):
    edges = np.quantile(expected, np.linspace(0, 1, bins + 1)); edges[0], edges[-1] = -np.inf, np.inf
    e = np.histogram(expected, edges)[0] / len(expected)
    a = np.histogram(actual, edges)[0] / len(actual)
    e, a = np.clip(e, 1e-6, None), np.clip(a, 1e-6, None)
    return float(np.sum((a - e) * np.log(a / e)))

for w, x in weeks.items():
    v = psi(baseline, x)
    verdict = "stable" if v < 0.1 else ("watch" if v < 0.25 else "investigate and consider retraining")
    print(f"{w:8} PSI {v:.3f}  -> {verdict}")
```

The thresholds (0.1 and 0.25) are a common industry rule of thumb, not a Snowflake default. Drift alone does not prove the model is worse: check the monitor's performance metrics against actuals before retraining, and retrain from a new Dataset version so the next lineage graph shows exactly what changed.

## Models you did not train here

The registry accepts many model types directly: scikit-learn, XGBoost, LightGBM, CatBoost, Prophet, PyTorch, TensorFlow, Keras, MLflow, Sentence Transformers and LoRA adapters, plus custom model classes for anything else. **Hugging Face** models can be imported from Snowsight or logged as a pipeline (preview): `huggingface.TransformersPipeline(task="text-classification", model="ProsusAI/finbert")` passed to `reg.log_model`. Warehouses have no GPUs, so serve larger models from a compute pool (lesson 33.27), and downloading weights from a notebook needs an external access integration.

:::check
Which statements are right?

- ✓ A Dataset is an immutable, versioned snapshot, so a training run can be reproduced.
- ✗ A model monitor can be pointed at the next model version with `ALTER`.
  The model and source are fixed at creation; create a new monitor.
- ✓ ML Lineage links source tables, feature views, datasets, models and services.
:::

:::recap What to keep
- Experiments, Datasets, Feature Store (declarative and online), ML Jobs, Code Bundles, Registry, Lineage, monitors.
- Generate training data with point-in-time joins and freeze it as a Dataset version.
- Monitor drift and performance; retrain from a new Dataset version, register a new model version, create a new monitor.
:::

## Exercises

1. Change week 12's distribution until PSI crosses 0.25 with the mean unchanged. What changed instead?
2. Write the declarative spec (in prose) for the `STORE_WEEKLY` feature view and the review step before `apply`.
3. Which lineage question would have saved Brightwell the most time in the last incident?

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [End-to-end ML workflow](https://www.snowflake.com/en/developers/guides/end-to-end-ml-workflow/) (Snowflake guide)
- [Develop and manage ML models with Feature Store and Model Registry](https://www.snowflake.com/en/developers/guides/develop-and-manage-ml-models-with-feature-store-and-model-registry/) (Snowflake guide)
- [Scheduled retraining with a task graph and a quality gate](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/ml-pipeline-orchestration) (Cortex AI Cookbook)

:::checked Sources and further reading
- [Snowflake Feature Store](https://docs.snowflake.com/developer-guide/snowflake-ml/feature-store/overview), [declarative feature store](https://docs.snowflake.com/developer-guide/snowflake-ml/feature-store/feature-development-lifecycle) and [online features](https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/online-feature-store)
- [ML Lineage](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-lineage)
- [Run ML Jobs with Code Bundles](https://docs.snowflake.com/en/developer-guide/code-bundles/ml-code-bundles)
- Snowflake release notes 2026: Machine learning experiments (19 Feb), Online Feature Store (10 Jul, 20 Oct), Declarative Feature Store (21 Oct), Code Bundles (19 Nov)
:::
