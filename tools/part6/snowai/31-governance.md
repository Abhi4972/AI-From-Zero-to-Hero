---
title: AI Governance on Snowflake with Public Standards: NIST AI RMF, ISO/IEC 42001, the EU AI Act, the AI Governance Page and Trust Center AI Security
minutes: 70
group: Operating AI on Snowflake
lessons: a3330, a3304
---
:::goals What you will be able to do
- Map the functions of the NIST AI Risk Management Framework and the clauses of ISO/IEC 42001 to concrete Snowflake features and evidence
- Build and reconcile an inventory of AI systems in an account from `SHOW` commands, usage views and the AI Governance page
- Plan for the EU AI Act dates as amended in 2026, and produce audit evidence with SQL
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Public standards say what an AI governance programme must do; Snowflake supplies many of the controls and most of the evidence, and the rest (ownership, risk decisions, approvals) is process your organisation has to run and record.
:::

## The problem

Brightwell's auditors ask three questions: which AI systems run on your data, who approved each one, and how do you know they behave as intended? The answers are spread across Snowsight pages, chat threads and people's memories.

## The public standards

| Standard | What it asks for | Where it applies |
|---|---|---|
| NIST AI RMF 1.0 (2023) and its Generative AI Profile, NIST AI 600-1 (2024) | Four functions: **Govern** (policies, roles, accountability), **Map** (context and risks of each system), **Measure** (test and track risks), **Manage** (prioritise, respond, monitor) | Voluntary; widely used as the reference vocabulary |
| ISO/IEC 42001:2023 | A certifiable AI management system: policy, roles, risk and impact assessment, controls (Annex A), monitoring, internal audit, improvement | Certifiable. Snowflake holds it as a provider of AI; it does not certify your own use of AI |
| EU AI Act, amended by the Digital Omnibus (in force 27 Jul 2026) | Risk-based duties. Transparency duties (for example telling people they are talking to AI) from 2 Aug 2026, with marking of synthetic content for systems already on the market by 2 Dec 2026. Stand-alone high-risk (Annex III) duties from 2 Dec 2027; product-embedded high-risk (Annex I) from 2 Aug 2028 | Organisations placing or using AI in the EU; confirm scope with counsel |
| OWASP Top 10 for LLM Applications (2025) | Prompt injection, sensitive information disclosure, excessive agency, system prompt leakage and others | Engineering checklist for each AI application |

## Mapping the functions to Snowflake

| Function | Snowflake features that help | Evidence you can query |
|---|---|---|
| Govern | Model RBAC, AI privileges (lesson 33.2); Multi-Party Approval (lesson 33.30); object tags for owner and risk | Grants (`SHOW GRANTS ... INCLUDE HIERARCHY`, GA Nov 2026), tag references, `MULTI_PARTY_APPROVAL_REQUESTS` |
| Map | Inventory with `SHOW AGENTS`, `SHOW CORTEX SEARCH SERVICES`, `SHOW SEMANTIC VIEWS`, `SHOW MCP SERVERS`, registry models, AI functions; classification and lineage (lesson 33.4); Trust Center AI agents inventory (preview) | Object lists with tags; lineage graphs |
| Measure | Agent and AI function evaluations (lessons 33.11, 33.24); AI Observability; guardrail detections | Evaluation runs, `CORTEX_AI_GUARDRAILS_USAGE_HISTORY` |
| Manage | Session scopes, agent-aware policies, data movement policies (lesson 33.30); guardrails (lesson 33.29); budgets and quotas (lesson 33.32); Trust Center findings and notifications | `ACCESS_HISTORY.agents_info`, `QUERY_HISTORY.agent_type`, usage views, Trust Center findings |

**The AI Governance page** (Snowsight, Governance & security » AI governance; preview 19 Nov 2026) brings part of this together for CoCo and Cortex Agents: usage over 7, 30 or 90 days, agents missing governance tags, agents reading sensitive data, an Activity view of each agent's data exposure, and a Changelog of agent creates and changes from access history. It needs `SNOWFLAKE.USAGE_VIEWER` and `SNOWFLAKE.GOVERNANCE_VIEWER`, refreshes at least daily, and does not cover custom applications built on AI functions. **Trust Center AI Security** (scanner package and tab GA 3 Aug 2026) adds AI-specific posture findings, programmatic notifications (GA 11 Nov 2026) and remediation.

What no product does for you: decide who owns each system, assess its risk and impact, approve it, and record that decision. ISO/IEC 42001 requires these to be documented; holding them as tables lets one query join each decision to its evidence.

## Locally: reconcile the inventory with approvals

```python
import pandas as pd
live = pd.DataFrame([   # from SHOW AGENTS / SHOW CORTEX SEARCH SERVICES / SHOW MCP SERVERS, with tags joined
    ("AGENT", "support.agents.returns_assistant", "support_platform", "limited", True),
    ("AGENT", "finance.agents.margin_bot", None, None, True),
    ("SEARCH", "docs.rag.policy_search", "support_platform", "minimal", False),
    ("MCP_SERVER", "support.mcp.returns_server", "support_platform", "limited", False),
    ("AGENT", "sandbox.tmp.test_agent_7", "asha", None, False)],
    columns=["type", "name", "owner_tag", "risk_tag", "reads_sensitive"])
register = pd.DataFrame([   # the organisation's approval records
    ("support.agents.returns_assistant", "2026-09-02", "2026-11-20"),
    ("docs.rag.policy_search", "2026-08-15", None),
    ("support.mcp.returns_server", "2026-09-02", "2026-11-20"),
    ("hr.agents.leave_helper", "2026-06-01", "2026-06-01")],
    columns=["name", "approved_on", "last_evaluated"])

m = live.merge(register, on="name", how="outer", indicator=True)
def findings(r):
    out = []
    if r._merge == "left_only": out.append("running without approval")
    if r._merge == "right_only": out.append("approved but not found: retired? update the register")
    if r._merge != "right_only":
        if pd.isna(r.owner_tag): out.append("no owner tag")
        if pd.isna(r.risk_tag): out.append("no risk classification")
        if r.reads_sensitive and pd.isna(r.last_evaluated): out.append("reads sensitive data, never evaluated")
    if r._merge == "both" and pd.isna(r.last_evaluated) and r.type == "AGENT": out.append("no evaluation on record")
    return "; ".join(out) or "ok"
m["finding"] = m.apply(findings, axis=1)
print(m[["name", "finding"]].to_string(index=False))
```

Run it on a schedule: live objects without approvals, approvals without live objects, and missing owners, risk classifications or evaluations are the gaps auditors find first. In Snowflake the left side comes from `SHOW` commands and tag references; the right side is your register table.

:::check
Which statements are right?

- ✓ Snowflake's ISO/IEC 42001 certificate covers Snowflake as an AI provider, not a customer's own AI management system.
- ✗ After the 2026 Digital Omnibus, stand-alone high-risk AI duties under the EU AI Act start on 2 August 2026.
  They were deferred to 2 December 2027 (Annex III) and 2 August 2028 (Annex I).
- ✓ The AI Governance page shows agents missing governance tags only if tagging and classification are already in place.
:::

:::recap What to keep
- NIST AI RMF (Govern, Map, Measure, Manage), ISO/IEC 42001, EU AI Act dates as amended, OWASP LLM Top 10.
- Snowflake supplies controls and evidence; ownership, risk decisions and approvals are your records.
- Reconcile live AI objects with your approval records regularly; use the AI Governance page and Trust Center AI Security.
:::

## Exercises

1. Write the SQL that lists every agent with its owner and risk tags from tag references.
2. Choose three NIST AI 600-1 risks that apply to Brightwell's returns agent and name the Snowflake control for each.
3. Draft the evidence pack index for an ISO/IEC 42001 internal audit of one AI system, with the query behind each item.

:::checked Sources and further reading
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) and [NIST AI 600-1, Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html); [Snowflake achieves ISO/IEC 42001 certification](https://snowflake.com/en/blog/ISO-IEC-42001-AI-certification), Snowflake blog
- [The Digital Omnibus on AI enters into force](https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo), Lewis Silkin, July 2026
- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- [AI Governance in Snowsight](https://docs.snowflake.com/en/user-guide/ai-governance) and [Trust Center](https://docs.snowflake.com/user-guide/trust-center/overview)
:::
