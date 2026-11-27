---
title: Qualifying Use Cases: Fit Scoring and an ROI Model with a Baseline
minutes: 75
group: Discovery and scoping
lessons: a1449, a1452
---
:::goals What you will be able to do
- Score candidate use cases on value, feasibility, data readiness, risk and adoption
- Build an ROI model from a measured baseline, with the assumptions visible
- Test how sensitive the ROI is to the assumption you are least sure of
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method with code). **Time**: about 75 minutes.
:::

:::plain The idea in one line
Say no early: score each use case on five tests, and only build the ones whose business case survives its weakest assumption.
:::

## The problem

Discovery produces more ideas than any team can build. Picking by excitement leads to the hardest, riskiest idea first. A simple, explicit score makes the choice arguable in a meeting, and an ROI model with a sensitivity check shows the sponsor what has to be true for the money to come back.

## Five fit tests

| Test | Question | 1 (poor) | 5 (strong) |
|---|---|---|---|
| Value | How much does it move the sponsor's number? | Nice to have | Large, measured pain |
| Feasibility | Can current models do it reliably? | Needs judgement models do badly | Pattern the model already does well |
| Data readiness | Can we reach the inputs and the ground truth? | No access, no labels | Access granted, examples labelled |
| Risk | What does a mistake cost, and can a person catch it? | Irreversible, unreviewed | Reversible, reviewed |
| Adoption | Will the users want it? | Threatens their role | Removes work they hate |

```python
CANDIDATES = {
    "Draft missing-document requests": dict(value=4, feasibility=5, data=4, risk=5, adoption=5),
    "Extract claim fields from emails": dict(value=4, feasibility=4, data=3, risk=4, adoption=4),
    "Auto-approve small claims":        dict(value=5, feasibility=3, data=3, risk=1, adoption=3),
    "Photo damage estimate":            dict(value=3, feasibility=2, data=2, risk=2, adoption=3),
}
WEIGHTS = dict(value=0.3, feasibility=0.2, data=0.2, risk=0.15, adoption=0.15)
FLOOR = 2   # any single test at or below this blocks the use case for now

for name, s in sorted(CANDIDATES.items(), key=lambda kv: -sum(WEIGHTS[k] * v for k, v in kv[1].items())):
    score = sum(WEIGHTS[k] * v for k, v in s.items())
    blocked = [k for k, v in s.items() if v <= FLOOR]
    print(f"{name:34} {score:.2f}  {'BLOCKED by ' + ', '.join(blocked) if blocked else 'go'}")
```

The floor matters more than the weights. "Auto-approve small claims" has the highest value but an irreversible, unreviewed risk; it goes on the roadmap for after trust is earned, not first.

## The ROI model

Use the baseline from discovery and keep every assumption in one place so the sponsor can change it.

```python
def roi(a, months=12):
    minutes_saved = a["claims_per_day"] * a["working_days_per_month"] * a["minutes_saved_per_claim"] * a["adoption"]
    value = minutes_saved / 60 * a["loaded_cost_per_hour"]
    run_cost = a["claims_per_day"] * a["working_days_per_month"] * a["model_cost_per_claim"] + a["support_per_month"]
    monthly = value - run_cost
    payback = a["build_cost"] / monthly if monthly > 0 else float("inf")
    return dict(monthly_net=round(monthly), payback_months=round(payback, 1), year_net=round(monthly * months - a["build_cost"]))

base = dict(claims_per_day=400, working_days_per_month=21, minutes_saved_per_claim=8, adoption=0.7,
            loaded_cost_per_hour=38.0, model_cost_per_claim=0.06, support_per_month=3000, build_cost=90000)
print(roi(base))
```

`model_cost_per_claim` is a placeholder: compute it from your own token counts and the current price list (lesson 31.15 does this properly).

## Which assumption breaks it?

```python
for key, values in [("minutes_saved_per_claim", [3, 5, 8, 10]), ("adoption", [0.3, 0.5, 0.7, 0.9])]:
    for v in values:
        r = roi({**base, key: v})
        print(f"{key}={v:<4} payback {r['payback_months']:>5} months, first-year net {r['year_net']:>8}")
```

Below about 3 minutes saved, or with adoption under a third, the case barely pays back in a year. That tells you what the pilot must prove: minutes saved per claim and real adoption, not model accuracy in isolation.

:::check
Which statements are right?

- ✓ A use case with one very poor test (for example irreversible, unreviewed risk) should wait, whatever its total score.
- ✗ ROI should use the sponsor's estimate of time saved, since they know the business.
  It should use a measured baseline; the sponsor's estimate is an assumption to test.
- ✓ The sensitivity check tells you what the pilot has to prove.
:::

:::recap What to keep
- Five tests, explicit weights, and a floor that blocks risky ideas.
- ROI from a measured baseline, with assumptions in one editable place.
- Find the assumption that breaks the case; make the pilot measure it.
:::

## Exercises

1. Add a sixth candidate from your own work and score it. Which test is hardest to score honestly?
2. Add a one-off integration cost that only applies to the "Extract claim fields" use case and compare its payback with "Draft missing-document requests".
3. Make `adoption` ramp from 0.2 to 0.7 over the first four months instead of starting at 0.7. How much does the first-year net fall?

:::checked Sources and further reading
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Delivery Methodology" covers qualifying use cases for ROI and capturing baselines
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: scoring an engagement on fit tests before writing code
:::
