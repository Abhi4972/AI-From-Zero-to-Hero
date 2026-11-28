---
title: Monitoring Models in Production: PSI, Prediction Drift and Performance with Delayed Labels
minutes: 70
group: Serving, release and monitoring
lessons: a0220, a1713, a1723
---
:::goals What you will be able to do
- Compute the population stability index (PSI) for features and predictions, and read it
- Track model performance when labels arrive weeks after predictions
- Turn metrics into alerts that point an on-call engineer at a cause
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Watch what the model sees, what it says, and (when the truth arrives) how right it was, and alert on changes that need a person.
:::

## The problem

Lesson 2.26 introduced data drift and concept drift. This lesson builds the monitor Lakeside runs every week. Three layers, from fastest to most trustworthy:

| Layer | Available | Tells you |
|---|---|---|
| Input drift | Immediately | The world the model sees has changed |
| Prediction drift | Immediately | The model's behaviour has changed |
| Performance | When labels arrive (churn: 30 to 60 days) | Whether the model is still right |

## Twelve weeks of scoring

```python
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

def week_data(week, n=3000):
    r = np.random.default_rng(100 + week)
    price_rise = 1.0 + (0.12 if week >= 6 else 0.0)                  # a price rise from week 6
    tenure = r.integers(1, 72, n); monthly = (r.normal(55, 18, n) * price_rise).clip(10, 200)
    tickets = r.poisson(1.2 + (0.8 if week >= 9 else 0.0), n)         # an outage from week 9 raises tickets
    m2m = (r.random(n) < .55).astype(int)
    effect = 0.02 if week < 6 else 0.045                               # concept drift: price now matters more
    logit = -1.2 - .04 * tenure + effect * (monthly - 55) + .45 * tickets + 1.4 * m2m
    churn = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return pd.DataFrame(dict(tenure=tenure, monthly=monthly, tickets=tickets, m2m=m2m, churn=churn))

FEATS = ["tenure", "monthly", "tickets", "m2m"]
ref = week_data(0)
model = LogisticRegression(max_iter=500).fit(ref[FEATS], ref.churn)
weeks = {w: week_data(w) for w in range(1, 13)}
for w, df in weeks.items(): df["score"] = model.predict_proba(df[FEATS])[:, 1]
ref["score"] = model.predict_proba(ref[FEATS])[:, 1]
print("weeks scored:", len(weeks))
```

## The population stability index

PSI compares the share of rows in each bin of a reference distribution with the share in the current one: the sum over bins of (current − reference) × ln(current / reference). Common rules of thumb: below 0.1 stable, 0.1 to 0.25 worth a look, above 0.25 a real shift. They are conventions, not laws; calibrate them on your own history.

```python
def psi(reference, current, bins=10, eps=1e-4):
    edges = np.unique(np.quantile(reference, np.linspace(0, 1, bins + 1)))
    edges[0], edges[-1] = -np.inf, np.inf
    ref_share = np.histogram(reference, edges)[0] / len(reference) + eps
    cur_share = np.histogram(current, edges)[0] / len(current) + eps
    return float(np.sum((cur_share - ref_share) * np.log(cur_share / ref_share)))

rows = []
for w, df in weeks.items():
    rows.append({"week": w, **{f"psi_{c}": round(psi(ref[c], df[c]), 3) for c in ["monthly", "tickets", "tenure"]},
                 "psi_score": round(psi(ref.score, df.score), 3), "mean_score": round(df.score.mean(), 3)})
drift = pd.DataFrame(rows).set_index("week")
drift
```

The price rise shows up in `monthly` from week 6 and the outage in `tickets` from week 9; `tenure` stays flat. The score PSI moves with them: the model's behaviour changed because its inputs did. None of this says yet whether the model is **wrong**.

## Performance with delayed labels

Churn is known about six weeks after scoring. Each week, compute performance for the cohort whose labels have just matured, and keep the calibration check (mean predicted risk against observed churn), which catches a model that ranks well but whose probabilities no longer mean what they say.

```python
LABEL_DELAY = 6
perf = []
for w in range(1, 13):
    matured = w - LABEL_DELAY
    if matured < 1: continue
    df = weeks[matured]
    perf.append({"report_week": w, "cohort_week": matured, "auc": round(roc_auc_score(df.churn, df.score), 3),
                 "mean_pred": round(df.score.mean(), 3), "observed": round(df.churn.mean(), 3)})
pd.DataFrame(perf).set_index("report_week")
```

AUC barely moves. But the week 6 cohort, the first after the price rise, churned at about 32% against a mean prediction of about 28%: the model now under-estimates risk because price matters more than it did (concept drift). Ranking-only metrics would have missed it, and the business would have under-funded retention. Note also when you found out: week 12, for a change that began in week 6. That delay is why input and prediction drift are watched as early warnings.

## From metrics to alerts

```python
def alerts(drift, perf_df, look=0.1):
    out, active = [], set()
    for w, row in drift.iterrows():                       # alert when a metric first crosses the line, not every week
        for c in ["monthly", "tickets", "tenure", "score"]:
            v = row[f"psi_{c}"]
            if v > look and c not in active:
                active.add(c)
                what = "prediction drift" if c == "score" else f"input drift in {c}"
                out.append((int(w), "warn", f"{what} (PSI {v}); check upstream changes and the score distribution"))
    for _, p in perf_df.iterrows():
        if p.observed - p.mean_pred > 0.03:
            out.append((int(p.report_week), "page", f"calibration: cohort week {int(p.cohort_week)} churned {p.observed:.0%} vs predicted {p.mean_pred:.0%}; consider retraining"))
    return sorted(out)

for a in alerts(drift, pd.DataFrame(perf)): print(a)
```

Each warning fires once, when a metric first crosses the "worth a look" line, rather than every week it stays there; repeated alerts teach people to ignore the channel. Two kinds of alert: **warn** goes to the team's channel for a look during working hours; **page** wakes someone only when outcomes are affected. Every alert names the likely cause and a first action. Snowflake's ML Observability computes drift (including PSI) and performance on a schedule with `CREATE MODEL MONITOR` (lesson 32.14); Evidently, WhyLabs and Arize do the same elsewhere.

:::check
Which statements are right?

- ✓ Input drift can be measured immediately; performance needs labels, which may arrive weeks later.
- ✗ If AUC is stable, the model's probabilities are still trustworthy.
  Calibration can drift while ranking holds; compare predicted and observed rates.
- ✓ An alert should name the likely cause and a first action.
:::

:::recap What to keep
- Three layers: inputs, predictions, performance.
- PSI with calibrated thresholds; calibration alongside AUC.
- Warn for drift, page for outcome damage; each alert with a cause and an action.
:::

## Exercises

1. Shorten `LABEL_DELAY` to 4. When would the calibration alert fire?
2. Add PSI by segment (month-to-month vs contract). Does one segment drift first?
3. Write the runbook entry for the "prediction drift" warning: who looks, what they check, when they escalate.

:::checked Sources and further reading
- [ML Observability](https://docs.snowflake.com/en/developer-guide/snowflake-ml/model-registry/model-observability), Snowflake documentation
- Rabanser, Günnemann and Lipton, "Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift", NeurIPS 2019
- Yurdakul, "Statistical Properties of Population Stability Index", 2018
:::
