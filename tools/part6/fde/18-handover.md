---
title: Production Readiness, Incidents and the Handover Pack
minutes: 70
group: Rollout, adoption and handover
lessons: a1721, a1725
---
:::goals What you will be able to do
- Run a production-readiness review with a checklist that is checked by code, not by memory
- Write an incident runbook for the failure modes an AI system actually has
- Assemble a handover pack so the customer's team can run the system without you
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build and write). **Time**: about 70 minutes.
:::

:::plain The idea in one line
You have not finished until a named person at the customer owns the system, can tell when it is wrong, and knows how to switch it off.
:::

## The problem

FDE engagements end. If the system depends on the FDE's memory (which prompt version is live, where the eval set is, why a rule exists), it decays within a quarter of the FDE leaving. The handover is part of the build, planned from week one.

## The readiness checklist, checked in code

```python
READINESS = {
    "owner":        "named business owner and named technical owner",
    "runbook":      "incident runbook with the failure modes below",
    "eval_ci":      "golden-set eval runs on every change and blocks regressions",
    "monitoring":   "dashboards and alerts for volume, errors, refusals, cost, eval drift",
    "kill_switch":  "tested off switch, owned by the customer",
    "access":       "access review done; no personal or vendor accounts in production",
    "data":         "retention and redaction confirmed with the data owner",
    "versions":     "prompt, model and tool versions pinned and recorded",
    "end_date":     "date the vendor's access ends, agreed in writing",
}

state = {"owner": "Priya Shah (claims ops), Tom Reyes (platform)", "runbook": "docs/runbook.md", "eval_ci": "ci/eval.yml",
         "monitoring": "grafana/claims-agent", "kill_switch": "tested 2026-11-18", "access": "",
         "data": "signed off by DPO", "versions": "release.json", "end_date": None}

def readiness(state):
    missing = [k for k in READINESS if not state.get(k)]
    for k in missing: print(f"MISSING {k:12} {READINESS[k]}")
    return "READY" if not missing else f"NOT READY ({len(missing)} open)"

print(readiness(state))
```

Each value points to evidence (a file, a dashboard, a date). An empty value is a conversation to have this week, not on the last day.

## The runbook: failure modes an AI system has

| Symptom | Likely cause | First action | Owner |
|---|---|---|---|
| Field accuracy drops on the weekly sample | New email template or form; model or prompt change | Compare with last eval run; roll back the last change if it coincides | Technical owner |
| Spike in "needs review" | Upstream system outage (policy API) or a new claim type | Check tool error rates; pause intake if the API is down | Technical owner |
| Cost per claim jumps | Cache misses after a prompt edit; agent loops | Check cache hit rate and turns per run; restore the cached prefix order | Technical owner |
| A harmful or wrong message reached a customer | Approval step skipped or misused | Switch off proposals; review the approval logs; inform the business owner | Business owner |
| Model provider outage | Provider incident | Intake falls back to the manual queue automatically; post status | Technical owner |

Practise the off switch and the fallback once before handover, with the customer's team doing it.

## The handover pack

- **One-page system card:** what it does, what it must not do, who owns it, the agent line.
- **Architecture and data flow diagram**, the trust-boundary document (lesson 31.14).
- **Release record:** model, prompt and tool versions, and how to change each safely.
- **Eval suite** with instructions to run it, and the history of scores.
- **Runbook** and the contact list.
- **Open issues and the backlog**, ranked, with the reason for each.
- **Decision log:** the choices that look odd and why they were made (for example, why scanned PDFs route to a larger model).

:::check
Which statements are right?

- ✓ Each readiness item should point to evidence such as a file, dashboard or tested date.
- ✗ The handover pack is written in the last week, once the system is stable.
  Start it in week one; the decision log in particular cannot be reconstructed later.
- ✓ The customer's own team should practise the off switch before the vendor leaves.
:::

:::recap What to keep
- Readiness is a checklist with evidence, checked in code.
- Runbook rows for the failure modes AI systems actually have.
- System card, data flow, release record, evals, runbook, backlog, decision log.
:::

## Exercises

1. Fill in the two missing items for Harbor Mutual and rerun the check.
2. Add a runbook row for "handlers report the assistant is slow" with cause, first action and owner.
3. Write the five most important entries in Harbor Mutual's decision log.

:::checked Sources and further reading
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/): chapters on incident response and postmortem culture
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Delivery Methodology" (handover)
- [Frontier Academy](https://claude.com/programs/frontier-academy): the intensive's simulated build runs from first request through security review to handover
:::
