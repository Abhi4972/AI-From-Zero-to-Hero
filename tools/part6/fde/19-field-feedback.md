---
title: Feeding the Field Back to the Product: Field Notes, Patterns and What to Generalise
minutes: 50
group: Rollout, adoption and handover
lessons: a1454
---
:::goals What you will be able to do
- Write a field note that a product team can act on
- Decide whether a piece of customer work should stay one-off or become a reusable component
- Spot a pattern across several deployments from structured notes
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method with code). **Time**: about 50 minutes.
:::

:::plain The idea in one line
The FDE is the product team's eyes in the field: write down what customers needed and what you had to build, so the next deployment needs less of it.
:::

## The problem

Every deployment produces custom code. If it stays buried in one customer's repository, the next FDE builds it again. If everything is pushed into the product, the product fills with one customer's quirks. The skill is telling these apart and reporting it well.

## The field note

A useful note has: **the job the customer was trying to do**, **what got in the way** (a missing feature, an awkward API, a gap in the docs), **the workaround** and how long it took, **who else is likely to need it**, and **evidence** (a trace, a metric, a quote). One paragraph each; no opinions without a case behind them.

## One-off or reusable?

```python
def generalise_score(note):
    s = 0
    s += 2 if note["deployments_seen"] >= 3 else (1 if note["deployments_seen"] == 2 else 0)
    s += 2 if not note["customer_specific_logic"] else 0
    s += 1 if note["days_to_rebuild"] >= 3 else 0
    s += 1 if note["stable_interface"] else 0
    return s, ("propose as a product feature" if s >= 5 else "share as a template or recipe" if s >= 3 else "keep in the customer repo")

NOTES = [
    {"name": "policy-number extractor for scanned PDFs", "deployments_seen": 3, "customer_specific_logic": False, "days_to_rebuild": 4, "stable_interface": True},
    {"name": "Harbor's claim-type mapping table", "deployments_seen": 1, "customer_specific_logic": True, "days_to_rebuild": 1, "stable_interface": False},
    {"name": "audit-logging wrapper for MCP tools", "deployments_seen": 2, "customer_specific_logic": False, "days_to_rebuild": 3, "stable_interface": True},
]
for n in NOTES:
    print(f"{n['name']:44} -> score {generalise_score(n)[0]}: {generalise_score(n)[1]}")
```

The thresholds are a team agreement, not a law; the point is to decide with the same questions every time.

## Seeing patterns across deployments

```python
from collections import Counter
TAGGED = [("harbor", "doc-parsing"), ("harbor", "approvals-ui"), ("northwind", "doc-parsing"),
          ("acme-health", "redaction"), ("acme-health", "doc-parsing"), ("northwind", "approvals-ui"),
          ("kestrel-bank", "redaction"), ("kestrel-bank", "approvals-ui")]
by_tag = Counter(tag for _, tag in TAGGED)
print(by_tag.most_common())
```

Three of four deployments needed document parsing and approvals screens. That is a roadmap conversation, backed by counts rather than anecdotes. Tag notes with a small fixed vocabulary so counts like this mean something.

:::check
Which statements are right?

- ✓ A field note needs evidence such as a trace, metric or quote.
- ✗ Anything a customer asks for twice should go into the product.
  Customer-specific logic belongs in their repo even if they ask often; generalise what many customers need.
- ✓ A fixed tag vocabulary makes patterns across deployments countable.
:::

:::recap What to keep
- Job, obstacle, workaround, who else, evidence.
- Score one-off against reusable with the same questions each time.
- Tag notes so patterns across deployments can be counted.
:::

## Exercises

1. Write a field note for the policy-number extractor, using the five headings.
2. Add a fourth note of your own and score it. Do you agree with the result?
3. Propose two tags missing from the vocabulary above.

:::checked Sources and further reading
- [What are Forward Deployed Engineers, and why are they so in demand?](https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers), The Pragmatic Engineer: FDEs feeding field learning back to product teams
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde)
:::
