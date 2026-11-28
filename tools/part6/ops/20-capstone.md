---
title: Capstone: Take Lakeside's Churn Model and Support Assistant from Notebook to Monitored Production
minutes: 180
group: LLMOps in production
type: Project
lessons: a0219, a1911, a3118
---
:::goals What you will be able to do
- Run a complete MLOps loop: validate, train, track, register, gate, release, monitor and retrain
- Run the LLMOps loop for a prompt: register, evaluate, promote, monitor and roll back
- Assess your own system against a production-readiness rubric
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Project (graded). **Time**: about three hours, or a day with the stretch goals.
- **Setup**: `pip install mlflow scikit-learn pandas scipy`.
:::

:::plain The idea in one line
Wire every habit from the MLOps lessons (Phase 2) and the LLMOps lessons (Phase 17) into one small system, break it on purpose, and show that it notices and recovers.
:::

## The brief

Lakeside's retention director wants the churn model and the support assistant run "like real software" by the end of the quarter. You will build a compact version of the whole system here, then answer the rubric about it. The reference implementation below runs end to end; your job is to understand each piece, then extend it (the tasks at the end).

## Part 1: the ML pipeline

```python
import os, logging, warnings, hashlib, json
os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"; warnings.filterwarnings("ignore")
import tempfile; os.chdir(tempfile.mkdtemp())          # a fresh, empty workspace for this lesson's MLflow files
import numpy as np, pandas as pd, mlflow, mlflow.sklearn
from mlflow import MlflowClient
for name in ("mlflow", "alembic"): logging.getLogger(name).setLevel(logging.ERROR)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

def month_data(month, n=4000):
    r = np.random.default_rng(500 + month)
    price = 1.12 if month >= 4 else 1.0
    df = pd.DataFrame({"tenure": r.integers(1, 72, n), "monthly": (r.normal(55, 18, n) * price).clip(10, 200).round(2),
                       "tickets": r.poisson(1.2, n), "contract": r.choice(["month", "year"], n, p=[.55, .45])})
    effect = .02 if month < 4 else .045
    logit = -1.2 - .04 * df.tenure + effect * (df.monthly - 55) + .45 * df.tickets + 1.4 * (df.contract == "month")
    df["churn"] = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
    return df

def validate(df):                                    # lesson 5: the contract
    problems = []
    if not df.tenure.between(0, 120).all(): problems.append("tenure range")
    if not df.monthly.between(5, 400).all(): problems.append("monthly range")
    if not set(df.contract) <= {"month", "year"}: problems.append("contract values")
    if len(df) < 500: problems.append("row count")
    return problems

def features(df):                                    # lesson 6: one definition for training and serving
    return pd.DataFrame({"tenure_years": df.tenure / 12, "monthly_log": np.log1p(df.monthly),
                         "tickets": df.tickets.clip(upper=20), "m2m": (df.contract == "month").astype(int)})

fingerprint = lambda df: "sha256:" + hashlib.sha256(df.to_csv(index=False).encode()).hexdigest()[:16]

mlflow.set_tracking_uri("sqlite:///mlflow.db"); mlflow.set_experiment("lakeside-capstone")
client, NAME = MlflowClient(), "lakeside-churn-capstone"

def train_and_register(months):
    df = pd.concat([month_data(m) for m in months])
    if (p := validate(df)): raise ValueError(f"validation failed: {p}")
    with mlflow.start_run(run_name=f"train {months[0]}-{months[-1]}"):
        model = LogisticRegression(max_iter=500).fit(features(df), df.churn)
        mlflow.log_params({"months": f"{months[0]}-{months[-1]}", "model": "logreg"})
        mlflow.set_tags({"data_fingerprint": fingerprint(df)})
        info = mlflow.sklearn.log_model(model, name="model", registered_model_name=NAME, input_example=features(df).head(3))
    return str(info.registered_model_version)

def evaluate(version, df):
    m = mlflow.sklearn.load_model(f"models:/{NAME}/{version}")
    p = m.predict_proba(features(df))[:, 1]
    return {"auc": round(roc_auc_score(df.churn, p), 3), "calib_gap": round(float(df.churn.mean() - p.mean()), 3)}

v1 = train_and_register([0, 1])
client.set_registered_model_alias(NAME, "champion", v1)
print("v1 champion:", evaluate(v1, month_data(2)))
```

## Part 2: monitor, trigger, gate, promote

```python
def psi(a, b, bins=10):
    e = np.unique(np.quantile(a, np.linspace(0, 1, bins + 1))); e[0], e[-1] = -np.inf, np.inf
    pa, pb = np.histogram(a, e)[0] / len(a) + 1e-4, np.histogram(b, e)[0] / len(b) + 1e-4
    return float(np.sum((pb - pa) * np.log(pb / pa)))

reference = month_data(1)
history = []
for month in range(2, 8):
    champ = client.get_model_version_by_alias(NAME, "champion").version
    live = month_data(month)
    if validate(live): history.append((month, champ, "scoring blocked")); continue
    drift = round(psi(reference.monthly, live.monthly), 3)
    labelled = month_data(month - 1)                      # labels arrive a month later
    perf = evaluate(champ, labelled)
    action = "keep"
    if abs(perf["calib_gap"]) > 0.03:                     # lesson 12: performance trigger
        challenger = train_and_register([month - 2, month - 1])
        holdout = month_data(month - 1).sample(frac=.3, random_state=month)
        c, h = evaluate(challenger, holdout), evaluate(champ, holdout)
        if abs(c["calib_gap"]) < abs(h["calib_gap"]) and c["auc"] >= h["auc"] - 0.005:
            client.set_registered_model_alias(NAME, "previous_champion", champ)
            client.set_registered_model_alias(NAME, "champion", challenger)
            client.set_model_version_tag(NAME, challenger, "promotion_reason", f"calib gap {h['calib_gap']} -> {c['calib_gap']}")
            action = f"promoted v{challenger}"
        else:
            action = f"challenger v{challenger} lost"
    history.append((month, champ, f"psi {drift}, last month {perf}, {action}"))
for h in history: print(h)
```

Note that the holdout here is drawn from data the challenger was trained on; that flatters the challenger. Fixing it is task 1 below.

## Part 3: the support assistant's prompt

```python
P_OLD = "Reply to this Lakeside customer: {{email}}"
P_NEW = "Reply to this Lakeside customer in under 120 words. Never promise refunds; billing disputes go to a specialist within 2 working days. Email: {{email}}"
a = mlflow.genai.register_prompt(name="capstone-reply", template=P_OLD, commit_message="v1")
b = mlflow.genai.register_prompt(name="capstone-reply", template=P_NEW, commit_message="refund rule, length")
mlflow.genai.set_prompt_alias("capstone-reply", alias="production", version=a.version)

RECORDED = {a.version: ["We'll refund the overcharge today.", "Please send your account number.", "Refund approved!"],
            b.version: ["A billing specialist will reply within 2 working days.", "Please send your account number.", "A specialist will review the charge."]}
def passes(reply): return not any(w in reply.lower() for w in ["refund the", "refund approved", "we'll refund"])
rate = {v: round(sum(map(passes, outs)) / len(outs), 2) for v, outs in RECORDED.items()}
if rate[b.version] > rate[a.version]:
    mlflow.genai.set_prompt_alias("capstone-reply", alias="production", version=b.version)
print("pass rates by prompt version:", rate, "| production now:", mlflow.genai.load_prompt("prompts:/capstone-reply@production").version)
```

## Part 4: the readiness check

```python
RUBRIC = [
    ("Reproducible", "data fingerprint, code commit, environment and seed recorded for every model version"),
    ("Validated", "inputs checked before training and before scoring; failures block with a clear message"),
    ("Point-in-time", "features joined as of the prediction time; one shared feature function"),
    ("Tracked", "every run logged with params, metrics and tags"),
    ("Registered", "serving loads by alias; promotion and rollback are alias moves with reasons"),
    ("Gated", "challenger must beat champion on fresh held-out data, by slice, with an interval"),
    ("Tested", "data, feature, quality-by-slice and behaviour tests in CI"),
    ("Released safely", "shadow and canary with automatic rollback"),
    ("Monitored", "input drift, prediction drift, delayed-label performance and calibration, with alerts"),
    ("Retrained", "trigger policy, sliding window, feedback-loop holdout"),
    ("Governed", "model card generated, approval recorded, append-only audit trail"),
    ("LLM artifacts", "prompts, model ID, index and tools versioned in a release manifest"),
    ("LLM evals", "golden set from production traces; calibrated judge; gate on every release"),
    ("LLM monitoring", "quality proxies, safety, cost, latency and topic drift, tied to release versions"),
]

def grade(scores):                                    # 0 missing, 1 partly, 2 done with evidence
    total = sum(scores.get(k, 0) for k, _ in RUBRIC)
    zeros = [k for k, _ in RUBRIC if scores.get(k, 0) == 0]
    return f"{total}/{2 * len(RUBRIC)}", ("PASS" if total >= 20 and not zeros else "NOT YET"), zeros

this_notebook = {"Reproducible": 1, "Validated": 2, "Point-in-time": 1, "Tracked": 2, "Registered": 2, "Gated": 1,
                 "Tested": 0, "Released safely": 0, "Monitored": 1, "Retrained": 2, "Governed": 0,
                 "LLM artifacts": 1, "LLM evals": 1, "LLM monitoring": 0}
print(grade(this_notebook))
```

The reference implementation scores honestly as "not yet": it has no CI tests, no staged release, no governance and no LLM monitoring. The tasks below close those gaps.

## Your tasks

1. **Fix the leaky holdout** in Part 2: evaluate the challenger on a month it was not trained on. How does the promotion history change?
2. **Add CI-style tests** (lesson 32.8) that run before `train_and_register` registers anything: an invariance test and a directional test on `tickets`.
3. **Add a canary** (lesson 32.10) between the gate and the alias move, with an automatic rollback rule.
4. **Generate a model card** (lesson 32.13) for each promoted version and refuse promotion without an approval field.
5. **Add LLM monitoring** (lesson 32.18): simulate four weeks of request logs, including one topic shift, and alert on it.
6. **Write a release manifest** (lesson 32.15) for the support assistant that records the prompt version promoted in Part 3.
7. **Score yourself again** with `grade`. Pass needs 20 of 28 and no zeros.

## Stretch goals

- Rebuild Part 1 and the monitor in Snowflake using the code in lesson 32.14: a feature view, `log_model`, aliases and `CREATE MODEL MONITOR`.
- Replace the rule grader in Part 3 with a model judge, and calibrate it on 50 hand-labelled replies (lesson 32.17).
- Write the on-call runbook for the three alerts most likely to fire.

:::check
Which statements are right?

- ✓ A challenger evaluated on data it was trained on looks better than it is.
- ✗ A system that retrains automatically does not need a gate.
  Without a gate, a bad batch or a leaky evaluation can replace a good model.
- ✓ The rubric's no-zero rule means one missing practice is enough to fail.
:::

:::recap What to keep
- The loop: validate, train, track, register, gate, release, monitor, retrain.
- The LLM loop: version, evaluate, promote by alias, monitor, roll back.
- Score yourself honestly; fix zeros before polishing twos.
:::

## Exercises

1. Complete tasks 1 to 7 and report your before and after scores.
2. Break the pipeline on purpose (send `monthly` in pence in month 5). Show which component notices first.
3. Write a one-page handover note for the team that will run this system.

:::checked Sources and further reading
- [MLOps: Continuous delivery and automation pipelines in machine learning](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning), Google Cloud
- [The ML Test Score](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017
- [MLflow documentation](https://mlflow.org/docs/latest/)
:::
