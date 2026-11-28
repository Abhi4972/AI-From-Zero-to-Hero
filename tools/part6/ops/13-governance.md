---
title: Model Governance: Model Cards, Lineage, Approvals and an Audit Trail
minutes: 55
group: Governance and Snowflake-native MLOps
lessons: a1726, a1725
---
:::goals What you will be able to do
- Generate a model card from registry metadata and evaluation results instead of writing it by hand
- Record lineage from data snapshot to deployed version, and the approvals in between
- Check a release against a governance policy in code, as part of the pipeline
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 55 minutes.
:::

:::plain The idea in one line
For every model in production, anyone authorised should be able to answer: what is it for, what was it trained on, how good is it and for whom, who approved it, and what changed since.
:::

## The problem

Lakeside's churn scores now decide who receives discounts. The risk team asks four questions: what data was used, does it treat customer groups fairly, who approved it, and what happens if it is wrong? Regulation is moving the same way: the EU AI Act sets documentation, logging and human-oversight duties for high-risk systems, and frameworks such as ISO/IEC 42001 and the NIST AI RMF ask for similar evidence (lesson 17.26 covers the compliance landscape). The cheapest way to have the evidence is to produce it automatically from the pipeline.

## A model card from the metadata you already have

```python
import json, datetime
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

r = np.random.default_rng(0); n = 6000
df = pd.DataFrame({"tenure": r.integers(1, 72, n), "tickets": r.poisson(1.2, n), "m2m": (r.random(n) < .55).astype(int),
                   "age_band": r.choice(["18-34", "35-54", "55+"], n, p=[.35, .4, .25])})
logit = -1.2 - .04 * df.tenure + .45 * df.tickets + 1.4 * df.m2m
df["churn"] = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)
train, test = df.iloc[:4000], df.iloc[4000:]
F = ["tenure", "tickets", "m2m"]
model = LogisticRegression(max_iter=500).fit(train[F], train.churn)
test = test.assign(score=model.predict_proba(test[F])[:, 1])

def group_metrics(test, col, threshold=0.5):
    rows = {}
    for g, d in test.groupby(col):
        rows[g] = {"n": len(d), "auc": round(roc_auc_score(d.churn, d.score), 3),
                   "flag_rate": round(float((d.score > threshold).mean()), 3),
                   "recall": round(float(((d.score > threshold) & (d.churn == 1)).sum() / max(1, d.churn.sum())), 3)}
    return rows

REGISTRY_ENTRY = {"name": "lakeside-churn", "version": "7", "alias": "champion", "owner": "churn-team (Priya Shah)",
                  "run_id": "3f9a1c", "code_commit": "a41f9c2", "data_fingerprint": "sha256:9bcd64ce4b2cf2f5",
                  "trained_at": "2026-11-20", "approved_by": None}

def model_card(entry, test):
    return {
        "model": f"{entry['name']} v{entry['version']}", "owner": entry["owner"],
        "intended_use": "Rank customers by 60-day churn risk for the retention team's call list.",
        "not_for": ["Pricing decisions", "Credit or collections decisions", "Any automated action without a person"],
        "inputs": F, "excluded_inputs": {"age_band": "protected-adjacent; used only for fairness evaluation"},
        "training_data": {"fingerprint": entry["data_fingerprint"], "period": "2025-11 to 2026-10"},
        "evaluation": {"overall_auc": round(roc_auc_score(test.churn, test.score), 3), "by_age_band": group_metrics(test, "age_band")},
        "limitations": ["Labels arrive about 6 weeks late; calibration is checked monthly",
                        "Customers with under 1 month of tenure are poorly represented"],
        "lineage": {k: entry[k] for k in ("run_id", "code_commit", "data_fingerprint", "trained_at")},
        "approval": entry["approved_by"],
    }

card = model_card(REGISTRY_ENTRY, test)
print(json.dumps(card["evaluation"], indent=1))
```

Look at the evaluation by age band before anyone signs: here recall and flag rate are within a couple of points across bands, and AUC is a little higher for the oldest band; that is the evidence the risk team asked for. If one band's recall were much lower, the card would make that visible, and the policy below would block the release.

## The policy, checked in code

```python
POLICY = {
    "required_fields": ["owner", "intended_use", "not_for", "training_data", "evaluation", "limitations", "lineage"],
    "min_auc": 0.75,
    "max_recall_gap": 0.10,          # between best and worst group
    "approval_required": True,
}

def check_release(card, policy=POLICY):
    issues = [f"missing {f}" for f in policy["required_fields"] if not card.get(f)]
    if card["evaluation"]["overall_auc"] < policy["min_auc"]: issues.append("AUC below policy minimum")
    rec = [g["recall"] for g in card["evaluation"]["by_age_band"].values()]
    if max(rec) - min(rec) > policy["max_recall_gap"]: issues.append(f"recall gap {max(rec) - min(rec):.2f} across age bands")
    if policy["approval_required"] and not card["approval"]: issues.append("no recorded approval")
    return ("BLOCK", issues) if issues else ("RELEASE", [])

print(check_release(card))
card["approval"] = {"by": "risk-office (J. Okoye)", "at": "2026-11-24T10:12Z", "ticket": "RISK-2291"}
print(check_release(card))
```

## The audit trail

```python
AUDIT = []
def audit(event, **details):
    AUDIT.append({"at": datetime.datetime(2026, 11, 24, 10, len(AUDIT)).isoformat(), "event": event, "details": json.dumps(details)})

audit("trained", model="lakeside-churn", version="7", run_id="3f9a1c", data="sha256:9bcd64ce4b2cf2f5")
audit("evaluated", version="7", overall_auc=card["evaluation"]["overall_auc"])
audit("approved", version="7", by="risk-office (J. Okoye)", ticket="RISK-2291")
audit("alias_moved", alias="champion", from_version="6", to_version="7", by="ci-pipeline")
pd.set_option("display.max_colwidth", 90)
pd.DataFrame(AUDIT)
```

The audit log is append-only and written by the pipeline, not by people. Store it where the model team cannot edit it (a separate schema with insert-only grants, or the platform's access history). When someone asks "why did customer X get an offer on 3 December?", the answer joins the scoring log (model version, inputs, score) to this trail.

:::check
Which statements are right?

- ✓ A model card generated from registry and evaluation data stays in step with the model.
- ✗ Leaving a protected attribute out of the inputs proves the model is fair.
  Other features can stand in for it; evaluate outcomes by group to check.
- ✓ An audit trail should be append-only and written by the pipeline.
:::

:::recap What to keep
- Model card: use, misuse, data, evaluation by group, limitations, lineage, approval.
- Encode the governance policy and run it in the pipeline.
- Append-only audit trail joined to scoring logs answers "why".
:::

## Exercises

1. Make the model use `age_band` and rerun the card and policy. Which checks catch it, and which do not?
2. Add a `retire_by` date to the card and a policy rule that blocks models past it.
3. Write the query that answers "which model version scored customer 4412 on 3 December, with what inputs?" against tables you design.

:::checked Sources and further reading
- Mitchell et al., "Model Cards for Model Reporting", FAT* 2019
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [Regulation (EU) 2024/1689, the AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj), Articles 11 to 14: documentation, record-keeping, transparency and human oversight
:::
