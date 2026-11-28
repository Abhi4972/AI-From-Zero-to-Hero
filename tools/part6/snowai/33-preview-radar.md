---
title: The Preview Radar: Every Snowflake AI Feature in Private or Public Preview in Late 2026, and How to Build on Moving Ground
minutes: 45
group: Operating AI on Snowflake
lessons: a3301, a3334
---
:::goals What you will be able to do
- Read Snowflake's release stages (private preview, public preview, GA) and what each means for production use
- Find the current stage of any AI feature, and know the features that were still in preview in November 2026
- Keep a feature-status register so designs that depend on previews are found and re-checked
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Reference lesson with code. **Time**: about 45 minutes.
:::

:::plain The idea in one line
Snowflake's AI platform changes every week; design with preview features where they help, but never let production silently depend on one, and re-check their status on a schedule.
:::

## Release stages

| Stage | How you get it | What to expect |
|---|---|---|
| Private preview | By request through the account team; documentation often under a `LIMITEDACCESS` path | Behaviour, syntax and pricing can change; limited support; not for production |
| Public preview ("Preview") | Available to all or most accounts, labelled Preview in the docs | Covered by Snowflake's preview terms; may change before GA; AI features may be designated "Preview AI Features" in their terms |
| Generally available | Default | Supported; changes announced through release notes and behaviour change bundles |

Statuses move fast and sources disagree: a blog may say "soon", the release note gives the date. Prefer the release note (docs.snowflake.com/release-notes), and record the date you checked.

## In preview at the end of November 2026

From Snowflake's release notes and November 2026 announcements:

| Area | Private preview | Public preview |
|---|---|---|
| AI functions | Snowflake Decision (lesson 33.11) | `AI_PARSE_DOCUMENT` AGENTIC mode; multimodal `AI_SUMMARIZE`; `AI_EXTRACT` citations and accuracy update; `AI_CLASSIFY` for documents; Responses API for the Cortex REST API; newest third-party models (several Gemini, OpenAI, Grok, GLM and Kimi releases) |
| Retrieval | Cortex Search row access and masking enforcement (announced) | Data governance policy inheritance for Cortex Search; auto-suspend and resume of search services; analytical search |
| Context and semantics | Business Ontology (announced; public preview "soon"); Cortex Sense | Horizon Context; Semantic View Autopilot import from Horizon connectors; semantic view many-to-many relationships, level-of-detail expressions, `CREATE OR ALTER`; AI mode and Autopilot for sensitive data classification |
| Agents and gateway | Cortex Sandboxes; Agent Trace Intelligence; Dynamic Model Routing; Agent Abuse Detection; Snowflake Bots | Cortex AI Gateway Tools and trace analytics; guardrails through the gateway; Cortex Agents Compact API; tool evaluation metrics; Agents for Shared Data; Agentic Marketplace Discovery; AI Data Package |
| CoWork | Streamlit apps as CoWork artifacts | Profiles (limited access); dashboards; HTML reports; geospatial maps |
| CoCo | | Auto mode; Auto-efficient model tier; memory; Excel and Google Sheets; MDM policy enforcement; CoCo Admin in Snowsight; GitHub integration |
| ML and training | | Cortex Training; shadow traffic for ML gateways; Spark monitoring UI |
| Apps | | App Runtime serverless compute and Workspaces development; Streamlit automatic MCP exposure |
| Governance and security | Data exfiltration detection; just-in-time provisioning; request-access workflows | AI Governance page in Snowsight; Trust Center AI agents inventory; temporary role grants; multiple tag-based row access policies; OIDC federated authentication |

Generally available by late 2026, and so safe to design on: AI function evaluation and optimization, AI Function Studio, Cortex AI Gateway inference, observability and cost, Agent SDK, code execution and the Coding Agent, Restricted Session Scope, `SERVICE_AGENT`, data movement policies, Multi-Party Approval, Cortex AI Guardrails, budgets and per-user quotas, Declarative and Online Feature Store, Code Bundles, Semantic Studio, CoWork automations and Deep Research, CoCo automations and skill sharing.

## Locally: a feature-status register

```python
import pandas as pd
from datetime import date
today = date(2026, 11, 28)
register = pd.DataFrame([
    ("Cortex AI Gateway inference", "GA", "2026-11-20", True),
    ("Cortex AI Gateway Tools", "public preview", "2026-10-20", True),
    ("Cortex Search policy inheritance", "public preview", "2026-11-18", True),
    ("Business Ontology", "private preview", "2026-11-05", False),
    ("Cortex Training", "public preview", "2026-08-01", False),
    ("Restricted Session Scope", "GA", "2026-09-05", True)],
    columns=["feature", "stage", "last_checked", "production_depends"])
register["age_days"] = [(today - date.fromisoformat(d)).days for d in register.last_checked]
MAX_AGE = {"GA": 180, "public preview": 30, "private preview": 30}

def flag(r):
    out = []
    if r.age_days > MAX_AGE[r.stage]: out.append(f"re-check status ({r.age_days} days old)")
    if r.production_depends and r.stage != "GA": out.append("production depends on a preview: add a fallback or a compensating control")
    return "; ".join(out) or "ok"
register["action"] = register.apply(flag, axis=1)
print(register[["feature", "stage", "age_days", "action"]].to_string(index=False))
```

Two kinds of finding matter. Stale statuses mean your documents may be wrong. A production dependency on a preview needs a fallback: for example, if the returns agent relies on Cortex Search policy inheritance, keep the older control (index only a view the lowest-privileged user may see) until the feature is GA.

:::check
Which statements are right?

- ✓ A release note's stage and date should take precedence over a blog's "coming soon".
- ✗ Public preview features are suitable for production because every account has them.
  Broad availability is not the same as GA support; preview terms and possible changes still apply.
- ✓ A production design that depends on a preview feature needs a fallback or compensating control.
:::

:::recap What to keep
- Private preview by request; public preview broadly available but still preview; GA supported.
- November 2026: many agent, gateway, context and CoCo features are still preview; the core controls are GA.
- Keep a register with check dates; flag production dependencies on previews.
:::

## Exercises

1. Pick three previews from the table and find their current stage in the release notes. What changed?
2. Add a column for "fallback if withdrawn" to the register and fill it for every preview Brightwell uses.
3. Subscribe a team channel to Snowflake's release-notes feed and define who triages AI entries each week.

:::checked Sources and further reading
- [All release notes](https://docs.snowflake.com/en/release-notes/all-release-notes) and [Feature updates earlier in 2026](https://docs.snowflake.com/en/release-notes/feature-releases-2026)
- [Build trust in AI agents with governed business context and AI security](https://snowflake.com/en/blog/ai-agents-governance-ai-security-cost-control) and [Build faster, work smarter with AI agents and apps grounded in data](https://www.snowflake.com/en/blog/ai-agents-governed-data-business-context/), Snowflake blog, November 2026
- [Snowflake expands agentic AI platform](https://siliconangle.com/2026/11/03/snowflake-expands-agentic-ai-platform-with-business-context-and-governance-tools/), SiliconANGLE, November 2026
:::
