---
title: Experiment Tracking with MLflow: Runs, Parameters, Metrics and Artifacts
minutes: 60
group: Foundations: lifecycle, reproducibility and tracking
lessons: a0212, a0209
---
:::goals What you will be able to do
- Record every training run with MLflow: parameters, metrics, tags, the model and the dataset fingerprint
- Compare runs as a table and pick a candidate with evidence
- Know what belongs in a run and what does not
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
- **Setup**: `pip install mlflow scikit-learn pandas`. MLflow stores everything in a local SQLite file here; in a team, point it at a shared tracking server.
:::

:::plain The idea in one line
Every training run writes down what went in and what came out, automatically, so choosing a model is a query rather than a memory test.
:::

## The problem

Lakeside's data scientist tries four model types and a dozen settings over two days. The best result lives in a notebook cell that has since been re-run. Experiment tracking fixes this with one rule: if it was trained, it was logged.

## Setting up

```python
import os, logging, warnings
os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"
import tempfile; os.chdir(tempfile.mkdtemp())          # a fresh, empty workspace for this lesson's MLflow files
warnings.filterwarnings("ignore")
import hashlib
import numpy as np, pandas as pd, mlflow, mlflow.sklearn
for name in ("mlflow", "alembic"): logging.getLogger(name).setLevel(logging.ERROR)
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, f1_score

def make_customers(n=3000, seed=0):
    r = np.random.default_rng(seed)
    tenure = r.integers(1, 72, n); monthly = r.normal(55, 18, n).clip(10, 150).round(2)
    tickets = r.poisson(1.2, n); month_to_month = (r.random(n) < 0.55).astype(int)
    logit = -1.2 - 0.04 * tenure + 0.02 * (monthly - 55) + 0.45 * tickets + 1.4 * month_to_month
    churn = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return pd.DataFrame(dict(tenure=tenure, monthly=monthly, tickets=tickets, month_to_month=month_to_month, churn=churn))

data = make_customers()
fp = "sha256:" + hashlib.sha256(data.to_csv(index=False).encode()).hexdigest()[:16]
X, y = data.drop(columns="churn"), data["churn"]
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=7, stratify=y)

TRUSTED = ["sklearn.tree._tree.Tree"]     # tree models: types we created ourselves and trust (see note)
mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment("lakeside-churn")
print("tracking to", mlflow.get_tracking_uri())
```

## Logging runs

```python
CANDIDATES = {
    "logreg C=1.0": LogisticRegression(C=1.0, max_iter=500),
    "logreg C=0.1": LogisticRegression(C=0.1, max_iter=500),
    "forest d=6": RandomForestClassifier(n_estimators=200, max_depth=6, random_state=7),
    "gbm d=3": GradientBoostingClassifier(max_depth=3, random_state=7),
}
for name, model in CANDIDATES.items():
    with mlflow.start_run(run_name=name):
        model.fit(Xtr, ytr)
        proba = model.predict_proba(Xte)[:, 1]
        mlflow.log_params({k: v for k, v in model.get_params().items() if k in ("C", "max_depth", "n_estimators")})
        mlflow.log_params({"model_type": type(model).__name__, "seed": 7})
        mlflow.log_metrics({"auc": roc_auc_score(yte, proba), "f1": f1_score(yte, proba > 0.5)})
        mlflow.set_tags({"data_fingerprint": fp, "owner": "churn-team"})
        mlflow.sklearn.log_model(model, name="model", input_example=Xtr.head(3), skops_trusted_types=TRUSTED)
print("logged", len(CANDIDATES), "runs")
```

A note on `skops_trusted_types`: recent MLflow versions save scikit-learn models with skops rather than pickle, because loading a pickle can run arbitrary code. Skops refuses types it cannot check, such as the tree structure inside forests and boosted trees, unless you list them as trusted. List only types you produced yourself; never trust a model file from an unknown source.

## Comparing runs

```python
runs = mlflow.search_runs(experiment_names=["lakeside-churn"], order_by=["metrics.auc DESC"])
cols = ["tags.mlflow.runName", "params.model_type", "metrics.auc", "metrics.f1", "tags.data_fingerprint"]
runs[cols].round(4)
```

The runs are ranked by AUC from one query, and every row carries the data fingerprint, so you know they were compared on the same data. Close scores deserve suspicion: a difference in the third decimal on one split is not evidence (lesson 32.4 adds a proper comparison before promotion).

| Log it | Do not log it |
|---|---|
| Parameters, seed, data fingerprint, code commit | Secrets, credentials, raw personal data |
| Metrics on a fixed evaluation set, by slice | Metrics on whichever split happened to be handy |
| The model with an input example and signature | Huge intermediate files nobody will open |
| Plots that explain the model (calibration, confusion) | Every print statement |

:::check
Which statements are right?

- ✓ Logging the data fingerprint as a tag lets you confirm runs were compared on the same data.
- ✗ The run with the highest AUC should always be promoted.
  Small differences may be noise, and cost, latency and slices matter too.
- ✓ Credentials and raw personal data should never be logged to a tracking server.
:::

:::recap What to keep
- One run per training: params, metrics, tags, model, data fingerprint.
- Compare runs with a query, on the same evaluation data.
- Keep secrets and raw personal data out of the tracker.
:::

## Exercises

1. Log the training time of each run as a metric and add it to the comparison table.
2. Log AUC separately for month-to-month and longer contracts. Does the ranking change?
3. Use `mlflow.autolog()` for one run and list what it recorded that you did not.

:::checked Sources and further reading
- [MLflow Tracking](https://mlflow.org/docs/latest/ml/tracking/), MLflow documentation
- [The ML Test Score](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017
:::
