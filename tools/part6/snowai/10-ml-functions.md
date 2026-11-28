---
title: ML Functions in SQL: FORECAST, ANOMALY_DETECTION, CLASSIFICATION and TOP_INSIGHTS
minutes: 60
group: AI in SQL: Cortex AI Functions
lessons: a0220, a0209
---
:::goals What you will be able to do
- Train and use forecasting and anomaly-detection models entirely in SQL, for one series or thousands
- Read prediction intervals, evaluation metrics and feature importance before trusting a forecast
- Know when ML Functions are enough and when to move to Snowflake ML in Python (lesson 33.25)
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
For the common analytical ML tasks (forecast a metric, flag unusual values, classify rows, explain a change) Snowflake offers model classes you create and call with SQL, no Python required.
:::

## The problem

Brightwell's finance analysts want next quarter's returns per store, and the operations team wants an alert when a store's daily returns jump. Neither team writes Python, and a data-science project for each request would take weeks.

## The four ML Functions

| Class | Task | Needs time series? |
|---|---|---|
| `SNOWFLAKE.ML.FORECAST` | Predict future values, single or many series, optional extra (exogenous) columns | Yes |
| `SNOWFLAKE.ML.ANOMALY_DETECTION` | Flag values outside the expected range, supervised or unsupervised | Yes |
| `SNOWFLAKE.ML.CLASSIFICATION` | Sort rows into two or more classes | No |
| `SNOWFLAKE.ML.TOP_INSIGHTS` | Find dimensions and values driving a change in a metric | No |

They are schema objects: you create one with training data, then call its methods with `!`. Costs are compute and the storage of trained model instances, so drop models you no longer use.

```sql
-- many series at once: one model per store
CREATE OR REPLACE SNOWFLAKE.ML.FORECAST retail.ml.returns_forecast(
  INPUT_DATA => TABLE(retail.ml.daily_returns_by_store),       -- store_id, day, returns (+ optional exogenous columns)
  SERIES_COLNAME => 'store_id',
  TIMESTAMP_COLNAME => 'day',
  TARGET_COLNAME => 'returns');

CALL retail.ml.returns_forecast!FORECAST(SERIES_VALUE => TO_VARIANT('S014'), FORECASTING_PERIODS => 90,
                                          CONFIG_OBJECT => {'prediction_interval': 0.9});
CALL retail.ml.returns_forecast!SHOW_EVALUATION_METRICS();      -- out-of-sample error per series
CALL retail.ml.returns_forecast!EXPLAIN_FEATURE_IMPORTANCE();
CALL retail.ml.returns_forecast!SHOW_TRAINING_LOGS();           -- series that failed to fit

CREATE OR REPLACE SNOWFLAKE.ML.ANOMALY_DETECTION retail.ml.returns_anomaly(
  INPUT_DATA => TABLE(retail.ml.daily_returns_history), SERIES_COLNAME => 'store_id',
  TIMESTAMP_COLNAME => 'day', TARGET_COLNAME => 'returns', LABEL_COLNAME => '');     -- '' means unsupervised
CALL retail.ml.returns_anomaly!DETECT_ANOMALIES(
  INPUT_DATA => TABLE(retail.ml.daily_returns_last_week), SERIES_COLNAME => 'store_id',
  TIMESTAMP_COLNAME => 'day', TARGET_COLNAME => 'returns', CONFIG_OBJECT => {'prediction_interval': 0.995});
```

`FORECAST` returns `SERIES`, `TS`, `FORECAST`, `LOWER_BOUND` and `UPPER_BOUND` (the interval defaults to 0.95); `DETECT_ANOMALIES` adds `Y`, `IS_ANOMALY`, `PERCENTILE` and `DISTANCE`, with a default interval of 0.99, where a higher value flags fewer anomalies. Schedule the detection call in a task and alert on `IS_ANOMALY` to get a monitoring job with no Python.

## Locally: what the interval means and how to judge a forecast

```python
import numpy as np, pandas as pd
r = np.random.default_rng(7)
days = pd.date_range("2025-01-01", periods=730, freq="D")
weekly = 1 + 0.35 * (days.day_of_week >= 5)                          # weekend returns are higher
trend = np.linspace(20, 26, len(days))
y = np.round(trend * weekly + r.normal(0, 2.5, len(days)), 1)
train, test = y[:-60], y[-60:]

# a simple seasonal model of the kind a forecasting function fits: trend + day-of-week effect + residual spread
t = np.arange(len(train))
dow = days[:-60].day_of_week
coef = np.polyfit(t, train / np.array([np.mean(train[dow == d]) / np.mean(train) for d in dow]), 1)
season = np.array([np.mean(train[dow == d]) / np.mean(train) for d in range(7)])
fit = np.polyval(coef, t) * season[dow]
resid_sd = np.std(train - fit)
tf = np.arange(len(train), len(y)); dow_f = days[-60:].day_of_week
fc = np.polyval(coef, tf) * season[dow_f]
for level, z in [(0.80, 1.2816), (0.95, 1.96), (0.99, 2.5758)]:
    lo, hi = fc - z * resid_sd, fc + z * resid_sd
    print(f"{level:.0%} interval: covers {np.mean((test >= lo) & (test <= hi)):.0%} of actuals, average width {np.mean(hi - lo):.1f}")
print(f"MAE {np.mean(np.abs(test - fc)):.2f}  vs naive same-day-last-week MAE {np.mean(np.abs(test - y[-67:-7])):.2f}")
```

Two habits transfer directly to `SHOW_EVALUATION_METRICS`: check that a stated interval covers roughly what it claims on held-out data, and compare the error with a naive baseline (same day last week). A forecast that does not beat the naive baseline is not worth publishing, however sophisticated the model.

## When to move to Python

| Stay with ML Functions | Move to Snowflake ML (lessons 33.25 to 33.27) |
|---|---|
| Standard forecasting, anomaly or classification tasks | Custom features, custom loss, deep learning |
| Analysts own the model in SQL | A team versions, tests and registers models |
| Good-enough accuracy, fast delivery | You need control over algorithms and tuning |

:::check
Which statements are right?

- ✓ A multi-series forecast model is created once with `SERIES_COLNAME` and serves every series.
- ✗ A higher `prediction_interval` in `DETECT_ANOMALIES` flags more anomalies.
  A higher interval widens the expected range, so fewer values fall outside it.
- ✓ A forecast should be compared with a naive baseline before it is trusted.
:::

:::recap What to keep
- FORECAST, ANOMALY_DETECTION, CLASSIFICATION, TOP_INSIGHTS: SQL model classes called with `!`.
- Read intervals, evaluation metrics, feature importance and training logs.
- Beat the naive baseline; move to Python when you need control.
:::

## Exercises

1. Set the interval to 0.5. How much does coverage drop, and when would such a narrow band be useful?
2. Add an exogenous column (a promotion flag) to the local data and see whether the error falls.
3. Write the task and alert that run `DETECT_ANOMALIES` every morning and email the store manager.

:::checked Sources and further reading
- [ML Functions overview](https://docs.snowflake.com/en/guides-overview-ml-functions)
- [CREATE SNOWFLAKE.ML.FORECAST](https://docs.snowflake.com/en/sql-reference/classes/forecast/commands/create-forecast) and [FORECAST method](https://docs.snowflake.com/en/sql-reference/classes/forecast/methods/forecast)
- [Anomaly detection](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ml-functions/anomaly-detection)
- Hyndman and Athanasopoulos, *Forecasting: Principles and Practice*, 3rd edition
:::
