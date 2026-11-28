---
title: Capstone: Brightwell's AI Estate on Snowflake, from Raw Files to a Governed Agent in CoWork
minutes: 240
group: Operating AI on Snowflake
type: Project
lessons: a3009, a3120, a3220
---
:::goals What you will be able to do
- Design and build an end-to-end AI solution on Snowflake: ingestion, enrichment, retrieval, text-to-SQL, an agent, delivery, evaluation, security and cost
- Prove each layer works with the tests from this phase, and show the whole system's readiness on one page
- Defend the design choices (what you used, what you did not, and why) to a reviewer
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Project (graded). **Time**: about four hours locally; a day or two to build it in a Snowflake account.
:::

:::plain The idea in one line
Put every layer of this phase together for one company, test each one, and hand over a system a security reviewer, a finance lead and a store manager would all accept.
:::

## The brief

Brightwell Outfitters wants one returns assistant for store managers and support staff, available in CoWork, answering policy questions with citations and returns numbers with governed SQL, limited to each user's region, within a monthly AI budget, with weekly quality reports. You have the data described across this phase: tables (orders, lines, returns, stores, products), files (policies, contracts, manuals, warranty photos), call recordings and tickets.

## The architecture

| Layer | Brightwell build | Lesson |
|---|---|---|
| Access | Named roles; PUBLIC defaults revoked; model RBAC; `CORTEX_ENABLED_CROSS_REGION = 'AWS_EU'`; per-user quotas | 33.2, 33.32 |
| Context | Classification profile, tag-based masking, owner and risk tags on every AI object | 33.4 |
| Ingest | Stage with directory table; SharePoint via Openflow; incremental `AI_PARSE_DOCUMENT` (LAYOUT, page split) | 33.3 |
| Enrich | `AI_CLASSIFY` themes on tickets (as a custom AI function, evaluated and optimised); `AI_EXTRACT` contract terms with scores; `AI_TRANSCRIBE` calls; `AI_REDACT` before sharing | 33.6 to 33.8, 33.11 |
| Retrieve | Chunks with `SPLIT_TEXT_RECURSIVE_CHARACTER`; Cortex Search service with region and doc-type attributes | 33.12, 33.13 |
| Numbers | Semantic view with return-rate metric, synonyms, verified queries; row access by region | 33.16, 33.29 |
| Agent | `CREATE AGENT` with PolicySearch, ReturnsAnalyst, OrderStatus; orchestration instructions; budget | 33.17 |
| Deliver | CoWork for staff; an agent-only MCP server for the engineering team; coding agents through Cortex AI Gateway | 33.19, 33.20, 33.23 |
| Contain | Agent-aware masking on emails; Restricted Session Scope for agent sessions; `SERVICE_AGENT` user for the nightly triage automation; guardrails in log mode, then block | 33.29, 33.30 |
| Govern | Inventory reconciled with approvals; AI Governance page; evidence queries; preview register | 33.31, 33.33 |
| Quality | TruLens evaluation run before release; weekly trace report; feedback to golden set | 33.14, 33.24 |
| Ship | SQL in Git; Snowflake CLI; side-by-side rebuilds; golden-set gates | 33.34 |

## Part 1: the readiness check

The local part of the capstone is the release gate. It collects the results each lesson's tests produce and decides whether the estate is ready.

```python
EVIDENCE = {   # filled from your test runs; these are the values from this phase's lessons
    "access":   {"public_defaults_revoked": True, "model_rbac_only": True, "cross_region_explicit": True, "quotas_set": False},
    "parsing":  {"incremental": True, "page_selection_for_contracts": True},
    "extract":  {"field_threshold_set": True, "auto_share_accuracy": 0.99},
    "classify": {"min_class_recall": 0.76, "eval_rows": 300},
    "search":   {"recall_at_3": 1.00, "golden_questions": 3},
    "rag":      {"numeric_grounding_checks": True},
    "analyst":  {"execution_accuracy": 1.0, "golden_questions": 2},
    "agent":    {"routing_exact": 6 / 6, "missed_tool_calls": 0},
    "security": {"isolation_tests_pass": True, "mcp_agent_only": True},
    "contain":  {"agent_scope_set": True, "agent_masking": True, "service_agent_for_automation": True, "guardrails_on": True},
    "govern":   {"inventory_reconciled": True, "owners_tagged": False, "previews_have_fallbacks": True},
    "cost":     {"estimated_monthly_credits": 950, "budget_credits": 1200},
    "ship":     {"objects_in_git": True, "gates_in_ci": True},
}
RULES = [
    ("access",   lambda e: all(e.values()), "every access control in place"),
    ("classify", lambda e: e["min_class_recall"] >= 0.80, "every theme recall at least 0.80"),
    ("search",   lambda e: e["recall_at_3"] >= 0.9 and e["golden_questions"] >= 30, "recall@3 >= 0.9 on 30+ golden questions"),
    ("analyst",  lambda e: e["execution_accuracy"] >= 0.9 and e["golden_questions"] >= 30, "execution accuracy >= 0.9 on 30+ questions"),
    ("agent",    lambda e: e["routing_exact"] >= 0.9 and e["missed_tool_calls"] == 0, "routing exact >= 90%, no missed tools"),
    ("security", lambda e: all(e.values()), "isolation tests and agent-only MCP"),
    ("contain",  lambda e: all(e.values()), "agent sessions scoped, masked, identified, guarded"),
    ("govern",   lambda e: all(e.values()), "inventory reconciled, owners tagged, previews covered"),
    ("cost",     lambda e: e["estimated_monthly_credits"] <= 0.85 * e["budget_credits"], "estimate within 85% of budget"),
    ("ship",     lambda e: all(e.values()), "objects in Git, gates in CI"),
]
def readiness(evidence):
    results = [(area, rule(evidence[area]), why) for area, rule, why in RULES]
    for area, ok, why in results: print(f"{'PASS' if ok else 'FAIL'}  {area:9} {why}")
    return "READY" if all(ok for _, ok, _ in results) else "NOT READY"
print(readiness(EVIDENCE))
```

The lessons' toy golden sets were deliberately small; the gate asks for 30 or more questions per golden set because a handful of questions cannot show a release is safe. The other failures are real work items: per-user quotas are not set, the fit theme's recall is too low (lesson 33.6's fix), and some AI objects have no owner tag (lesson 33.31). That is the honest state of a first build.

## Part 2: build it

1. **Access**: write `01_roles_and_grants.sql` (lesson 33.2) and prove with the role model that a store manager cannot call AI functions directly but can use the agent.
2. **Corpus**: parse the policies with page split, chunk them, and create the Search service with `product_line`, `doc_type` and `region` attributes.
3. **Semantic view**: build it with the return-rate metric and three verified queries; reach 30 golden questions with trusted SQL and measure execution accuracy.
4. **Agent**: write the specification; reach 30 routing questions; lint the spec; fix until there are no missed tools.
5. **Security and containment**: add the region row access policy and agent-aware email masking; run isolation tests for three roles; set a Restricted Session Scope for agent sessions and a `SERVICE_AGENT` user for automation; turn on guardrails in log mode.
6. **Delivery**: publish to CoWork; create an agent-only MCP server and review it with lesson 33.19's checker.
7. **Quality**: run a TruLens evaluation on the golden answers; set up the weekly trace report.
8. **Cost**: estimate monthly credits from token counts and traffic; set per-user quotas and a budget.
9. **Govern**: tag owners and risk on every agent, search service and MCP server; reconcile the inventory with approvals; list the preview features you rely on and their fallbacks.
10. **Ship**: put everything in Git with a deployment plan and CI gates; rerun `readiness` until it says READY.

## Rubric

Score each 0 (missing), 1 (present, no evidence), 2 (evidence), 3 (evidence plus explained trade-offs). Pass: 32 of 42 and no zeros.

| Criterion | What earns a 3 |
|---|---|
| Access and residency | Least-privilege roles, defaults revoked, model RBAC, explicit cross-region setting |
| Ingestion | Incremental parsing, page selection, cost per run known |
| Enrichment | Each AI function measured on labelled data, thresholds agreed |
| Retrieval | Chunking chosen by experiment; recall@k on 30+ questions |
| Text-to-SQL | Semantic view with definitions and verified queries; execution accuracy on 30+ |
| Agent | Clear tool descriptions and instructions; routing tests; budget set |
| Security | Isolation tests per role; Search designed per audience; injection handled structurally |
| Delivery | Right door per audience; MCP agent-only; OAuth |
| Evaluation | Calibrated judges; golden sets versioned; feedback loop running |
| Cost | Estimate before run; attribution by query tag; quotas and budget |
| Shipping | Objects in Git; side-by-side rebuilds; CI gates |
| Agent containment | Session scope, agent-aware policies, service identity for automation, guardrails measured in log mode |
| Governance | Owners and risk on every AI object; inventory reconciled; preview dependencies with fallbacks |
| Judgement | At least one component deliberately not used, with reasons |

:::check
Which statements are right?

- ✓ A readiness gate should fail when golden sets are too small to support the claimed accuracy.
- ✗ If every lesson's local test passed, the Snowflake build is ready for production.
  The local tests teach the checks; the evidence must come from runs on your account and data.
- ✓ Choosing not to use a component, with reasons, is part of good design.
:::

:::recap What to keep
- One architecture: access, context, ingest, enrich, retrieve, numbers, agent, deliver, contain, govern, quality, ship.
- A readiness gate built from each layer's evidence.
- Score yourself on the rubric; fix zeros first.
:::

## Exercises

1. Set `quotas_set` to True and fix the theme recall in `EVIDENCE`. What still blocks the release, and what work does it represent?
2. Add a "latency" area with a p95 target for agent turns, and the evidence it needs.
3. Write the one-page design note for Brightwell's security reviewer, covering data flow, residency, access, redaction and audit.

:::checked Sources and further reading
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Getting started with Snowflake CoWork](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/getting-started)
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [AI cost management and governance](https://docs.snowflake.com/en/user-guide/snowflake-cortex/governance-and-availability/ai-cost-management-and-governance)
:::
