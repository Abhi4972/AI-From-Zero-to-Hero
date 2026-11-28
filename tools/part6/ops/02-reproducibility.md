---
title: Reproducibility: Pinned Environments, Seeds and Content-Hashed Data Snapshots
minutes: 55
group: Foundations: lifecycle, reproducibility and tracking
lessons: a0007, a0213
---
:::goals What you will be able to do
- Make a training run repeatable: same code, same data, same environment, same result
- Identify a dataset by the hash of its content, the idea behind tools such as DVC
- Write a run manifest that lets someone else rebuild your model
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 55 minutes.
:::

:::plain The idea in one line
If you cannot rebuild a model, you cannot fix it, audit it or improve it safely; record the code version, the data fingerprint, the environment and the seeds every time.
:::

## The problem

Lakeside's churn model was trained eight months ago. The data scientist who built it has left. Finance asks why a large customer was flagged, and the platform team wants to upgrade scikit-learn. Nobody knows which extract of the customer table was used, and retraining "the same way" gives different scores. That is the level 0 trap.

## Four things to pin

| What | How | Example |
|---|---|---|
| Code | Git commit hash | `a41f9c2` |
| Data | Content hash of the exact snapshot, stored next to the data | `sha256:9e1c…` |
| Environment | Locked dependencies (lock file or container image digest) | `scikit-learn==1.7.2` |
| Randomness | Seeds for every random source | `random_state=7` |

## Fingerprinting data by content

```python
import hashlib, io, json, platform
import numpy as np, pandas as pd, sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

def make_customers(n=3000, seed=0):
    r = np.random.default_rng(seed)
    tenure = r.integers(1, 72, n); monthly = r.normal(55, 18, n).clip(10, 150).round(2)
    tickets = r.poisson(1.2, n); month_to_month = (r.random(n) < 0.55).astype(int)
    logit = -1.2 - 0.04 * tenure + 0.02 * (monthly - 55) + 0.45 * tickets + 1.4 * month_to_month
    churn = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return pd.DataFrame(dict(tenure=tenure, monthly=monthly, tickets=tickets, month_to_month=month_to_month, churn=churn))

def fingerprint(df):
    canonical = df.sort_index(axis=1).to_csv(index=False).encode()      # same content -> same bytes -> same hash
    return "sha256:" + hashlib.sha256(canonical).hexdigest()[:16]

data = make_customers()
print("snapshot", fingerprint(data), "rows", len(data))
edited = data.copy(); edited.loc[17, "monthly"] += 0.01
print("one cent changed in one row ->", fingerprint(edited))
```

A one-cent change produces a different fingerprint. Tools such as DVC and lakeFS store data by this kind of hash and keep a small pointer file in git, so a commit identifies both the code and the data.

## Seeds and the repeatable run

```python
def train(df, seed):
    X, y = df.drop(columns="churn"), df["churn"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=seed, stratify=y)
    model = LogisticRegression(max_iter=500).fit(Xtr, ytr)
    return round(model.score(Xte, yte), 4)

print("seed 7, run 1:", train(data, 7), " run 2:", train(data, 7))
print("seed 8:       ", train(data, 8))
```

Same seed, same score. A different seed gives a different split and a slightly different score, which is also a reminder that a single number hides variation: compare models on the same split, or over several seeds.

## The run manifest

```python
manifest = {
    "model": "churn-logreg",
    "code_commit": "a41f9c2",                            # from `git rev-parse --short HEAD` in a real pipeline
    "data": {"table": "analytics.customers_snapshot", "fingerprint": fingerprint(data), "rows": len(data)},
    "environment": {"python": platform.python_version(), "scikit-learn": sklearn.__version__, "pandas": pd.__version__},
    "seed": 7,
    "params": {"max_iter": 500, "test_size": 0.25},
    "metrics": {"accuracy": train(data, 7)},
}
print(json.dumps(manifest, indent=1))
```

Lesson 32.3 hands this job to MLflow, which records most of the manifest automatically. The habit matters more than the tool: no model leaves a laptop without one.

:::check
Which statements are right?

- ✓ A content hash changes when any value in the data changes.
- ✗ Setting a seed is enough to make training reproducible.
  You also need the same code, data snapshot and library versions.
- ✓ A git commit can identify the data too if the repository stores a pointer file holding the data hash.
:::

:::recap What to keep
- Pin code, data, environment and seeds.
- Identify data by a content hash, not by a table name.
- Write a manifest with every run; let a tracking tool do it for you.
:::

## Exercises

1. Shuffle the rows of `data` and fingerprint it. Is the hash the same? Change `fingerprint` so row order does not matter, and say when that is the right choice.
2. Train with five seeds and report the mean and range of accuracy.
3. Add the container image digest to the manifest and explain why it is stronger than a list of package versions.

:::checked Sources and further reading
- [DVC documentation](https://dvc.org/doc): versioning data with content hashes and pointer files
- [The ML Test Score](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017: infrastructure tests for reproducible training
:::
