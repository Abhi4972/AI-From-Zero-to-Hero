---
title: Mapping the Real Workflow, and Cutting Steps before Automating Them
minutes: 70
group: Discovery and scoping
lessons: a1448, a1450, a1515
---
:::goals What you will be able to do
- Rebuild a workflow from event logs and compare it with what people say they do
- Mark each step keep, cut, human or AI, with a reason
- Draw the agent line: which decisions the system may make, and which stay with a person
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method with code). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Map what actually happens from the logs, delete the steps that should not exist, and only then decide which of the rest a model should do.
:::

## The problem

Automating a bad process produces a fast bad process. And the process in the operations manual is rarely the one people follow: handlers skip a step that never matters, add one the manual forgot, wait on a colleague for an hour. Logs show the real path and where the time goes.

## Rebuild the workflow from the logs

Harbor Mutual's claims system writes an event each time a claim changes state. Grouping events by claim and measuring the gap between steps shows where time is spent, including the waiting nobody reports.

```python
from datetime import datetime as dt
from collections import defaultdict
from statistics import median

log = """C1,email received,08:02
C1,claim opened,08:40
C1,policy looked up,08:47
C1,documents requested,08:55
C1,documents received,13:10
C1,fields entered,13:31
C1,sent to adjuster,13:35
C2,email received,08:15
C2,claim opened,09:30
C2,policy looked up,09:41
C2,fields entered,09:58
C2,sent to adjuster,10:02
C3,email received,09:05
C3,claim opened,09:20
C3,policy looked up,09:24
C3,documents requested,09:40
C3,documents received,16:45
C3,fields entered,17:02
C3,sent to adjuster,17:06"""

by_claim = defaultdict(list)
for line in log.splitlines():
    cid, step, t = line.split(",")
    by_claim[cid].append((step, dt.strptime(t, "%H:%M")))
gaps = defaultdict(list)
for events in by_claim.values():
    for (a, ta), (b, tb) in zip(events, events[1:]):
        gaps[f"{a} -> {b}"].append((tb - ta).seconds / 60)
for k, v in sorted(gaps.items(), key=lambda kv: -median(kv[1])):
    print(f"{k:44} median {median(v):6.0f} min   in {len(v)} of {len(by_claim)} claims")
```

Two findings a meeting would miss: claims wait a long time before anyone opens them, and when documents are missing the claim waits hours. Typing fields, the step everyone complains about, is a small share of elapsed time.

## Keep, cut, human or AI

| Step | Decision | Why |
|---|---|---|
| Email received → claim opened | AI (triage and open draft claim) | Pure waiting; a model can classify and open the claim at once |
| Policy looked up | AI (tool call, read-only) | Deterministic lookup once the policy number is extracted |
| Documents requested | AI drafts, human sends at first | Wrong requests annoy customers; earn trust before auto-sending |
| Documents received → fields entered | AI extracts, human reviews | Extraction is a model strength; review catches the rest |
| Re-entering the date in a second system | Cut | Fix the integration, do not automate the copying |
| Sent to adjuster | Keep (human) | Coverage decisions stay with licensed people |

## The agent line

Write down, before building, which decisions the system may own. For Harbor Mutual in the first release: it may **classify, extract, look up, draft and queue**; it may **not** send messages to customers without approval, change payment amounts, deny claims, or close claims. Every action on the wrong side of the line is either absent from the tool list or requires a person to approve it (the propose-then-commit pattern).

:::check
Which statements are right?

- ✓ Event logs show waiting time that people rarely mention in interviews.
- ✗ The step people complain about most is always the best one to automate.
  Here the waits before opening and for documents cost far more elapsed time than typing.
- ✓ A step that copies data between two systems is better cut (fix the integration) than automated.
:::

:::recap What to keep
- Rebuild the real workflow from logs; compare it with what people say.
- Cut before you automate.
- Draw the agent line early and enforce it in the tool list.
:::

## Exercises

1. Add a claim C4 where the policy lookup happens twice (a wrong number the first time). How would you detect rework loops in the log?
2. Compute the share of total elapsed time spent waiting for documents across the three claims.
3. Write Harbor Mutual's agent line for release two, after a successful pilot. Which one action would you move across the line first, and what evidence would you need?

:::checked Sources and further reading
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: workflow redesign and "the agent line"
- Wil van der Aalst, *Process Mining: Data Science in Action*, Springer, 2016
:::
