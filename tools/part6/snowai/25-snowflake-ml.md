---
title: Classic ML on Snowflake: Snowpark DataFrames, Notebooks on the Container Runtime and ML Jobs
minutes: 65
group: Quality, ML and serving
lessons: a3214, a3022, a0213
---
:::goals What you will be able to do
- Prepare features where the data lives with Snowpark, and pull only what training needs
- Choose between a warehouse, a notebook on the container runtime and an ML Job for each part of the work
- Run training as an ML Job on a compute pool and hand the model to the registry (lesson 33.26)
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
:::

:::plain The idea in one line
Push the heavy data work into Snowflake, train where the right compute is (warehouse for SQL, container runtime for Python and GPUs), and keep every step reproducible as a job.
:::

## The problem

Brightwell wants a weekly demand forecast per SKU and store: 2,400 SKUs, 60 stores, three years of daily sales, around 150 million rows. The first attempt pulled every daily row into a laptop with `to_pandas()` and ran out of memory before training started.

## Where each step runs

| Step | Run it in | Why |
|---|---|---|
| Filtering, joins, weekly aggregates, lags | Snowpark DataFrames or SQL on a warehouse | Scales with the warehouse; data never leaves |
| Exploration and prototyping in Python | Notebooks in Workspaces on the Container Runtime (GA 5 Feb 2026; the older notebooks are now "Legacy Snowflake Notebooks") | Python packages and GPUs, next to the data; compute monitoring and run observability since July 2026 |
| Scheduled or large training | ML Jobs on a compute pool | Repeatable, versioned code; CPU or GPU; multi-node if needed |
| Registry, features, monitoring | Experiments, Datasets, Feature Store, Model Registry, model monitors | Lesson 33.26 |

## Snowpark: aggregate before you pull

```pyshow
from snowflake.snowpark import functions as F, Window
sales = session.table("RETAIL.CORE.DAILY_SALES")             # 150M rows stay in Snowflake
weekly = (sales.with_column("WEEK", F.date_trunc("week", F.col("SALE_DATE")))
               .group_by("SKU", "STORE_ID", "WEEK").agg(F.sum("UNITS").alias("UNITS")))
w = Window.partition_by("SKU", "STORE_ID").order_by("WEEK")
features = (weekly.with_column("LAG_1", F.lag("UNITS", 1).over(w))
                  .with_column("LAG_52", F.lag("UNITS", 52).over(w))
                  .with_column("ROLL_4", F.avg("UNITS").over(w.rows_between(-4, -1))))
features.write.save_as_table("RETAIL.ML.DEMAND_FEATURES", mode="overwrite")   # about 22M rows: weekly, not daily
```

## ML Jobs: training as a job

```pyshow
from snowflake.ml.jobs import remote

@remote("ML_CPU_POOL", stage_name="ML_PAYLOADS", session=session)
def train_demand(table: str, cutoff: str):
    import lightgbm as lgb
    from snowflake.snowpark import Session
    s = Session.builder.getOrCreate()
    df = s.table(table).to_pandas()
    train, valid = df[df.WEEK < cutoff], df[df.WEEK >= cutoff]
    X = ["LAG_1", "LAG_52", "ROLL_4"]
    model = lgb.LGBMRegressor(n_estimators=400).fit(train[X], train.UNITS)
    return {"model": model, "mae": float((model.predict(valid[X]) - valid.UNITS).abs().mean())}

job = train_demand("RETAIL.ML.DEMAND_FEATURES", "2026-08-01")
print(job.status); result = job.result()            # blocks until done; job.get_logs() for output
```

`submit_file` and `submit_directory` run scripts and packages the same way, with `pip_requirements` and `args`; `parallel=True` and multi-node jobs cover larger training. Pin the runtime environment so a rerun next quarter uses the same libraries (lesson 32.2).

## Locally: what pushing down saves

```python
def plan(rows, bytes_per_row, filter_share, agg_ratio, transfer_mb_s=40, laptop_gb=16):
    raw_gb = rows * bytes_per_row / 1e9
    pulled_raw = {"rows": rows, "gb": round(raw_gb, 1), "transfer_min": round(raw_gb * 1000 / transfer_mb_s / 60, 1),
                  "fits_in_laptop": raw_gb * 3 < laptop_gb}                   # pandas needs roughly 3x the raw size
    pushed = rows * filter_share * agg_ratio
    pushed_gb = pushed * bytes_per_row / 1e9
    pulled_feat = {"rows": int(pushed), "gb": round(pushed_gb, 2), "transfer_min": round(pushed_gb * 1000 / transfer_mb_s / 60, 2),
                   "fits_in_laptop": pushed_gb * 3 < laptop_gb}
    return pulled_raw, pulled_feat

raw, feat = plan(rows=150_000_000, bytes_per_row=60, filter_share=0.6, agg_ratio=1 / 7)
print("pull daily rows:        ", raw)
print("aggregate in Snowflake: ", feat)
```

Aggregating to weekly and keeping only active SKUs in Snowflake shrinks what Python must touch by more than ten times. Even then, training on 13 million rows is better done in an ML Job on a compute pool than on a laptop, because it becomes scheduled, logged and repeatable.

:::check
Which statements are right?

- ✓ Joins and aggregations should run in Snowflake before data is pulled into Python.
- ✗ Notebooks are the right place for scheduled production training.
  Use ML Jobs: versioned code, pinned runtime, logs and results.
- ✓ `job.result()` blocks until the job finishes and returns the function's return value.
:::

:::recap What to keep
- Push down filtering, joins and aggregation with Snowpark.
- Notebooks to explore; ML Jobs to train repeatably on compute pools.
- Hand models to the registry and monitor them (lesson 33.26); package job code as Code Bundles.
:::

## Exercises

1. Change `filter_share` to 0.2 (only fast movers). What does that do to training size, and what risk does it add?
2. Rewrite `train_demand` as a `submit_file` script that writes its metrics to a table.
3. List what you would log for each training job so it can be reproduced (lesson 32.2).

:::checked Sources and further reading
- [Snowflake ML Jobs](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-jobs/overview)
- [Snowpark Python DataFrames](https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes)
- [Snowflake Model Registry](https://docs.snowflake.com/en/developer-guide/snowflake-ml/model-registry/overview)
:::
