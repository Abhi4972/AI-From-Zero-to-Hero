---
title: MLOps on Snowflake: Feature Store, Model Registry, ML Observability and Scheduled Pipelines
minutes: 70
group: Governance and Snowflake-native MLOps
lessons: a3019, a0221
---
:::goals What you will be able to do
- Map every MLOps stage in these lessons to its Snowflake-native component
- Write the Snowpark ML code for feature views, point-in-time training sets, model logging and versioned inference
- Set up a model monitor for drift and performance, and schedule the pipeline with tasks
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (reference with code). **Time**: about 70 minutes.
- **To run the Snowflake code**: a Snowflake account with a warehouse, a database and schema you can create objects in, and `pip install snowflake-ml-python`. The code here is shown, not run, because it needs your account; the local section at the end runs anywhere.
:::

:::plain The idea in one line
When the data already lives in Snowflake, keep features, models, inference and monitoring there too: fewer copies of the data, one set of access controls, one place to audit.
:::

## The problem

Lakeside's customer data is in Snowflake. Their level-0 setup exports a CSV, trains on a laptop, and uploads scores back. Every copy is a governance gap and a source of skew. Snowflake now has native pieces for each stage; this lesson maps them and shows the calls, checked against Snowflake's documentation in November 2026.

| Stage (lesson) | Snowflake component |
|---|---|
| Features, point-in-time joins (32.6) | Feature Store: entities and feature views; `generate_training_set` / `generate_dataset` with a spine |
| Tracking and registry (32.3, 32.4) | Model Registry: `log_model` with versions, metrics, default version and aliases |
| Serving (32.9) | `mv.run()` in a warehouse, or deployment to Snowpark Container Services |
| Monitoring (32.11) | ML Observability: `CREATE MODEL MONITOR`, drift and performance functions |
| Pipelines (32.7) | Tasks and task graphs, dynamic tables, Snowflake ML Jobs |
| Validation (32.5) | Data metric functions on tables |
| Governance (32.13) | Role-based access, tags, access history, object lineage |

## Feature Store

```pyshow
from snowflake.ml.feature_store import FeatureStore, FeatureView, Entity, CreationOption

fs = FeatureStore(session=session, database="ML", name="FEATURES", default_warehouse="ML_WH",
                  creation_mode=CreationOption.CREATE_IF_NOT_EXIST)
customer = Entity(name="CUSTOMER", join_keys=["CUSTOMER_ID"])
fs.register_entity(customer)

tickets_df = session.sql("""
    SELECT customer_id, event_ts AS ts,
           COUNT(*) OVER (PARTITION BY customer_id ORDER BY event_ts
                          RANGE BETWEEN INTERVAL '90 days' PRECEDING AND CURRENT ROW) AS tickets_90d
    FROM raw.support_tickets""")

tickets_fv = FeatureView(name="TICKETS_90D", entities=[customer], feature_df=tickets_df,
                         timestamp_col="TS", refresh_freq="1 day", desc="Support tickets in the last 90 days")
tickets_fv = fs.register_feature_view(feature_view=tickets_fv, version="1")

# point-in-time training set: one row per customer and prediction date, features as of that date
spine = session.table("ml.labels.churn_spine")          # CUSTOMER_ID, AS_OF, CHURN
train_df = fs.generate_training_set(spine_df=spine, features=[tickets_fv],
                                    spine_timestamp_col="AS_OF", spine_label_cols=["CHURN"])
```

Setting `refresh_freq` makes it a Snowflake-managed feature view that refreshes on its own. A registered feature view's definition is immutable: change it by registering a new version, which is exactly the versioning discipline of lesson 32.2.

## Model Registry and inference

```pyshow
from snowflake.ml.registry import Registry
from snowflake.ml.model import task

reg = Registry(session=session, database_name="ML", schema_name="REGISTRY")
mv = reg.log_model(clf,                                   # a fitted scikit-learn, XGBoost, LightGBM or PyTorch model
                   model_name="LAKESIDE_CHURN",
                   version_name="V7",
                   conda_dependencies=["scikit-learn"],
                   sample_input_data=train_features.limit(10),
                   metrics={"auc": 0.81, "data_fingerprint": "sha256:9bcd64ce4b2cf2f5"},
                   comment="Logistic regression on 90-day tickets, tenure, contract",
                   task=task.Task.TABULAR_BINARY_CLASSIFICATION)

m = reg.get_model("LAKESIDE_CHURN")
print(m.show_versions())
mv.set_metric("test_auc_by_contract", {"month": 0.78, "year": 0.80})
m.default = "V7"                                          # what callers get when they do not name a version

scores = m.version("V7").run(customers_today, function_name="predict_proba")
```

Aliases are set in SQL, which is also how a CI pipeline would move them:

```sql
ALTER MODEL ml.registry.lakeside_churn VERSION v7 SET ALIAS = champion;
ALTER MODEL ml.registry.lakeside_churn SET DEFAULT_VERSION = 'V7';
-- inference from SQL, by alias (the result is an object; SHOW FUNCTIONS IN MODEL ... shows its fields)
SELECT customer_id,
       MODEL(ml.registry.lakeside_churn, champion)!predict_proba(tenure, monthly, tickets_90d, month_to_month) AS p
FROM ml.features.customers_today;
```

## ML Observability

A model monitor reads a table or view of logged predictions (and actuals when they arrive), compares it with a baseline, and refreshes on a schedule.

```sql
CREATE MODEL MONITOR lakeside_churn_monitor WITH
    MODEL = ml.registry.lakeside_churn
    VERSION = 'V7'
    FUNCTION = 'predict_proba'
    SOURCE = ml.monitoring.churn_predictions          -- customer_id, scored_at, features, p_churn, churned
    BASELINE = ml.monitoring.churn_baseline           -- the training-time snapshot; without it, no drift
    WAREHOUSE = ml_wh
    REFRESH_INTERVAL = '1 day'
    AGGREGATION_WINDOW = '7 days'
    TIMESTAMP_COLUMN = scored_at
    ID_COLUMNS = ('CUSTOMER_ID')
    PREDICTION_SCORE_COLUMNS = ('P_CHURN')
    ACTUAL_CLASS_COLUMNS = ('CHURNED')
    SEGMENT_COLUMNS = ('CONTRACT');

SELECT * FROM TABLE(MODEL_MONITOR_DRIFT_METRIC(
    'LAKESIDE_CHURN_MONITOR', 'PSI', 'MONTHLY', 'DAY',
    '2026-11-01'::TIMESTAMP_NTZ, '2026-11-28'::TIMESTAMP_NTZ));
```

Points from the documentation worth knowing before you design the source table: the timestamp column must be `TIMESTAMP_NTZ`; at least one prediction column is required; the aggregation window is in days; segments are limited to five string columns; and most settings cannot be changed after creation, so drop and recreate to change the source.

## Scheduling the pipeline

```sql
CREATE OR REPLACE TASK ml.ops.validate_daily WAREHOUSE = ml_wh SCHEDULE = 'USING CRON 0 5 * * * UTC'
  AS CALL ml.ops.validate_customers();                -- the data contract, as a stored procedure
CREATE OR REPLACE TASK ml.ops.score_daily WAREHOUSE = ml_wh AFTER ml.ops.validate_daily
  AS CALL ml.ops.score_customers();                   -- runs the champion with mv.run() and overwrites today's partition
ALTER TASK ml.ops.score_daily RESUME;
ALTER TASK ml.ops.validate_daily RESUME;
```

The scoring procedure should be idempotent (it overwrites today's partition rather than appending) and runs only after validation succeeds. Resume child tasks before the root, as above. The output fields of `predict_proba` depend on the model's signature; check them with `SHOW FUNCTIONS IN MODEL ... VERSION ...` before writing code that reads them.

## The same flow locally

The habits transfer even where Snowflake is not available. This local check confirms that the version-and-alias logic you will rely on behaves the way the SQL above assumes.

```python
registry = {"LAKESIDE_CHURN": {"versions": {"V6": {"auc": 0.79}, "V7": {"auc": 0.81}}, "aliases": {}, "default": None}}

def alter_alias(model, version, alias):
    m = registry[model]
    m["aliases"][alias] = version                     # an alias points at exactly one version
    return m["aliases"]

def resolve(model, ref):
    m = registry[model]
    return m["aliases"].get(ref) or (ref if ref in m["versions"] else m["default"])

alter_alias("LAKESIDE_CHURN", "V6", "champion"); registry["LAKESIDE_CHURN"]["default"] = "V6"
print("champion ->", resolve("LAKESIDE_CHURN", "champion"))
alter_alias("LAKESIDE_CHURN", "V7", "champion")
print("after promotion, champion ->", resolve("LAKESIDE_CHURN", "champion"), "| default still", resolve("LAKESIDE_CHURN", "nonexistent"))
```

Note the last line: moving an alias does not move the default version. Callers that use the default and callers that use the alias can end up on different versions, so pick one convention for production code (aliases) and enforce it in review.

:::check
Which statements are right?

- ✓ `generate_training_set` with `spine_timestamp_col` builds point-in-time correct training data.
- ✗ A model monitor can detect drift without a baseline.
  Without a baseline the monitor cannot compute drift.
- ✓ Moving an alias does not change the model's default version.
:::

:::recap What to keep
- Feature Store, Model Registry, ML Observability and tasks cover the lifecycle inside Snowflake.
- Version feature views and models; move aliases in SQL from CI.
- Design the monitor's source table first: timestamp type, prediction and actual columns, segments.
:::

## Exercises

1. Write the SQL view that joins daily scores to churn outcomes 60 days later, for the monitor's `SOURCE`.
2. Add a second feature view (monthly charges, refreshed daily) and generate a training set with both.
3. Design the roles: who may log models, who may move the `champion` alias, who may read predictions.

:::checked Sources and further reading
- [Snowflake Model Registry](https://docs.snowflake.com/en/developer-guide/snowflake-ml/model-registry/overview)
- [Working with feature views](https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/feature-views), Snowflake Feature Store
- [ML Observability: monitoring model behavior over time](https://docs.snowflake.com/en/developer-guide/snowflake-ml/model-registry/model-observability)
- [CREATE MODEL MONITOR](https://docs.snowflake.com/en/sql-reference/sql/create-model-monitor), Snowflake SQL reference
:::
