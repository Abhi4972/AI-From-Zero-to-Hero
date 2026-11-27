---
title: Designing and Reading a Pilot: the Trust Ladder, Baselines and an Honest Readout
minutes: 75
group: Rollout, adoption and handover
lessons: a1720, a1452, a1721
---
:::goals What you will be able to do
- Plan a staged rollout from shadow mode to supervised automation, with a metric that unlocks each rung
- Compare pilot results with the baseline and report the difference with its uncertainty
- Write a pilot readout the sponsor can make a decision from
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method with code). **Time**: about 75 minutes.
:::

:::plain The idea in one line
Earn autonomy one rung at a time, and let measured results against the baseline, not enthusiasm, decide each step.
:::

## The problem

A pilot that switches everything on for everyone at once cannot tell you what helped, and a single bad week can end it. A ladder of rungs, each with an entry test, makes progress safe and makes the readout factual.

## The trust ladder

| Rung | What the system does | Who acts | Unlock the next rung when |
|---|---|---|---|
| 1. Shadow | Runs on live claims; output hidden from handlers, compared afterwards | Handlers, as today | Shadow eval scores meet the acceptance criteria for two weeks |
| 2. Assisted | Suggests fields and drafts; handler edits and submits | Handler | Handlers accept most suggestions with few edits; time per claim drops |
| 3. Supervised | Creates draft claims and queues document requests; handler approves in batches | Handler approves | Approval rate high, error rate at or below baseline for four weeks |
| 4. Autonomous (narrow) | Sends routine document requests without approval for one claim type | System, with sampling | Sponsor and process owner sign; sampling continues |

Harbor Mutual's release 1 stops at rung 3. Rung 4 is a separate decision with its own evidence.

## Baseline against pilot

```python
import random
from statistics import mean, median

random.seed(11)
baseline = [max(4, random.gauss(31, 9)) for _ in range(380)]       # handler minutes per claim, two weeks before the pilot
pilot = [max(4, random.gauss(23, 8)) for _ in range(410)]          # four pilot weeks, assisted rung
errors_base, n_base = 19, 380                                      # claims sent back for rework
errors_pilot, n_pilot = 17, 410

def boot_diff(a, b, n=3000, seed=3):
    r = random.Random(seed)
    ds = sorted(mean(r.choices(b, k=len(b))) - mean(r.choices(a, k=len(a))) for _ in range(n))
    return round(mean(b) - mean(a), 1), (round(ds[int(.025 * n)], 1), round(ds[int(.975 * n)], 1))

print("minutes per claim: baseline", round(mean(baseline), 1), "pilot", round(mean(pilot), 1))
print("difference and 95% interval:", boot_diff(baseline, pilot))
print(f"rework rate: baseline {errors_base / n_base:.1%}, pilot {errors_pilot / n_pilot:.1%}")
```

The time saved is large and its interval is well away from zero; the rework rate did not get worse. That is the shape of a result that justifies the next rung. Two cautions for real pilots: the baseline weeks should look like the pilot weeks (same claim mix, no storm in one and not the other), and a pilot team that knows it is being measured works differently for a while (watch whether the gain holds in weeks three and four).

## The readout

One page, in this order: **the decision asked for** (for example, "move the pilot team to supervised and extend assisted to two more teams"); **the result against the success criteria**, with intervals; **what went wrong** and what changed because of it; **cost per claim** in production terms; **risks and the plan for them**; **what the next rung needs**. Put the evidence in an appendix, not in the first page.

:::check
Which statements are right?

- ✓ Each rung of the ladder has an explicit, measured entry test.
- ✗ If handlers like the tool, the pilot has succeeded.
  Liking matters for adoption, but the decision rests on the agreed metrics against the baseline.
- ✓ A baseline taken in different conditions (a storm week, a different claim mix) can make the pilot look better or worse than it is.
:::

:::recap What to keep
- Shadow, assisted, supervised, then narrow autonomy; each rung earned.
- Compare with a like-for-like baseline and report intervals.
- The readout starts with the decision, not the method.
:::

## Exercises

1. Split the pilot data by claim type (motor, home) using a random label, and report each. What would you conclude if home showed no gain?
2. Add a novelty check: compare the first two pilot weeks with the last two. What result would worry you?
3. Draft the first five lines of the Harbor Mutual readout.

:::checked Sources and further reading
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: the trust ladder (shadow, assisted, supervised) and measuring cycle time, errors and rework
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Delivery Methodology" (pilots and baselines)
:::
