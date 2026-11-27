---
title: Driving Adoption: Champions, Training and Usage Telemetry That Tells the Truth
minutes: 60
group: Rollout, adoption and handover
lessons: a1454
---
:::goals What you will be able to do
- Plan adoption with champions, task-based training and a feedback channel people actually use
- Measure adoption with cohort retention and depth of use, not logins
- Spot the three adoption failure patterns early
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method with code). **Time**: about an hour.
:::

:::plain The idea in one line
A deployment succeeds when people choose to use it on an ordinary Tuesday; measure that, and help the teams where it is not happening.
:::

## The problem

Launch week usage is always high. What matters is week six: are handlers still using the assistant for the claims it helps with, and using it fully (accepting drafts) rather than opening it and redoing the work by hand? Login counts cannot answer that.

## The adoption plan

- **Champions:** one respected handler per team, trained first, given a direct line to you, and credited for the feedback they bring.
- **Task-based training:** 30 minutes on their own claims, not a slide deck: "here is how to handle a claim with missing documents with the assistant".
- **Feedback in the flow:** a thumbs-down with a reason inside the review screen, triaged weekly, with replies. People stop reporting problems nobody answers.
- **Leadership signal:** the sponsor uses the readout numbers in team meetings; adoption follows what managers ask about.

## Measuring adoption

```python
from collections import defaultdict

# (handler, week, claims handled that week, claims where the assistant's draft was accepted)
usage = [("ana", 1, 40, 30), ("ana", 2, 42, 35), ("ana", 3, 38, 33), ("ana", 4, 41, 37),
         ("ben", 1, 35, 20), ("ben", 2, 36, 12), ("ben", 3, 30, 4),  ("ben", 4, 33, 2),
         ("chen", 1, 44, 10), ("chen", 2, 40, 22), ("chen", 3, 43, 30), ("chen", 4, 39, 31),
         ("dev", 1, 37, 25), ("dev", 2, 0, 0),    ("dev", 3, 0, 0),   ("dev", 4, 0, 0)]

weeks = defaultdict(dict)
for h, w, total, accepted in usage:
    weeks[h][w] = (total, accepted)

for h, ws in weeks.items():
    depth = [round(a / t, 2) if t else None for t, a in (ws[w] for w in sorted(ws))]
    trend = "rising" if depth[-1] and depth[0] and depth[-1] > depth[0] + .1 else "falling" if (depth[-1] or 0) < (depth[0] or 0) - .1 else "flat"
    print(f"{h:5} acceptance by week {depth}  -> {trend}")

active = [sum(1 for h in weeks if weeks[h][w][0] > 0 and weeks[h][w][1] / weeks[h][w][0] >= 0.5) for w in range(1, 5)]
print("handlers using it for at least half their claims, by week:", active)
```

Four handlers, four stories. Ana adopted and stayed. Chen started slowly and is now a strong user (often the best champion: they know what was hard). Ben is drifting away from the drafts: talk to Ben this week, because a falling user usually has a concrete reason (a claim type the system handles badly, a step that got slower). Dev's numbers stop entirely: on leave, moved team, or blocked by an access problem; find out which.

## Three failure patterns

| Pattern | What the data shows | Usual cause | Response |
|---|---|---|---|
| Launch spike, then decay | High week 1, falling after | Did not help on the claims that matter to them | Ask the drifting users; fix the slice that fails |
| Shallow use | Opened often, drafts rarely accepted | Output needs too many edits to be worth it | Look at edits; improve the step, or stop offering it there |
| One-team success | Pilot team high, new teams low | Champions and training did not travel | Train the new teams on their own claims, with their own champion |

:::check
Which statements are right?

- ✓ Depth of use (drafts accepted) says more than logins.
- ✗ A handler whose usage falls is resisting change and needs more training.
  A falling user usually has a concrete reason; ask before assuming.
- ✓ Champions are most useful when they are respected handlers with a direct line to the team building the system.
:::

:::recap What to keep
- Champions, task-based training, answered feedback, a visible sponsor.
- Measure retention and depth by person and week.
- Talk to drifting users first; they show you what to fix.
:::

## Exercises

1. Add a "minutes per claim" column to the usage data and show whether acceptance and time saved move together.
2. Write the three questions you would ask Ben.
3. Define the adoption target for week 8 that the sponsor should hold the operation to.

:::checked Sources and further reading
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Driving Enterprise Adoption of Claude" and "Delivery Methodology" (adoption and champions)
- Everett M. Rogers, *Diffusion of Innovations*, 5th edition, 2003
:::
