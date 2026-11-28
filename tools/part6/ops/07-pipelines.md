---
title: Training Pipelines and Orchestration: DAGs, Idempotent Steps, Caching and Backfills
minutes: 60
group: Data, features and pipelines
lessons: a1013, a0213
---
:::goals What you will be able to do
- Express training as a pipeline of small steps with declared inputs and outputs
- Make steps idempotent and cache them by the hash of their inputs, so reruns are cheap and safe
- Run a backfill and explain how an orchestrator such as Airflow, Prefect, Kubeflow or Snowflake tasks schedules the same graph
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Turn the notebook into a graph of steps that each do one thing, can be rerun safely, and skip work they have already done.
:::

## The problem

Level 1 maturity means the training pipeline runs without a person. That needs three properties a notebook lacks: steps that can run in order on a schedule, steps that give the same result when rerun (so a retry after a failure does no harm), and a record of what each run produced.

## A tiny orchestrator

Real orchestrators add scheduling, retries, distribution and a UI, but the core is this: a graph of steps, each run with its inputs, its output cached under a key built from those inputs.

```python
import hashlib, json, time
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

CACHE, LOG = {}, []

def key(name, inputs, params):
    blob = json.dumps({"step": name, "params": params, "inputs": inputs}, sort_keys=True, default=str)
    return name + ":" + hashlib.sha256(blob.encode()).hexdigest()[:10]

def step(name, fn, inputs, params):
    k = key(name, inputs, params)
    if k in CACHE:
        LOG.append((name, "cached")); return k
    t = time.time(); CACHE[k] = fn(*[CACHE[i] for i in inputs], **params)
    LOG.append((name, f"ran {time.time() - t:.2f}s")); return k

def extract(day, n=4000):
    r = np.random.default_rng(int(pd.Timestamp(day).strftime("%Y%m%d")))
    tenure = r.integers(1, 72, n); tickets = r.poisson(1.2, n); m2m = (r.random(n) < .55).astype(int)
    churn = (r.random(n) < 1 / (1 + np.exp(-(-1.2 - .04 * tenure + .45 * tickets + 1.4 * m2m)))).astype(int)
    return pd.DataFrame(dict(tenure=tenure, tickets=tickets, m2m=m2m, churn=churn))

def validate(df):
    assert df.tenure.between(0, 120).all() and df.tickets.ge(0).all(), "contract failed"
    return df

def split(df, seed):
    test = df.sample(frac=.25, random_state=seed); return {"train": df.drop(test.index), "test": test}

def train(parts, C):
    tr = parts["train"]; return LogisticRegression(C=C, max_iter=500).fit(tr.drop(columns="churn"), tr.churn)

def evaluate(model, parts):
    te = parts["test"]; return round(roc_auc_score(te.churn, model.predict_proba(te.drop(columns="churn"))[:, 1]), 4)

def pipeline(day, C=1.0, seed=7):
    raw = step("extract", extract, [], {"day": day})
    ok = step("validate", validate, [raw], {})
    parts = step("split", split, [ok], {"seed": seed})
    model = step("train", train, [parts], {"C": C})
    score = step("evaluate", evaluate, [model, parts], {})
    return CACHE[score]

print("first run  AUC", pipeline("2026-11-01")); print(LOG); LOG.clear()
print("rerun      AUC", pipeline("2026-11-01")); print(LOG); LOG.clear()
print("new C      AUC", pipeline("2026-11-01", C=0.1)); print(LOG); LOG.clear()
```

The rerun does no work: every step's inputs are unchanged, so every output comes from the cache. Changing `C` reruns only `train` and `evaluate`. This is what makes pipelines cheap to iterate on and safe to retry.

## Idempotence

A step is idempotent if running it twice leaves the world as running it once. Reading and computing are naturally idempotent; writing needs care.

| Not idempotent | Idempotent version |
|---|---|
| `INSERT INTO scores SELECT ...` | `MERGE` on (customer, score_date), or overwrite the partition for that date |
| Append a model file named `model_latest.pkl` | Write `model/{run_id}/` and move an alias |
| Send an alert email from inside training | Write a status row; a separate notifier sends once |

## Backfills

A backfill reruns the pipeline for past dates, for example after fixing a feature bug. With date-parameterised, cached, idempotent steps it is a loop.

```python
for day in pd.date_range("2026-10-01", periods=4, freq="7D").strftime("%Y-%m-%d"):
    print(day, "AUC", pipeline(day))
print(sum(1 for _, s in LOG if s.startswith("ran")), "steps ran,", sum(1 for _, s in LOG if s == "cached"), "cached")
```

## The same graph in a real orchestrator

```pyshow
# Airflow 3 TaskFlow API (sketch): each function becomes a task; Airflow handles schedule, retries and history
from airflow.sdk import dag, task
import pendulum

@dag(schedule="@weekly", start_date=pendulum.datetime(2026, 1, 1), catchup=False, tags=["churn"])
def churn_training():
    @task(retries=2)
    def extract(ds=None): ...          # read the snapshot for the logical date `ds`
    @task
    def validate(path): ...
    @task
    def train(path): ...               # log to MLflow, register a new version
    @task
    def gate(version): ...             # compare with the champion; move the alias only if it passes
    gate(train(validate(extract())))

churn_training()
```

In Snowflake, the same graph can be a set of tasks (`CREATE TASK ... AFTER ...`) calling stored procedures, or Snowflake ML Jobs for Python training code; on Kubernetes, Kubeflow Pipelines or Argo. The choice matters less than the properties: declared inputs, idempotent outputs, recorded runs.

:::check
Which statements are right?

- ✓ Caching a step by the hash of its inputs and parameters lets a rerun skip unchanged work.
- ✗ `INSERT INTO scores SELECT ...` is idempotent because it always inserts the same rows.
  Running it twice inserts the rows twice; use MERGE or overwrite the date's partition.
- ✓ Date-parameterised steps make a backfill a loop over dates.
:::

:::recap What to keep
- Small steps, declared inputs and outputs, a graph.
- Idempotent writes; cache by input hash.
- Backfills are loops; orchestrators add schedules, retries and history.
:::

## Exercises

1. Make `validate` fail for one date and show that downstream steps do not run for it.
2. Add a `register` step that only runs when the evaluation beats 0.75 AUC.
3. Rewrite the pipeline as Snowflake tasks in SQL (one task per step, `AFTER` dependencies), as text.

:::checked Sources and further reading
- [Airflow: TaskFlow tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
- [MLOps: Continuous delivery and automation pipelines in machine learning](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning), Google Cloud: level 1 pipeline automation
:::
