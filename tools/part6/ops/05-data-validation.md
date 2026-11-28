---
title: Data Validation and Data Contracts: Catch Bad Data Before It Trains or Scores
minutes: 60
group: Data, features and pipelines
lessons: a0220, a0213
---
:::goals What you will be able to do
- Write a data contract for a model's inputs: schema, types, ranges, allowed values, null rates and volume
- Validate a batch against the contract and against a reference distribution, and decide to block, warn or pass
- Place validation at the two points that matter: before training and before scoring
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Most model incidents are data incidents; check every batch against an agreed contract before a model ever sees it.
:::

## The problem

One Monday, Lakeside's billing system starts sending `monthly` in pence instead of pounds. Nothing crashes. The churn model scores every customer as high risk, the retention team phones 9,000 happy customers, and the first anyone hears of it is a complaint. A one-line check on the range of `monthly` would have stopped the batch.

## The contract

A data contract is an agreement between the team that produces a table and the teams that consume it. Write it down as data, so code can enforce it and people can review it.

```python
import numpy as np, pandas as pd

CONTRACT = {
    "columns": {
        "customer_id":    {"type": "int",   "nullable": False, "unique": True},
        "tenure":         {"type": "int",   "min": 0,   "max": 120, "nullable": False},
        "monthly":        {"type": "float", "min": 5,   "max": 400, "nullable": False},
        "tickets":        {"type": "int",   "min": 0,   "max": 50,  "nullable": False},
        "contract":       {"type": "str",   "allowed": {"month", "year", "two_year"}, "nullable": False},
        "region":         {"type": "str",   "allowed": {"north", "south", "east", "west"}, "max_null_rate": 0.02},
    },
    "row_count": {"min": 500, "max": 50_000},
}

def make_batch(n=2000, seed=0, pence=False, new_region=False, nulls=0.0):
    r = np.random.default_rng(seed)
    df = pd.DataFrame({
        "customer_id": np.arange(n) + 10_000,
        "tenure": r.integers(1, 72, n),
        "monthly": r.normal(55, 18, n).clip(10, 150).round(2) * (100 if pence else 1),
        "tickets": r.poisson(1.2, n),
        "contract": r.choice(["month", "year", "two_year"], n, p=[.55, .3, .15]),
        "region": r.choice(["north", "south", "east", "west"] + (["central"] if new_region else []), n),
    })
    if nulls: df.loc[r.random(n) < nulls, "region"] = None
    return df
```

## Validating a batch

```python
TYPES = {"int": "i", "float": "f", "str": "O"}

def validate(df, contract):
    errors, warnings = [], []
    rc = contract["row_count"]
    if not rc["min"] <= len(df) <= rc["max"]: errors.append(f"row count {len(df)} outside {rc['min']}..{rc['max']}")
    for col, rule in contract["columns"].items():
        if col not in df: errors.append(f"{col}: missing"); continue
        s = df[col]
        if s.dtype.kind not in (TYPES[rule["type"]], "i" if rule["type"] == "float" else "?"):
            errors.append(f"{col}: type {s.dtype} is not {rule['type']}")
        nr = s.isna().mean()
        if not rule.get("nullable", True) and nr > 0: errors.append(f"{col}: {nr:.1%} nulls, none allowed")
        elif nr > rule.get("max_null_rate", 1): warnings.append(f"{col}: {nr:.1%} nulls above {rule['max_null_rate']:.0%}")
        v = s.dropna()
        if "min" in rule and (v < rule["min"]).any(): errors.append(f"{col}: {(v < rule['min']).sum()} values below {rule['min']}")
        if "max" in rule and (v > rule["max"]).any(): errors.append(f"{col}: {(v > rule['max']).sum()} values above {rule['max']}")
        if "allowed" in rule and not set(v.unique()) <= rule["allowed"]:
            errors.append(f"{col}: unexpected values {sorted(set(v.unique()) - rule['allowed'])}")
        if rule.get("unique") and s.duplicated().any(): errors.append(f"{col}: duplicates")
    status = "BLOCK" if errors else ("WARN" if warnings else "PASS")
    return status, errors, warnings

for label, batch in [("normal day", make_batch()), ("billing in pence", make_batch(pence=True)),
                     ("new region added", make_batch(new_region=True)), ("region nulls 5%", make_batch(nulls=0.05))]:
    status, errs, warns = validate(batch, CONTRACT)
    print(f"{label:18} {status:5} {errs[:2]} {warns[:1]}")
```

Each failure says what broke in words an on-call engineer can act on. The new region is a good example of a contract doing its job: it is not necessarily wrong data, but a change the model was never trained on, and someone should decide what to do before it is scored.

## Distribution checks against a reference

Range checks miss slower problems: values that stay legal but shift. Compare each batch with the training data. A two-sample Kolmogorov-Smirnov statistic works for numeric columns; lesson 32.11 adds the population stability index used in monitoring.

```python
from scipy.stats import ks_2samp
reference = make_batch(seed=1)

def distribution_check(batch, ref, cols=("tenure", "monthly", "tickets"), threshold=0.1):
    out = {}
    for c in cols:
        stat = ks_2samp(batch[c], ref[c]).statistic
        out[c] = (round(float(stat), 3), "SHIFT" if stat > threshold else "ok")
    return out

shifted = make_batch(seed=2); shifted["monthly"] = shifted["monthly"] * 1.25     # a price rise: legal values, new distribution
print("normal day :", distribution_check(make_batch(seed=3), reference))
print("price rise :", distribution_check(shifted, reference))
```

## Where validation runs

| Point | Fail means | Typical action |
|---|---|---|
| Before training | The pipeline stops; no new model version | Fix the data or the contract, rerun |
| Before batch scoring | Scores are not published | Keep yesterday's scores, alert the data owner |
| Online, per request | The request is rejected or flagged | Return a safe default and log it |

Libraries such as Great Expectations, pandera and Soda implement the same idea with more checks and reports; in Snowflake, data metric functions run similar checks inside the warehouse. Start with a contract this small and grow it from real incidents.

:::check
Which statements are right?

- ✓ A contract written as data can be enforced by code and reviewed by people.
- ✗ If every value is inside its allowed range, the batch is safe to score.
  Legal values can still shift in distribution; compare with a reference too.
- ✓ When scoring is blocked, keeping the previous scores is usually safer than publishing bad ones.
:::

:::recap What to keep
- Contract: schema, types, ranges, allowed values, nulls, uniqueness, volume.
- Block, warn or pass, with messages a person can act on.
- Validate before training and before scoring; add distribution checks for slow shifts.
:::

## Exercises

1. Add a freshness rule: the newest `updated_at` must be less than 26 hours old.
2. Make the KS threshold depend on sample size. Why does a fixed threshold misbehave for very large batches?
3. Write the message the validator should post to the data owner's channel for the pence incident.

:::checked Sources and further reading
- [Great Expectations documentation](https://docs.greatexpectations.io/)
- [The ML Test Score](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017: data tests
- Polyzotis et al., "Data Validation for Machine Learning", MLSys 2019
:::
