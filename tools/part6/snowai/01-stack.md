---
title: The Snowflake AI Stack: Cortex AI Functions, Search, Analyst, Agents, CoWork and Snowflake ML, and How to Choose
minutes: 50
group: Foundations: the stack, access and data
lessons: a3016, a3009, a3214
---
:::goals What you will be able to do
- Name every layer of AI on Snowflake and what each is for, using the November 2026 product names
- Choose the right component for a use case from three questions: what data, who asks, and what comes back
- Explain why "keep the AI next to the data" changes the architecture compared with calling a model from outside
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 50 minutes.
- **About this phase**: every Snowflake statement here was checked against Snowflake's documentation in November 2026. The SQL and Snowpark code needs a Snowflake account and is shown, not run. Each lesson also has a local Python part that runs anywhere and teaches the same mechanism: chunking, hybrid search, text-to-SQL evaluation, agent routing, cost and access control.
:::

:::plain The idea in one line
Snowflake now has a managed AI component for almost every step from raw files to an answer in front of a business user; the skill is picking the smallest set that does the job, inside the same governance as the data.
:::

## The problem

**Brightwell Outfitters**, a fictional outdoor-gear retailer, runs on Snowflake: orders, customers, inventory and returns in tables; return-policy PDFs, supplier contracts and product images on stages; support-call recordings in cloud storage; product reviews and support tickets as text. Leadership asks for "AI on our data". Every Snowflake AI feature could play a part, and choosing badly means paying for three services where one SQL function would do. This phase builds Brightwell's whole AI estate, one layer at a time, and ends with a capstone that joins them.

## The layers

| Layer | Components (November 2026 names) | Use it for | Lessons |
|---|---|---|---|
| Access and spend | `USE AI FUNCTIONS`, `CORTEX_USER` / `AI_FUNCTIONS_USER` / `CORTEX_AGENT_USER` / `CORTEX_REST_API_USER`, model RBAC, cross-region setting, budgets and quotas | Who may call which model, where inference runs, what it may cost | 33.2, 33.32 |
| Data and context | Stages, Openflow, Datastream, dynamic tables, `AI_PARSE_DOCUMENT`; Horizon Catalog: classification, tags, lineage, access history, Horizon Context, Business Ontology, Cortex Sense | Getting data in, knowing what it is, giving AI governed business meaning | 33.3, 33.4 |
| AI in SQL | Cortex AI Functions: `AI_COMPLETE`, `AI_CLASSIFY`, `AI_FILTER`, `AI_AGG`, `AI_SUMMARIZE`, `AI_SENTIMENT`, `AI_EXTRACT`, `AI_TRANSCRIBE`, `AI_EMBED`, `AI_REDACT` and more; custom AI functions, AI Function Studio, Snowflake Decision | Enriching rows in bulk inside queries and pipelines, with measured quality | 33.5 to 33.8, 33.11 |
| Model APIs | Cortex REST API (Chat Completions, Messages, Responses) | Calling hosted models from applications | 33.9 |
| ML in SQL | ML Functions: `FORECAST`, `ANOMALY_DETECTION`, `CLASSIFICATION`, `TOP_INSIGHTS` | Forecasts and anomalies without writing Python | 33.10 |
| Retrieval | Embeddings and `VECTOR`, Cortex Search services, Cortex Knowledge Extensions, AI-ready listings | Hybrid search over text, RAG, licensed knowledge | 33.12 to 33.15 |
| Structured questions | Semantic views, Semantic Studio and Autopilot, Cortex Analyst | Natural-language questions answered with governed SQL | 33.16 |
| Agents | Cortex Agents: tools, threads, feedback, Agent SDK, async API, code execution, Coding Agent, MCP | Assistants that plan and act with governed tools | 33.17, 33.18 |
| Agent products | Managed MCP servers, Streamlit and App Runtime; Snowflake CoWork (formerly Snowflake Intelligence); Snowflake CoCo (formerly Cortex Code); agents in Native Apps; Cortex AI Gateway | Putting AI in front of business users, developers, customers and external AI clients, under one governed endpoint | 33.19 to 33.23 |
| Quality | AI Observability: TruLens evaluations, agent evaluations, traces, feedback | Measuring and monitoring answers | 33.24 |
| Classic and custom ML | Notebooks on Container Runtime, ML Jobs, Experiments, Datasets, Feature Store, Model Registry, ML Lineage, model monitors, ML gateway, Cortex Fine-tuning, Cortex Training | Training, tracking, serving and customising your own models | 33.25 to 33.28 |
| Trust | RBAC, masking and row policies, Cortex AI Guardrails, agent identity, Restricted Session Scope, data movement policies, Multi-Party Approval, Trust Center, AI Governance page | Keeping AI safe, compliant and auditable | 33.29 to 33.31 |
| Operations | Cost views, quotas, the preview radar, Snowflake CLI, Git, CI/CD | Running it all economically and repeatably on a platform that changes weekly | 33.32 to 33.34 |

Snowflake renamed two products at Summit 2026: **Snowflake Intelligence is now Snowflake CoWork**, and **Cortex Code is now Snowflake CoCo**. Documentation URLs and some object names still carry the old names; this phase uses the new ones. Many 2026 features are in preview; each lesson states the status where it matters, and lesson 33.33 lists every AI feature still in private or public preview in November 2026 and how to build on them safely.

## Choosing a component

```python
def recommend(data, asker, output, volume_rows=0):
    """data: 'rows' | 'documents' | 'tables' | 'mixed'; asker: 'pipeline' | 'analyst' | 'business user' | 'external client';
    output: 'enriched column' | 'answer' | 'number' | 'prediction'"""
    picks = []
    if data == "documents" and output == "enriched column": picks += ["AI_PARSE_DOCUMENT or AI_EXTRACT in a pipeline"]
    if data == "rows" and output == "enriched column":     picks += ["AI_CLASSIFY / AI_SENTIMENT / AI_EXTRACT / AI_COMPLETE in SQL"]
    if data in ("documents", "rows") and output == "answer": picks += ["Cortex Search service", "AI_COMPLETE over retrieved text (RAG)"]
    if data == "tables" and output in ("answer", "number"): picks += ["semantic view, queried through a Cortex Agent's Analyst tool"]
    if data == "mixed" and output == "answer":             picks += ["Cortex Search", "semantic view", "Cortex Agent combining both"]
    if output == "prediction" and data == "tables" and asker == "analyst": picks += ["ML Functions in SQL: FORECAST, ANOMALY_DETECTION (lesson 10)"]
    elif output == "prediction":                           picks += ["Snowflake ML: train, register, serve (lessons 25 to 28)"]
    if asker == "business user" and output == "answer":    picks += ["publish the agent in Snowflake CoWork"]
    if asker == "external client":                         picks += ["Snowflake-managed MCP server (governed answers) or Cortex AI Gateway (model calls)"]
    if volume_rows > 1_000_000 and "SQL" in " ".join(picks): picks += ["estimate tokens with AI_COUNT_TOKENS first (lesson 32)"]
    return picks

CASES = [
    ("tag 4 million product reviews by theme", dict(data="rows", asker="pipeline", output="enriched column", volume_rows=4_000_000)),
    ("pull refund terms out of 900 supplier contracts", dict(data="documents", asker="pipeline", output="enriched column")),
    ("store managers ask 'what were returns by region last month?'", dict(data="tables", asker="business user", output="number")),
    ("support agents ask 'can this customer return a used tent?'", dict(data="mixed", asker="business user", output="answer")),
    ("forecast weekly demand per SKU", dict(data="tables", asker="pipeline", output="prediction")),
    ("a finance analyst wants next quarter's returns forecast", dict(data="tables", asker="analyst", output="prediction")),
    ("a coding assistant outside Snowflake needs governed sales numbers", dict(data="tables", asker="external client", output="number")),
]
for need, spec in CASES:
    print(f"- {need}\n    -> " + "; ".join(recommend(**spec)))
```

The function is deliberately simple, but the questions are the ones that matter in a real design review: what kind of data, who is asking, and what must come back. Notice how often the answer is a **SQL function in a pipeline** rather than an agent: bulk enrichment is cheaper, testable and explainable, and agents are worth their cost only when the question is open-ended.

## Why "next to the data" matters

Calling an external model from a Python job means exporting data, managing a second set of credentials and copying permissions by hand. In Snowflake, the AI call runs inside the query: role-based access, masking policies and row access policies apply before the model sees a row, usage is attributed to the user and query, and the output lands in a governed table. The trade-offs are real too: you choose from the models Snowflake hosts, inference may need to run in another region (lesson 33.2), and costs are in credits that need their own monitoring (lesson 33.32).

:::check
Which statements are right?

- ✓ Tagging millions of reviews is usually better done with an AI function in a pipeline than with an agent.
- ✗ Snowflake CoWork and Snowflake Intelligence are two different products.
  CoWork is the 2026 name for Snowflake Intelligence.
- ✓ Running AI inside Snowflake means row access and masking policies apply before the model sees the data.
:::

:::recap What to keep
- Access, context, AI functions, Search, Analyst, Agents, agent products, quality, ML, trust, operations: a layer for each step.
- Choose by data type, asker and output; prefer the smallest component that works.
- Next to the data means shared governance and attribution, with model choice and region as trade-offs.
:::

## Exercises

1. Add two use cases from your own work to `CASES`. Do you agree with the recommendation?
2. Extend `recommend` with a rule for real-time scoring inside an application (hint: lesson 33.27).
3. List which Brightwell data would be in scope for each layer, and which data must never reach a model.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Zero to Snowflake](https://www.snowflake.com/en/developers/guides/zero-to-snowflake/) (Snowflake guide)
- [Build an end-to-end AI app on Snowflake](https://www.snowflake.com/en/developers/guides/sfguide-build-end-to-end-ai-app-on-snowflake/) (Snowflake guide)
- [Cortex AI Cookbook: 28 deployment recipes with SQL scripts and teardown](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/overview) (Snowflake docs)

:::checked Sources and further reading
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Getting started with Snowflake CoWork](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/getting-started)
- [Snowflake renames AI tools amid broader platform push](https://itbrief.com.au/story/snowflake-renames-ai-tools-amid-broader-platform-push), IT Brief, June 2026
:::
