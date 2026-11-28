---
title: Testing ML Systems and CI/CD for Models: Data, Feature, Model and Behavioural Tests
minutes: 70
group: Data, features and pipelines
lessons: a0209, a1110
---
:::goals What you will be able to do
- Write the four kinds of ML tests: data, feature code, model quality and model behaviour
- Use invariance and directional tests to catch models that score well but behave badly
- Wire the tests into a CI workflow that blocks a release
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Test the data, the code and the model's behaviour automatically on every change, and let failing tests stop the release.
:::

## The problem

Ordinary software tests check code. A model can pass every code test and still be wrong: trained on bad data, worse on a slice, or relying on a feature it should not use. The ML Test Score rubric groups the extra tests into data, model development, infrastructure and monitoring. This lesson builds the first two and puts them in CI.

## Setup: a model and the shared feature function

```python
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

def make_customers(n=4000, seed=0):
    r = np.random.default_rng(seed)
    df = pd.DataFrame({"tenure": r.integers(1, 72, n), "monthly": r.normal(55, 18, n).clip(10, 150).round(2),
                       "tickets": r.poisson(1.2, n), "contract": r.choice(["month", "year"], n, p=[.6, .4]),
                       "gender": r.choice(["f", "m"], n)})
    logit = -1.2 - .04 * df.tenure + .02 * (df.monthly - 55) + .45 * df.tickets + 1.4 * (df.contract == "month")
    df["churn"] = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return df

def features(raw):
    return pd.DataFrame({"tenure_years": raw.tenure / 12, "monthly_log": np.log1p(raw.monthly.clip(lower=0)),
                         "tickets": raw.tickets.clip(upper=20), "month_to_month": (raw.contract == "month").astype(int)})

train_df, test_df = make_customers(seed=0), make_customers(2000, seed=1)
model = LogisticRegression(max_iter=500).fit(features(train_df), train_df.churn)
```

## The tests

```python
RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, "PASS" if ok else "FAIL", detail))

# 1. Feature code: unit tests on edge cases
edge = pd.DataFrame({"tenure": [0, 120], "monthly": [0.0, 400.0], "tickets": [0, 99], "contract": ["month", "year"]})
f = features(edge)
check("features: no NaN or inf on edge cases", np.isfinite(f.to_numpy()).all())
check("features: tickets capped at 20", f.tickets.max() == 20)

# 2. Model quality: overall and by slice, on a fixed test set
p = model.predict_proba(features(test_df))[:, 1]
auc = roc_auc_score(test_df.churn, p); check("quality: AUC >= 0.75", auc >= 0.75, f"{auc:.3f}")
for s in ["month", "year"]:
    m = (test_df.contract == s).to_numpy(); a = roc_auc_score(test_df.churn[m], p[m])
    check(f"quality: AUC on {s} contracts >= 0.70", a >= 0.70, f"{a:.3f}")

# 3. Behaviour: invariance (a protected attribute must not change the score)
flip = test_df.copy(); flip["gender"] = flip.gender.map({"f": "m", "m": "f"})
d = np.abs(model.predict_proba(features(flip))[:, 1] - p).max()
check("invariance: flipping gender changes no score", d < 1e-9, f"max change {d:.2e}")

# 4. Behaviour: directional expectation (more support tickets should not lower churn risk)
more = test_df.copy(); more["tickets"] = more.tickets + 3
check("directional: +3 tickets never lowers risk", (model.predict_proba(features(more))[:, 1] >= p - 1e-12).all())

# 5. Behaviour: minimum functionality on hand-written cases
cases = pd.DataFrame({"tenure": [2, 70], "monthly": [90, 30], "tickets": [6, 0], "contract": ["month", "year"], "gender": ["f", "m"]})
risk = model.predict_proba(features(cases))[:, 1]
check("cases: new, unhappy, monthly customer is riskier than a loyal one", risk[0] > risk[1], f"{risk.round(2)}")

for r in RESULTS: print(f"{r[1]}  {r[0]}  {r[2]}")
print("RELEASE", "BLOCKED" if any(r[1] == "FAIL" for r in RESULTS) else "ALLOWED")
```

The invariance test passes trivially here because `features` never reads `gender`. That is the point: the test protects you on the day someone adds it, or adds a feature that stands in for it, such as a title field.

## Breaking it on purpose

```python
def features_with_bug(raw):                        # someone "simplifies" the contract encoding
    f = features(raw); f["month_to_month"] = (raw.contract == "monthly").astype(int); return f

bad = LogisticRegression(max_iter=500).fit(features_with_bug(train_df), train_df.churn)
pb = bad.predict_proba(features_with_bug(test_df))[:, 1]
print("AUC with the encoding bug:", round(roc_auc_score(test_df.churn, pb), 3), "(test threshold 0.75)")
```

No exception, plausible output, and a quality test that catches it. Without the test, this ships.

## Wiring it into CI

```yaml
# .github/workflows/model.yml  (sketch)
name: model-ci
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: "3.12"}
      - run: pip install -r requirements.lock
      - run: pytest tests/features tests/data          # fast: every change
      - run: python pipeline.py --sample 20000         # train on a fixed sample snapshot
      - run: pytest tests/model                        # quality, slices, invariance, directional
      - run: python gate.py --against champion         # the promotion gate: block if worse than production
```

Keep the CI training run small and fixed (a sampled snapshot) so it takes minutes, and run the full training in the pipeline after merge. Store the thresholds in the repository so that changing them is itself a reviewed change.

:::check
Which statements are right?

- ✓ Invariance tests check that changing an attribute that should not matter leaves predictions unchanged.
- ✗ If the code tests pass, the model is ready to release.
  Data, quality-by-slice and behaviour tests are needed too.
- ✓ Thresholds kept in the repository make loosening a test a reviewed change.
:::

:::recap What to keep
- Data tests, feature-code tests, quality by slice, behaviour tests.
- Invariance, directional and minimum-functionality cases catch silent failures.
- CI runs fast tests on every change and a small fixed training run before the gate.
:::

## Exercises

1. Add a directional test: a longer tenure should not raise risk. Does the model pass?
2. Add a calibration test: in each tenth of predicted risk, the observed churn rate is within 5 points of the mean prediction.
3. Turn the checks above into pytest functions in a `tests/model` file (as text), each with one assert.

:::checked Sources and further reading
- [The ML Test Score](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017
- Ribeiro et al., "Beyond Accuracy: Behavioral Testing of NLP Models with CheckList", ACL 2020: invariance and directional tests
:::
