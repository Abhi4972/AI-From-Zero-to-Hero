---
title: Scoping and the Statement of Work: Acceptance Criteria Written as Evals
minutes: 60
group: Discovery and scoping
lessons: a1451, a1430
---
:::goals What you will be able to do
- Write a scope with in-scope, out-of-scope, assumptions and dependencies
- Turn acceptance criteria into measurable eval targets the customer signs
- Estimate effort with three-point estimates and an explicit risk buffer
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (customer-facing method with code). **Time**: about an hour.
:::

:::plain The idea in one line
Agree in writing what "done" means as numbers on a test set, what is not included, and how long it will take with the uncertainty shown.
:::

## The problem

"The AI should handle claims well" cannot be accepted or rejected. Without a measurable definition of done, the engagement ends in an argument, or never ends. The fix is old (a statement of work) with one change for AI systems: acceptance criteria are written as evals on an agreed test set.

## The scope document

**In scope (release 1):** triage of claims emails into a draft claim; extraction of 14 named fields from email and PDF attachments; policy lookup (read-only); drafting of missing-document requests for handler approval; a review screen in the existing claims system.
**Out of scope:** sending anything to customers without approval; photo damage assessment; payments; claims other than motor and home.
**Assumptions:** read access to the policy API by week 2; 300 historical claims labelled by handlers by week 3; one pilot team of 8 handlers.
**Dependencies:** security review slot in week 3; IT to add one field to the review screen.

## Acceptance criteria as evals

```python
CRITERIA = [  # metric, target, measured on
    ("triage_accuracy",        0.95, "300 labelled historical emails"),
    ("field_extraction_f1",    0.92, "same 300, 14 fields each"),
    ("policy_number_exact",    0.99, "same 300"),
    ("doc_request_acceptable", 0.90, "100 drafts rated by two handlers"),
    ("p95_latency_seconds",    60,   "pilot traffic (batch, so a ceiling not a target)"),
    ("cost_per_claim_usd",     0.10, "pilot traffic"),
]
results = {"triage_accuracy": 0.962, "field_extraction_f1": 0.905, "policy_number_exact": 0.997,
           "doc_request_acceptable": 0.93, "p95_latency_seconds": 41, "cost_per_claim_usd": 0.07}

lower_is_better = {"p95_latency_seconds", "cost_per_claim_usd"}
for metric, target, on in CRITERIA:
    got = results[metric]
    ok = got <= target if metric in lower_is_better else got >= target
    print(f"{'PASS' if ok else 'FAIL'}  {metric:24} target {target:<6} got {got:<6} ({on})")
```

Extraction misses its target: the acceptance meeting now discusses which fields fail, not whether the system "feels good". Lesson 31.13 builds the eval suite behind these numbers.

## Estimating with the uncertainty visible

A three-point estimate per task (optimistic, likely, pessimistic) gives an expected value and a spread. Summing variances, not worst cases, gives an honest buffer.

```python
from math import sqrt
tasks = {  # days: optimistic, likely, pessimistic
    "email triage + draft claim": (2, 3, 6), "field extraction + review UI": (4, 6, 12),
    "policy API tool": (1, 2, 6), "doc-request drafting": (2, 3, 5),
    "eval suite + labelling support": (3, 4, 7), "security review changes": (1, 3, 8), "pilot support": (5, 6, 9),
}
mean = sum((o + 4 * m + p) / 6 for o, m, p in tasks.values())
sd = sqrt(sum(((p - o) / 6) ** 2 for o, m, p in tasks.values()))
print(f"expected {mean:.1f} days; commit to {mean + 1.65 * sd:.1f} days for about 95% confidence")
```

Commit to the 95% figure, and say which tasks carry the spread (here the review UI and security changes), so the customer can help remove it.

:::check
Which statements are right?

- ✓ Acceptance criteria for an AI system should be numbers on an agreed test set.
- ✗ Out-of-scope items can be left unstated, since anything not listed is out.
  Unstated items become arguments; list the ones the customer is likely to assume.
- ✓ Summing task variances gives a smaller, more honest buffer than adding every worst case.
:::

:::recap What to keep
- Scope = in, out, assumptions, dependencies.
- Acceptance criteria are evals with targets and a named test set.
- Estimate with three points; commit to a confidence level and show where the risk is.
:::

## Exercises

1. Add a criterion for the share of claims the system declines to process (sends to a human untouched). Should it have a ceiling, a floor, or both?
2. The customer asks for 99% extraction F1. What would you need to know before agreeing?
3. Re-run the estimate with the security task's pessimistic case at 15 days. How much does the commitment move?

:::checked Sources and further reading
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: evals as the spec and a re-runnable check
- PERT three-point estimation: Malcolm et al., "Application of a technique for research and development program evaluation", *Operations Research*, 1959
:::
