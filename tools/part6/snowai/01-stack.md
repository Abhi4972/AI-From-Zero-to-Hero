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

| Layer | Components (November 2026 names) | Use it for | Lesson |
|---|---|---|---|
| Access and spend | `USE AI FUNCTIONS`, `CORTEX_USER` / `AI_FUNCTIONS_USER`, model RBAC, cross-region setting, budgets and quotas | Who may call which model, where inference runs, how much it may cost | 33.2, 33.18 |
| Ingest and parse | Stages, directory tables, Openflow connectors, `AI_PARSE_DOCUMENT` | Getting files in and turning them into text | 33.3 |
| AI in SQL | Cortex AI Functions: `AI_COMPLETE`, `AI_CLASSIFY`, `AI_FILTER`, `AI_AGG`, `AI_EXTRACT`, `AI_TRANSCRIBE`, `AI_EMBED` and more | Enriching rows in bulk inside queries and pipelines | 33.4 to 33.8 |
| Retrieval | Cortex Search services | Hybrid keyword and vector search over text, with filters | 33.9, 33.10 |
| Structured questions | Semantic views and Cortex Analyst | Natural-language questions answered with governed SQL | 33.11 |
| Orchestration | Cortex Agents (`CREATE AGENT`) | One assistant that plans and uses Search, Analyst and custom tools | 33.12 |
| Delivery to people and tools | Snowflake CoWork (formerly Snowflake Intelligence), the Snowflake-managed MCP server, Cortex AI Gateway, Streamlit | Putting agents in front of users, external AI clients and apps | 33.13, 33.19 |
| Quality | AI Observability (TruLens-based evaluations, agent traces, feedback) | Measuring and monitoring answers | 33.14 |
| Classic and custom ML | Snowflake ML: notebooks, ML Jobs, Feature Store, Model Registry, ML Observability, model serving in Snowpark Container Services | Training and serving your own models | 33.15, 33.16 |

Snowflake renamed two products at Summit 2026: **Snowflake Intelligence is now Snowflake CoWork**, and **Cortex Code is now CoCo** (the coding agent for developers). Documentation URLs still carry the old names in places; this phase uses the new ones.

## Choosing a component

```python
def recommend(data, asker, output, volume_rows=0):
    """data: 'rows' | 'documents' | 'tables' | 'mixed'; asker: 'pipeline' | 'analyst' | 'business user' | 'external client';
    output: 'enriched column' | 'answer' | 'number' | 'prediction'"""
    picks = []
    if data == "documents" and output == "enriched column": picks += ["AI_PARSE_DOCUMENT or AI_EXTRACT in a pipeline"]
    if data == "rows" and output == "enriched column":     picks += ["AI_CLASSIFY / AI_SENTIMENT / AI_EXTRACT / AI_COMPLETE in SQL"]
    if data in ("documents", "rows") and output == "answer": picks += ["Cortex Search service", "AI_COMPLETE over retrieved text (RAG)"]
    if data == "tables" and output in ("answer", "number"): picks += ["semantic view + Cortex Analyst"]
    if data == "mixed" and output == "answer":             picks += ["Cortex Search", "semantic view", "Cortex Agent combining both"]
    if output == "prediction":                             picks += ["Snowflake ML: train, register, serve (lessons 15-16)"]
    if asker == "business user" and output == "answer":    picks += ["publish the agent in Snowflake CoWork"]
    if asker == "external client":                         picks += ["Snowflake-managed MCP server or Cortex AI Gateway"]
    if volume_rows > 1_000_000 and "SQL" in " ".join(picks): picks += ["estimate tokens with AI_COUNT_TOKENS first (lesson 18)"]
    return picks

CASES = [
    ("tag 4 million product reviews by theme", dict(data="rows", asker="pipeline", output="enriched column", volume_rows=4_000_000)),
    ("pull refund terms out of 900 supplier contracts", dict(data="documents", asker="pipeline", output="enriched column")),
    ("store managers ask 'what were returns by region last month?'", dict(data="tables", asker="business user", output="number")),
    ("support agents ask 'can this customer return a used tent?'", dict(data="mixed", asker="business user", output="answer")),
    ("forecast weekly demand per SKU", dict(data="tables", asker="pipeline", output="prediction")),
    ("a coding assistant outside Snowflake needs governed sales numbers", dict(data="tables", asker="external client", output="number")),
]
for need, spec in CASES:
    print(f"- {need}\n    -> " + "; ".join(recommend(**spec)))
```

The function is deliberately simple, but the questions are the ones that matter in a real design review: what kind of data, who is asking, and what must come back. Notice how often the answer is a **SQL function in a pipeline** rather than an agent: bulk enrichment is cheaper, testable and explainable, and agents are worth their cost only when the question is open-ended.

## Why "next to the data" matters

Calling an external model from a Python job means exporting data, managing a second set of credentials and copying permissions by hand. In Snowflake, the AI call runs inside the query: role-based access, masking policies and row access policies apply before the model sees a row, usage is attributed to the user and query, and the output lands in a governed table. The trade-offs are real too: you choose from the models Snowflake hosts, inference may need to run in another region (lesson 33.2), and costs are in credits that need their own monitoring (lesson 33.18).

:::check
Which statements are right?

- ✓ Tagging millions of reviews is usually better done with an AI function in a pipeline than with an agent.
- ✗ Snowflake CoWork and Snowflake Intelligence are two different products.
  CoWork is the 2026 name for Snowflake Intelligence.
- ✓ Running AI inside Snowflake means row access and masking policies apply before the model sees the data.
:::

:::recap What to keep
- Access, ingest, AI functions, Search, Analyst, Agents, delivery, quality, ML: a layer for each step.
- Choose by data type, asker and output; prefer the smallest component that works.
- Next to the data means shared governance and attribution, with model choice and region as trade-offs.
:::

## Exercises

1. Add two use cases from your own work to `CASES`. Do you agree with the recommendation?
2. Extend `recommend` with a rule for real-time scoring inside an application (hint: lesson 33.16).
3. List which Brightwell data would be in scope for each layer, and which data must never reach a model.

:::checked Sources and further reading
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Getting started with Snowflake CoWork](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/getting-started)
- [Snowflake renames AI tools amid broader platform push](https://itbrief.com.au/story/snowflake-renames-ai-tools-amid-broader-platform-push), IT Brief, June 2026
:::
