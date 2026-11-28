---
title: Releasing Models Safely: Shadow Mode, Canary Rollouts, A/B Tests and Automatic Rollback
minutes: 60
group: Serving, release and monitoring
lessons: a1720, a1721
---
:::goals What you will be able to do
- Choose between shadow, canary, blue-green and A/B releases for a model change
- Run a canary that widens traffic step by step and rolls back automatically on a guardrail breach
- Separate the question "is it safe?" (canary) from "is it better?" (A/B test)
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (simulation). **Time**: about an hour.
:::

:::plain The idea in one line
Expose a new model to real traffic gradually, watch guardrail metrics at each step, and make going back automatic.
:::

## The problem

Offline tests use yesterday's data. A new model meets today's traffic for the first time in production, where an encoding mismatch, a latency spike or an odd customer segment can appear. Release strategies limit how many customers see a mistake before you notice it.

| Strategy | How it works | Answers | Users affected by a bad model |
|---|---|---|---|
| Shadow | New model scores live requests; results logged, not used | Does it run, how do its outputs differ? | None |
| Canary | New model serves a small, growing share | Is it safe at increasing load? | The canary share, briefly |
| Blue-green | Two full environments; switch all traffic at once | Fast cutover and fast switch-back | Everyone, until switched back |
| A/B test | Fixed split for a planned period | Is it better on the business metric? | The test group, for the test period |

Phase 17 (lesson 17.20) covers these for LLM serving; here they are applied to a classic model, with the decision logic written out.

## Shadow mode: compare before anyone sees it

```python
import numpy as np
r = np.random.default_rng(4)
n = 5000
champion = np.clip(r.beta(2, 5, n), 0, 1)
challenger = np.clip(champion + r.normal(0.03, 0.05, n), 0, 1)      # scores a little higher on average
agree = ((champion > .5) == (challenger > .5)).mean()
print(f"shadow: decisions agree on {agree:.1%} of requests; mean score {champion.mean():.3f} -> {challenger.mean():.3f}")
print("requests whose offer would change:", int(((champion > .5) != (challenger > .5)).sum()))
```

Shadow mode costs compute and gives no outcome data (nobody acted on the challenger's scores), but it catches crashes, latency problems and surprising disagreement, and the changed decisions are the cases to review by hand.

## A canary with automatic rollback

The canary widens traffic in steps. At each step it compares guardrails between the canary and the stable group: error rate, latency, and a business guardrail (here, the share of customers given an expensive retention offer, which finance capped).

```python
STEPS = [0.01, 0.05, 0.20, 0.50]          # after a healthy 50% step, the canary becomes the new stable
GUARDS = {"error_rate": 0.002, "p95_ms_increase": 5.0, "offer_rate_increase": 0.05}

def observe(share, requests=20000, bug_at=None, seed=0):
    r = np.random.default_rng(seed)
    k = int(requests * share)
    stable = {"error_rate": r.binomial(requests - k, 0.001) / (requests - k), "p95_ms": 21 + r.normal(0, .5), "offer_rate": 0.18 + r.normal(0, .005)}
    bad = bug_at is not None and share >= bug_at
    canary = {"error_rate": r.binomial(k, 0.009 if bad else 0.0012) / k, "p95_ms": 23 + r.normal(0, .5),
              "offer_rate": 0.20 + r.normal(0, .01)}
    return stable, canary

def run_canary(bug_at=None):
    for i, share in enumerate(STEPS):
        s, c = observe(share, bug_at=bug_at, seed=i)
        breaches = []
        if c["error_rate"] - s["error_rate"] > GUARDS["error_rate"]: breaches.append(f"errors {c['error_rate']:.3%} vs {s['error_rate']:.3%}")
        if c["p95_ms"] - s["p95_ms"] > GUARDS["p95_ms_increase"]: breaches.append("latency")
        if c["offer_rate"] - s["offer_rate"] > GUARDS["offer_rate_increase"]: breaches.append("offer rate")
        print(f"  {share:>5.0%} traffic: {'ROLLBACK ' + '; '.join(breaches) if breaches else 'healthy'}")
        if breaches: return "rolled back to champion"
    return "healthy at every step: promote to 100%"

print("release A:"); print(" ", run_canary())
print("release B (a bug that only shows at higher load):"); print(" ", run_canary(bug_at=0.20))
```

Release B looked healthy at 1% and 5% and failed at 20%, so a fifth of traffic saw elevated errors for one observation window instead of everyone for a day. In production the rollback is an alias move (lesson 32.4) or a traffic-weight change in the router, triggered by the same rules, not by a person reading a dashboard.

## A/B tests answer a different question

A canary shows the new model is **safe**. Whether it is **better** (more customers retained per pound of discount) needs a planned A/B test with a fixed split, a pre-registered metric, a sample size worked out in advance, and patience, because churn outcomes arrive weeks later.

```python
from math import ceil
def sample_size(p_base, lift, alpha_z=1.96, power_z=0.84):
    p1, p2 = p_base, p_base * (1 - lift)                     # relative reduction in churn
    pbar = (p1 + p2) / 2
    return ceil(((alpha_z * (2 * pbar * (1 - pbar)) ** .5 + power_z * (p1 * (1 - p1) + p2 * (1 - p2)) ** .5) / (p1 - p2)) ** 2)

for lift in (0.05, 0.10, 0.20):
    print(f"detect a {lift:.0%} relative drop from 12% churn: {sample_size(0.12, lift):,} customers per arm")
```

Small improvements need large samples. If the business cannot wait for that many outcomes, say so before the test starts, and decide on a proxy metric everyone agrees on.

:::check
Which statements are right?

- ✓ Shadow mode tests a model on live traffic without affecting any customer.
- ✗ A canary that stays healthy proves the new model is better.
  A canary shows it is safe; whether it is better needs an A/B test on the business metric.
- ✓ Canary rollback should be triggered automatically by guardrail rules.
:::

:::recap What to keep
- Shadow for "does it work", canary for "is it safe", A/B for "is it better".
- Widen in steps; compare guardrails with the stable group; roll back automatically.
- Size A/B tests in advance; small lifts need many customers.
:::

## Exercises

1. Add a step that holds each traffic level for a minimum time. Why does a bug that depends on time of day make this necessary?
2. Change the error guardrail to a statistical test on the two proportions. What happens at 1% traffic?
3. Compute the sample size for a 10% drop if the base churn rate is 3%. What does that mean for a smaller company?

:::checked Sources and further reading
- [Canary releases](https://martinfowler.com/bliki/CanaryRelease.html), Martin Fowler
- Kohavi, Tang and Xu, *Trustworthy Online Controlled Experiments*, Cambridge University Press, 2020
:::
