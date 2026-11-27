---
title: Capstone: a Four-Day Deployment Intensive and Graded Practical (Northwind Freight)
minutes: 240
group: Rollout, adoption and handover
type: Project
lessons: a1447, a1110, a1725, a1720
---
:::goals What you will be able to do
- Run a whole deployment, from first request to handover, on a case you have not seen
- Produce the deployment dossier a customer would sign, with every claim backed by evidence
- Grade your own work against the same rubric a reviewer would use
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Project (graded practical). **Time**: four focused sessions of about an hour each, or four half-days if you build the stretch goals.
:::

:::plain The idea in one line
Do the job end to end on a fresh customer: discover, scope, build, prove, secure, roll out and hand over, then grade yourself against a fixed rubric.
:::

## The brief

**Northwind Freight** is a mid-sized logistics company. Its customer-service team of 22 people handles about 1,100 shipment-exception emails a day: delayed loads, damaged goods, wrong addresses, missing proof of delivery. Each email needs a case opened in the transport system with the shipment ID, exception type and urgency, and often a reply asking the customer for photos or a corrected address. The operations director (your sponsor) says: "We want AI to deal with these emails. Our best agents take 6 minutes each; new starters take 15. We lose key accounts when urgent cases sit for half a day."

You have the sponsor for 30 minutes on day 1, and the team lead and two agents for an hour. Everything else is in the case pack below. Use the Harbor Mutual lessons as your method, not as your answer: the workflow, risks and numbers here differ.

## The case pack

```python
import random, json
random.seed(2026)
TYPES = {"delay": 0.42, "damage": 0.18, "address": 0.16, "pod_missing": 0.14, "other": 0.10}
URGENT_TYPES = {"damage", "address"}
ACCOUNTS = ["key", "standard", "standard", "standard", "small"]

def make_case(i):
    t = random.choices(list(TYPES), weights=TYPES.values())[0]
    acct = random.choice(ACCOUNTS)
    sid = f"NW-{random.randint(100000, 999999)}" if random.random() > 0.08 else None     # 8% of emails lack a shipment ID
    urgent = (t in URGENT_TYPES) or (acct == "key" and t == "delay")
    return {"id": f"e{i:03d}", "type": t, "account": acct, "shipment_id": sid, "urgent": urgent,
            "handle_minutes": round(max(2, random.gauss(9 if t != "other" else 14, 4)), 1)}

CASES = [make_case(i) for i in range(400)]
print("exception mix:", {t: sum(c["type"] == t for c in CASES) for t in TYPES})
print("urgent share:", round(sum(c["urgent"] for c in CASES) / len(CASES), 2),
      " missing shipment ID:", sum(c["shipment_id"] is None for c in CASES))
print("mean handling minutes:", round(sum(c["handle_minutes"] for c in CASES) / len(CASES), 1))
```

The pack also states these constraints (treat them as interview findings):

- The transport system has a REST API with read access to shipments and a "create case" endpoint; there is no endpoint to change addresses or issue credits, and the IT lead wants it kept that way.
- Customer emails often include names, phone numbers and delivery addresses. The data protection officer must approve any new processor; the company already uses Claude through its cloud provider's approved region.
- Two agents keep a private spreadsheet of key-account contacts who "must be called, not emailed". Nobody else knows it exists.
- Urgent cases are supposed to be picked up within 2 hours; the team lead thinks the real median is about 5 hours on busy days.

## Day 1: discover and qualify

Produce: a stakeholder map, the ranked pains, a one-paragraph problem statement with a measurable outcome, a fit score and an ROI range (lessons 31.4 and 31.5). Map today's workflow and mark the agent line (31.6). The private spreadsheet is a finding: decide what it means for the design.

## Day 2: scope and prototype

Produce: the scope document with acceptance criteria as numbers on a test set (31.7); a golden set of at least 40 labelled cases drawn from the pack, with slices for exception type, key accounts and missing IDs (31.13); a working offline prototype of triage and extraction with validation and traces (31.8), using recorded outputs if you have no API key.

## Day 3: tools, trust and cost

Produce: the tool manifest (read shipment, create case, propose reply) passing the agent-line check (31.9, 31.14); the trust-boundary document with redaction; the eval report with per-slice scores, intervals and a release gate decision; the per-email cost model with a monthly range (31.15).

## Day 4: rollout and handover

Produce: the trust-ladder plan with unlock metrics and a baseline plan (31.16); the adoption plan with champions and the telemetry you will watch (31.17); the readiness check, runbook and handover pack (31.18); one field note for the product team (31.19); and a 5-minute readout for the sponsor that starts with the decision you are asking for.

## The dossier and its check

```python
DOSSIER_SECTIONS = {
    "problem_statement": "one paragraph, measurable outcome, baseline stated",
    "stakeholders": "map with sponsor, owner, users, IT, security, data protection",
    "workflow_and_agent_line": "today's steps, what the system may and may not do",
    "scope_and_criteria": "in, out, acceptance criteria as numbers on a named test set",
    "golden_set": "40+ cases, slices, version",
    "prototype_trace": "a traced run with validation results",
    "tool_manifest": "tools with writes and idempotency, passing the agent-line check",
    "trust_boundary": "identity, reads, writes, data flow, personal data, injection, monitoring, off switch",
    "eval_report": "per-slice scores, intervals, gate decision",
    "cost_model": "per email and monthly range, levers used",
    "rollout_plan": "trust ladder with unlock metrics, baseline",
    "adoption_plan": "champions, training, telemetry",
    "handover": "readiness check, runbook, owners, end date",
    "field_note": "job, obstacle, workaround, who else, evidence",
    "readout": "decision first, results with intervals, risks",
}

def check_dossier(d):
    missing = [k for k in DOSSIER_SECTIONS if not d.get(k)]
    thin = [k for k, v in d.items() if k in DOSSIER_SECTIONS and v and len(str(v)) < 40]
    return {"complete": not missing, "missing": missing, "too_thin_to_review": thin}

draft = {"problem_statement": "Urgent exception emails wait a median of about 5 hours; target under 2 hours for 90% within 8 weeks, measured from the case log.",
         "stakeholders": "Ops director (sponsor), CS team lead (owner), 22 agents, IT lead, security, DPO.",
         "tool_manifest": "get_shipment, create_case, propose_reply", "readout": ""}
print(check_dossier(draft))
```

## The rubric

Score each criterion 0 to 3: 0 missing, 1 present but unsupported, 2 supported by evidence, 3 supported and the trade-offs are explicit. Pass with 30 or more out of 42 and no criterion at 0.

```python
RUBRIC = [
    ("Outcome", "the problem statement names a business metric with a baseline and a target"),
    ("Discovery", "findings come from the people who do the work; the hidden spreadsheet is handled"),
    ("Agent line", "the system cannot change addresses, issue credits or send without approval"),
    ("Scope", "acceptance criteria are numbers on a named, versioned test set"),
    ("Evals", "per-slice scores with intervals; a gate decision is stated"),
    ("Slices", "key accounts and missing shipment IDs are reported separately"),
    ("Security", "trust boundary, redaction and injection handling point to enforcement"),
    ("Cost", "per-email cost from token counts; monthly range; levers named with their costs"),
    ("Rollout", "each rung has an unlock metric; the baseline is like-for-like"),
    ("Adoption", "champions, training on real cases, depth-of-use telemetry"),
    ("Handover", "named owners, runbook, tested off switch, end date"),
    ("Product feedback", "a field note with evidence and a generalise decision"),
    ("Readout", "starts with the decision; numbers carry uncertainty"),
    ("Judgement", "at least one thing the customer asked for was pushed back on, with reasons"),
]

def grade(scores):
    total = sum(scores.get(name, 0) for name, _ in RUBRIC)
    zeros = [name for name, _ in RUBRIC if scores.get(name, 0) == 0]
    verdict = "PASS" if total >= 30 and not zeros else "NOT YET"
    return total, len(RUBRIC) * 3, verdict, zeros

example = {name: 2 for name, _ in RUBRIC} | {"Agent line": 3, "Evals": 3, "Slices": 3, "Security": 3, "Cost": 3, "Product feedback": 0}
print(grade(example))
```

The example scores above 30 and still misses the pass, only because the field note is absent, which is the point of the no-zero rule: a deployment that never reports back to the product has not finished the job.

## Stretch goals

- Run the prototype against the live API with your own key on 20 cases, and compare cost and latency with your model.
- Have someone else play the sponsor and push back on your readout; write down the three questions you could not answer.
- Add a fourth rung to the rollout plan (replies sent without approval for "pod_missing" emails only) and write the evidence you would need before the sponsor signs it.

:::check
Which statements are right?

- ✓ The private key-account spreadsheet is a discovery finding that changes the design.
- ✗ A high total score passes even if one criterion is missing.
  Any criterion at 0 means not yet, whatever the total.
- ✓ The dossier should let a reviewer check every claim against evidence.
:::

:::recap What to keep
- Four days: discover and qualify; scope and prototype; tools, trust and cost; rollout and handover.
- The dossier is the deliverable; every section points to evidence.
- Grade with the rubric honestly, and fix what scores 0 or 1 first.
:::

## Exercises

1. Complete the dossier for Northwind Freight and run `check_dossier` until it reports complete.
2. Score your dossier with the rubric, then ask a colleague to score it blind. Where do you disagree, and why?
3. Write the one-paragraph note you would send the sponsor on day 1 evening, confirming what you heard and what happens next.

:::checked Sources and further reading
- [Anthropic launches Claude Frontier Academy](https://www.anthropic.com/news/claude-frontier-academy): the four-day intensive and graded practical that this capstone is modelled on
- [Frontier Academy](https://claude.com/programs/frontier-academy), Claude
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde)
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: capstone deployment on an unseen case
:::
