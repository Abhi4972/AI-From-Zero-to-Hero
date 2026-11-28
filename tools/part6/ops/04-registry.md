---
title: The Model Registry: Versions, Champion and Challenger Aliases, and a Promotion Gate
minutes: 60
group: Foundations: lifecycle, reproducibility and tracking
lessons: a0209, a0219
---
:::goals What you will be able to do
- Register model versions in MLflow and point aliases such as `champion` and `challenger` at them
- Promote a challenger only when a gate on fresh data says it is better, by enough, on every slice that matters
- Roll back by moving an alias, without redeploying code
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Serving code asks the registry for "the champion"; promotion and rollback become a change to one pointer, made only when the evidence says so.
:::

## The problem

At level 0, "deploying a model" means copying a file. Nobody knows which file is live, what evidence supported it, or how to go back. A registry gives each model a name, numbered versions, metadata, and aliases that serving code resolves at load time.

## Register two versions

```python
import os, logging, warnings
os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"
import tempfile; os.chdir(tempfile.mkdtemp())          # a fresh, empty workspace for this lesson's MLflow files
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, mlflow, mlflow.sklearn
for name in ("mlflow", "alembic"): logging.getLogger(name).setLevel(logging.ERROR)
from mlflow import MlflowClient
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score

def make_customers(n=3000, seed=0):
    r = np.random.default_rng(seed)
    tenure = r.integers(1, 72, n); monthly = r.normal(55, 18, n).clip(10, 150).round(2)
    tickets = r.poisson(1.2, n); month_to_month = (r.random(n) < 0.55).astype(int)
    logit = -1.2 - 0.04 * tenure + 0.02 * (monthly - 55) + 0.45 * tickets + 1.4 * month_to_month
    churn = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return pd.DataFrame(dict(tenure=tenure, monthly=monthly, tickets=tickets, month_to_month=month_to_month, churn=churn))

train_df, fresh_df = make_customers(3000, seed=0), make_customers(2000, seed=1)     # fresh_df: last month's labelled customers
X, y = train_df.drop(columns="churn"), train_df["churn"]

TRUSTED = ["sklearn.tree._tree.Tree"]     # tree models: types we created ourselves and trust (see note)
mlflow.set_tracking_uri("sqlite:///mlflow.db"); mlflow.set_experiment("lakeside-churn")
client = MlflowClient()
NAME = "lakeside-churn"

def register(model, note):
    with mlflow.start_run(run_name=note):
        model.fit(X, y)
        info = mlflow.sklearn.log_model(model, name="model", registered_model_name=NAME, input_example=X.head(3),
                                        skops_trusted_types=TRUSTED)
    return info.registered_model_version

v1 = register(LogisticRegression(max_iter=500), "logreg baseline")
v2 = register(GradientBoostingClassifier(max_depth=3, random_state=7), "gbm depth 3")
client.set_registered_model_alias(NAME, "champion", v1)
client.set_registered_model_alias(NAME, "challenger", v2)
for v in (v1, v2):
    print("version", v, "aliases", client.get_model_version(NAME, str(v)).aliases)
```

## The promotion gate

The gate compares the two versions on **fresh data neither was trained on**, overall and by slice, and asks for a margin larger than the noise. A paired bootstrap over customers gives an interval for the difference.

```python
chall = mlflow.sklearn.load_model(f"models:/{NAME}@challenger")
champ_sk = mlflow.sklearn.load_model(f"models:/{NAME}@champion")
Xf, yf = fresh_df.drop(columns="churn"), fresh_df["churn"].to_numpy()
p_old, p_new = champ_sk.predict_proba(Xf)[:, 1], chall.predict_proba(Xf)[:, 1]

def auc_diff_interval(y, a, b, n=300, seed=3):
    r = np.random.default_rng(seed); diffs = []
    for _ in range(n):
        i = r.integers(0, len(y), len(y))
        diffs.append(roc_auc_score(y[i], b[i]) - roc_auc_score(y[i], a[i]))
    return np.percentile(diffs, [2.5, 97.5]).round(4)

SLICES = {"month-to-month": fresh_df.month_to_month == 1, "contract": fresh_df.month_to_month == 0, "new (<12m)": fresh_df.tenure < 12}

def gate(min_gain=0.005):
    overall = roc_auc_score(yf, p_new) - roc_auc_score(yf, p_old)
    lo, hi = auc_diff_interval(yf, p_old, p_new)
    report = {"overall_gain": round(float(overall), 4), "interval": [float(lo), float(hi)]}
    worse = {}
    for s, m in SLICES.items():
        m = m.to_numpy()
        d = roc_auc_score(yf[m], p_new[m]) - roc_auc_score(yf[m], p_old[m])
        report[s] = round(float(d), 4)
        if d < -0.01: worse[s] = round(float(d), 4)
    decision = "PROMOTE" if lo > 0 and overall >= min_gain and not worse else "KEEP CHAMPION"
    return decision, report

decision, report = gate()
print(decision); print(report)
```

Read the result before acting on it. Here the whole interval is below zero: the boosted trees are measurably worse than the simple logistic model on fresh customers, worse on the contract and month-to-month slices and level on new customers. That is a common real-world outcome when the signal is close to linear, and a good reason never to promote on enthusiasm. When the interval straddles zero, the challenger has not shown it is better, however good its point estimate looks: keep the champion and collect more labelled data.

## Promotion and rollback are pointer moves

```python
def promote(version, reason):
    old = client.get_model_version_by_alias(NAME, "champion").version
    client.set_registered_model_alias(NAME, "previous_champion", old)
    client.set_registered_model_alias(NAME, "champion", version)
    client.set_model_version_tag(NAME, version, "promotion_reason", reason)
    return old

def rollback():
    prev = client.get_model_version_by_alias(NAME, "previous_champion").version
    client.set_registered_model_alias(NAME, "champion", prev)
    return prev

old = promote(str(v2), "manual override for the exercise: gate said KEEP")
print("champion now", client.get_model_version_by_alias(NAME, "champion").version, "(was", f"{old})")
print("rolled back to", rollback())
```

Serving code that loads `models:/lakeside-churn@champion` picks up the change on its next reload; nothing is redeployed. Record the reason on every promotion, because an auditor will ask (lesson 32.13).

:::check
Which statements are right?

- ✓ Serving code should load a model by alias, not by version number.
- ✗ A challenger with a higher AUC point estimate on fresh data should be promoted.
  Only if the interval for the gain excludes zero and no important slice got worse.
- ✓ Rollback is moving the champion alias back to the previous version.
:::

:::recap What to keep
- Names, versions and aliases; serving resolves the alias.
- Gate on fresh data: interval above zero, minimum gain, no slice worse.
- Promotion and rollback are alias moves with a recorded reason.
:::

## Exercises

1. Make the fresh data harder for the champion (for example, double the `tickets` effect in `make_customers`) and rerun the gate. When does the challenger win?
2. Add a latency check to the gate: the challenger may be at most twice as slow per 1,000 predictions.
3. Write the alias policy for a team: who may move `champion`, and what evidence must be attached?

:::checked Sources and further reading
- [Model Registry workflows](https://mlflow.org/docs/3.3.2/ml/model-registry/workflow), MLflow documentation: aliases and loading by alias
- Efron and Tibshirani, *An Introduction to the Bootstrap*, 1993
:::
