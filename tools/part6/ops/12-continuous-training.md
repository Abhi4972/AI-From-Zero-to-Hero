---
title: Continuous Training: Retraining Triggers, Champion and Challenger, and Feedback Loops
minutes: 60
group: Serving, release and monitoring
lessons: a0220, a0219
---
:::goals What you will be able to do
- Choose retraining triggers (schedule, drift, performance) and know what each costs
- Retrain on a sliding window and let a champion-challenger gate decide whether to switch
- Recognise feedback loops, where the model's own actions change the data it learns from
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (simulation). **Time**: about an hour.
:::

:::plain The idea in one line
Retrain when there is a reason, on the data that represents today, and only switch when the new model wins on fresh data; beware of learning from the model's own interventions.
:::

## The problem

Lesson 32.11 ended with a calibration alert in week 12. The answer is not "retrain every night" (expensive, and a bad batch can poison the model) nor "retrain when someone remembers". It is a policy.

## Triggers

| Trigger | Pros | Cons |
|---|---|---|
| Schedule (weekly, monthly) | Simple, predictable | Retrains when nothing changed; may be too slow after a shock |
| Input or prediction drift | Reacts early | Drift does not always hurt performance |
| Performance or calibration drop | Retrains when it matters | Waits for labels |
| New data volume | Uses data when there is enough of it | Ignores whether anything changed |

Most teams combine a schedule with a performance trigger, and treat drift as a reason to look.

## A retraining loop with a gate

```python
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

def week_data(week, n=3000):
    r = np.random.default_rng(100 + week)
    price = 1.12 if week >= 6 else 1.0
    tenure = r.integers(1, 72, n); monthly = (r.normal(55, 18, n) * price).clip(10, 200)
    tickets = r.poisson(1.2, n); m2m = (r.random(n) < .55).astype(int)
    effect = 0.02 if week < 6 else 0.045
    logit = -1.2 - .04 * tenure + effect * (monthly - 55) + .45 * tickets + 1.4 * m2m
    return pd.DataFrame(dict(tenure=tenure, monthly=monthly, tickets=tickets, m2m=m2m,
                             churn=(r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)))

F = ["tenure", "monthly", "tickets", "m2m"]
DATA = {w: week_data(w) for w in range(0, 21)}
LABEL_DELAY, WINDOW = 6, 4

def calib_gap(model, df):   # observed churn minus mean predicted risk
    return df.churn.mean() - model.predict_proba(df[F])[:, 1].mean()

def fit(weeks):
    df = pd.concat([DATA[w] for w in weeks]); return LogisticRegression(max_iter=500).fit(df[F], df.churn)

champion, champion_trained_on = fit([0]), [0]
log = []
for week in range(7, 21):
    matured = list(range(max(0, week - LABEL_DELAY - WINDOW + 1), week - LABEL_DELAY + 1))   # labelled weeks available now
    newest = DATA[matured[-1]]
    gap = calib_gap(champion, newest)
    action = "keep"
    if abs(gap) > 0.03:                                   # performance trigger
        train_weeks, holdout = matured[:-1], DATA[matured[-1]]     # hold out the newest matured week
        challenger = fit(train_weeks)
        c_gap, ch_gap = abs(calib_gap(challenger, holdout)), abs(calib_gap(champion, holdout))
        c_auc = roc_auc_score(holdout.churn, challenger.predict_proba(holdout[F])[:, 1])
        h_auc = roc_auc_score(holdout.churn, champion.predict_proba(holdout[F])[:, 1])
        if c_gap < ch_gap and c_auc >= h_auc - 0.005:
            champion, champion_trained_on, action = fit(matured), matured, f"retrained on weeks {matured[0]}-{matured[-1]}"
        else:
            action = "challenger lost; keep"
    log.append({"week": week, "newest_labelled": matured[-1], "calib_gap": round(gap, 3), "action": action})
pd.DataFrame(log).set_index("week")
```

The trigger fires when the first post-change cohort matures (week 12), and the challenger wins on the held-out week. That model was trained on weeks 3 to 6, mostly from before the change, so a smaller gap remains; the trigger fires again at week 17, and the retrain on weeks 8 to 11, all after the change, closes it. After that the loop keeps the model and spends no more compute. The challenger is trained on weeks that exclude the holdout, and only after it wins is the final model refit on all matured weeks.

Two design choices to notice: the **window** (recent weeks only) lets the model forget the old price relationship, at the cost of less data; and the **gate** stops a bad batch from replacing a good model automatically.

## Feedback loops

Lakeside's model drives retention offers. Customers who got an offer churn less **because of the offer**. Retrain naively on that data and the model learns that "high-risk-looking customers do not churn", lowers their scores, stops sending them offers, and churn rises: the model has undermined its own signal.

```python
r = np.random.default_rng(9)
risk = r.beta(2, 5, 20000)
offered = risk > 0.45                                     # the model's own action
churned = r.random(20000) < np.where(offered, risk * 0.5, risk)    # the offer halves churn
for lo, hi in [(0.30, 0.45), (0.45, 0.60), (0.60, 0.80)]:
    m = (risk >= lo) & (risk < hi)
    print(f"true risk {lo:.2f}-{hi:.2f}: observed churn {churned[m].mean():.2f}  (offered: {offered[m].mean():.0%})")
```

Observed churn drops at the threshold even though true risk keeps rising. Remedies: keep a small random **holdout** group that never receives offers and train on it (or weight it), record the action taken as a feature, or model the uplift of the offer directly rather than the risk.

:::check
Which statements are right?

- ✓ A champion-challenger gate stops an automatic retrain from replacing a better model.
- ✗ Retraining every night is always the safest policy.
  It costs compute, can learn from a bad batch, and amplifies feedback loops without a gate and holdout.
- ✓ A random holdout that never receives the intervention gives clean data to learn true risk from.
:::

:::recap What to keep
- Combine a schedule with a performance trigger; use drift as a prompt to look.
- Train on a recent window, gate on held-out fresh data, then refit and promote.
- Interventions change outcomes; keep a holdout or model uplift.
:::

## Exercises

1. Remove the window (train on all matured weeks). How long does the calibration gap take to close?
2. Add a schedule trigger every 8 weeks and count retrains with and without the performance trigger.
3. In the feedback-loop simulation, add a 5% random holdout and estimate true churn above the threshold from it.

:::checked Sources and further reading
- [MLOps: Continuous delivery and automation pipelines in machine learning](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning), Google Cloud: continuous training
- Sculley et al., "Hidden Technical Debt in Machine Learning Systems", NeurIPS 2015: feedback loops
- Gutierrez and Gérardy, "Causal Inference and Uplift Modelling: A Review of the Literature", 2017
:::
