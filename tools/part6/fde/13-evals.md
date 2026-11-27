---
title: Evals as the Contract: Golden Sets, Graders and a Release Gate
minutes: 80
group: Trust: evals, security and cost
lessons: a1110, a1430, a0527
---
:::goals What you will be able to do
- Build a golden set from customer-labelled cases, with slices for the cases that matter most
- Combine exact, rule-based and rubric graders, and know when a model grader is acceptable
- Report scores with confidence intervals and gate releases on regressions
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 80 minutes.
:::

:::plain The idea in one line
The eval suite is the definition of done the customer signed: every change runs it, and nothing ships that makes it worse.
:::

## The problem

The acceptance criteria in lesson 31.7 are numbers on a test set. This lesson builds that test set and the machinery around it. Two traps are common: a test set that is easy (so everything passes), and a single average that hides a failing slice (motor claims fine, home claims broken).

## The golden set

Ask the users to label real, recent cases, including the awkward ones: scanned PDFs, two claims in one email, a forwarded chain, a policy number in an image. Keep a slice label on each case so results can be broken down. Freeze the set and version it; add new cases only as a new version, so scores stay comparable.

## Graders

```python
import random, re
from statistics import mean

GOLD = [  # case id, slice, expected fields
    ("c01", "motor", {"policy_number": "HM-482913", "loss_date": "2026-11-02"}),
    ("c02", "home",  {"policy_number": "HM-110204", "loss_date": "2026-10-28"}),
    ("c03", "home",  {"policy_number": "HM-220981", "loss_date": "2026-11-05"}),
    ("c04", "motor", {"policy_number": "HM-301177", "loss_date": "2026-11-01"}),
    ("c05", "scan",  {"policy_number": "HM-552100", "loss_date": "2026-10-30"}),
    ("c06", "scan",  {"policy_number": "HM-700412", "loss_date": "2026-11-03"}),
]
RUN_A = {"c01": {"policy_number": "HM-482913", "loss_date": "2026-11-02"}, "c02": {"policy_number": "HM-110204", "loss_date": "2026-10-28"},
         "c03": {"policy_number": "HM-220981", "loss_date": "2026-11-05"}, "c04": {"policy_number": "HM-301177", "loss_date": "2026-11-01"},
         "c05": {"policy_number": "HM-552100", "loss_date": "2026-03-10"}, "c06": {"policy_number": None, "loss_date": "2026-11-03"}}
RUN_B = {**RUN_A, "c05": {"policy_number": "HM-552100", "loss_date": "2026-10-30"}, "c06": {"policy_number": "HM-700412", "loss_date": "2026-11-03"},
         "c02": {"policy_number": "HM-110204", "loss_date": "2026-10-82"}}

def field_score(expected, got):
    return mean(1.0 if got.get(k) == v else 0.0 for k, v in expected.items())

def evaluate(run):
    rows = [(cid, sl, field_score(exp, run[cid])) for cid, sl, exp in GOLD]
    by = {}
    for _, sl, s in rows: by.setdefault(sl, []).append(s)
    return rows, {sl: round(mean(v), 2) for sl, v in by.items()}, round(mean(s for *_, s in rows), 3)

for name, run in [("A (current)", RUN_A), ("B (candidate)", RUN_B)]:
    rows, slices, overall = evaluate(run)
    print(f"{name:14} overall {overall}  by slice {slices}")
```

Run B improves the scanned slice but breaks a home case with an impossible date. The overall number rose; a per-slice gate catches the regression anyway.

| Grader | Use for | Watch out |
|---|---|---|
| Exact match | IDs, numbers, dates, labels | Normalise formats first |
| Rule-based | Constraints (date not in future, amount within limits) | Rules drift from the business; review them |
| Model grader with a rubric | Free text (is this document request polite, specific, correct?) | Calibrate against human ratings on 50+ cases before trusting it |
| Human review | Small samples, disagreements, new slices | Two raters, and measure their agreement |

## Confidence intervals and the gate

With small test sets, a two-point change can be noise. A paired bootstrap over cases gives an interval for the difference between runs.

```python
def paired_bootstrap(a, b, n=2000, seed=7):
    rnd = random.Random(seed); diffs = [y - x for x, y in zip(a, b)]
    stats = sorted(mean(rnd.choice(diffs) for _ in diffs) for _ in range(n))
    return round(mean(diffs), 3), (round(stats[int(0.025 * n)], 3), round(stats[int(0.975 * n)], 3))

a = [s for *_, s in evaluate(RUN_A)[0]]; b = [s for *_, s in evaluate(RUN_B)[0]]
print("mean difference and 95% interval:", paired_bootstrap(a, b))

def gate(old_slices, new_slices, tolerance=0.0):
    worse = {k: (old_slices[k], v) for k, v in new_slices.items() if v < old_slices[k] - tolerance}
    return ("BLOCK", worse) if worse else ("SHIP", {})
print(gate(evaluate(RUN_A)[1], evaluate(RUN_B)[1]))
```

The interval spans zero: six cases cannot show that B is better overall. And the gate blocks B for the home slice regardless. That is the conversation to have with the customer: grow the golden set where the uncertainty is, and fix the date normalisation before shipping.

:::check
Which statements are right?

- ✓ Per-slice results can block a release even when the overall score improves.
- ✗ A model grader can replace human labels as soon as it is set up.
  Calibrate it against human ratings first, and keep sampling.
- ✓ With a small test set, report an interval, not only the mean difference.
:::

:::recap What to keep
- Golden set from real, labelled, awkward cases; versioned; sliced.
- Exact and rule graders first, calibrated model graders for free text.
- Gate on slices and report intervals; grow the set where it is uncertain.
:::

## Exercises

1. Add a rule grader that fails any loss date in the future or more than two years old, and rerun both runs.
2. Add 20 synthetic home cases where both runs are right. How does the bootstrap interval change, and is that honest?
3. Write a rubric with three criteria for document-request emails, and the instructions you would give a model grader.

:::checked Sources and further reading
- [Define success criteria and build evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), Claude documentation
- Efron and Tibshirani, *An Introduction to the Bootstrap*, 1993
:::
