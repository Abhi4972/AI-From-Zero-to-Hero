---
title: Feature Pipelines: Point-in-Time Correctness, Leakage and Training-Serving Skew
minutes: 60
group: Data, features and pipelines
lessons: a0221, a0213
---
:::goals What you will be able to do
- Build training data with point-in-time joins, so no feature uses information from after the prediction time
- Show how a naive join leaks the future and inflates offline scores
- Remove training-serving skew by computing features with one shared function
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Each training row must only see what was known at the moment the prediction would have been made, and serving must compute features exactly the same way.
:::

## The problem

Lakeside's second churn model scored a superb AUC offline and was close to useless in production. The cause was one join: "number of support tickets" came from a table that included tickets raised **after** the customer had already called to cancel. The model had learned to spot cancellation calls, not churn risk.

## A spine and a feature table

The **spine** lists the moments you want predictions for: one row per customer and prediction date, with the label observed later. The feature table holds values with the time they became known.

```python
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

r = np.random.default_rng(0)
N = 1500
customers = pd.DataFrame({"customer_id": range(N), "risk": r.normal(0, 1, N)})
spine = customers.assign(as_of=pd.Timestamp("2026-06-01"))
spine["churn"] = (r.random(N) < 1 / (1 + np.exp(-(customers.risk * 1.2 - 1)))).astype(int)

# ticket events: risky customers raise more tickets; churners also raise "cancel" tickets AFTER the as_of date
events = []
for c, risk, churn in zip(customers.customer_id, customers.risk, spine.churn):
    for _ in range(r.poisson(max(0.2, 1 + risk))):
        events.append((c, pd.Timestamp("2026-06-01") - pd.Timedelta(days=int(r.integers(1, 90)))))
    if churn:
        for _ in range(r.poisson(3)):
            events.append((c, pd.Timestamp("2026-06-01") + pd.Timedelta(days=int(r.integers(1, 20)))))
tickets = pd.DataFrame(events, columns=["customer_id", "ts"])
print(len(tickets), "ticket events;", (tickets.ts > "2026-06-01").mean().round(2), "of them after the prediction date")
```

## The naive join and the point-in-time join

```python
naive = spine.merge(tickets.groupby("customer_id").size().rename("tickets_90d"), on="customer_id", how="left").fillna({"tickets_90d": 0})

def tickets_as_of(spine, tickets, window_days=90):
    j = spine[["customer_id", "as_of"]].merge(tickets, on="customer_id", how="left")
    known = (j.ts <= j.as_of) & (j.ts > j.as_of - pd.Timedelta(days=window_days))
    return spine.merge(j[known].groupby("customer_id").size().rename("tickets_90d"), on="customer_id", how="left").fillna({"tickets_90d": 0})

pit = tickets_as_of(spine, tickets)

def offline_auc(df):
    half = len(df) // 2
    m = LogisticRegression().fit(df[["tickets_90d"]][:half], df.churn[:half])
    return round(roc_auc_score(df.churn[half:], m.predict_proba(df[["tickets_90d"]][half:])[:, 1]), 3)

print("offline AUC, naive join          :", offline_auc(naive))
print("offline AUC, point-in-time join  :", offline_auc(pit))
```

The naive number is the one that gets a model approved and then fails. The point-in-time number is what production will actually see. Any feature built from events needs the event time and the prediction time in the join; feature stores (Feast, Snowflake Feature Store, Databricks) exist largely to do this join correctly at scale. In Snowflake's Feature Store, `generate_training_set(spine_df, features, spine_timestamp_col=...)` performs it (lesson 32.14).

## One feature function for training and serving

Training-serving skew happens when the training pipeline (SQL in the warehouse) and the serving code (Python in an API) compute "the same" feature differently: different windows, null handling or rounding.

```python
def features(raw):                       # the only definition, imported by both the training job and the API
    out = pd.DataFrame(index=raw.index)
    out["tenure_years"] = raw["tenure"].fillna(0) / 12
    out["monthly_log"] = np.log1p(raw["monthly"].clip(lower=0))
    out["tickets_90d"] = raw["tickets_90d"].fillna(0).clip(upper=20)
    out["month_to_month"] = (raw["contract"] == "month").astype(int)
    return out

def serving_features_written_separately(raw):   # what the API team wrote from a description of the features
    out = pd.DataFrame(index=raw.index)
    out["tenure_years"] = raw["tenure"] / 12                     # forgot the null fill
    out["monthly_log"] = np.log(raw["monthly"])                  # log, not log1p
    out["tickets_90d"] = raw["tickets_90d"]                      # no cap
    out["month_to_month"] = (raw["contract"] == "monthly").astype(int)   # different label for the same value
    return out

req = pd.DataFrame([{"tenure": 14, "monthly": 62.5, "tickets_90d": 31, "contract": "month"}])
print(pd.concat({"shared": features(req).iloc[0], "rewritten": serving_features_written_separately(req).iloc[0]}, axis=1).round(3))
```

Three of the four features differ on this one request, and the fourth would differ as soon as a tenure value is missing. None of these raises an error. The fix is organisational as much as technical: one feature definition, versioned, used by both paths, with a test that feeds the same input through both and compares (lesson 32.8).

:::check
Which statements are right?

- ✓ A point-in-time join only uses feature values known at the prediction time.
- ✗ A higher offline AUC always means a better model.
  Leakage raises offline scores and hurts production; check how features were joined.
- ✓ Computing features with one shared function removes a whole class of training-serving skew.
:::

:::recap What to keep
- Spine with prediction times; features with event times; join as of the prediction time.
- Suspiciously good offline scores are a leakage alarm.
- One feature definition for training and serving, tested for parity.
:::

## Exercises

1. Change the window to 30 days. How does the point-in-time AUC change, and why?
2. Add a second as-of date per customer (2026-03-01) to the spine and rebuild the training set.
3. Write a parity test that fails if the two feature functions differ by more than 1e-9 on 1,000 random requests.

:::checked Sources and further reading
- [Feast: point-in-time joins](https://docs.feast.dev/getting-started/concepts/point-in-time-joins)
- [Snowflake Feature Store: working with feature views](https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/feature-views)
- Kaufman et al., "Leakage in Data Mining: Formulation, Detection, and Avoidance", KDD 2011
:::
