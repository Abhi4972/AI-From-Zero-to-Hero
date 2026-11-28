---
title: Cost and Performance Engineering for Snowflake AI: Tokens, Pages, Warehouses, Budgets and Quotas
minutes: 60
group: Operating AI on Snowflake
lessons: a1727, a3115
---
:::goals What you will be able to do
- Explain how each AI feature is billed: tokens, pages, audio seconds, warehouses, services and refreshes
- Estimate a job's cost before running it with `AI_COUNT_TOKENS` and a cost model, and track it afterwards from usage views
- Cut cost with the levers that matter: smaller models for easy steps, fewer tokens per row, page selection, warehouse size, and incremental processing
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Most Snowflake AI cost is tokens multiplied by rows; estimate both before you run, attribute every credit afterwards, and cap spend with quotas.
:::

## The problem

Brightwell's review-tagging job (lesson 33.6) ran on 4 million rows with a large model and long category descriptions, on an X-Large warehouse "to make it faster". It was not faster, and it cost several times the estimate nobody made.

## How it is billed

| Feature | Billed on |
|---|---|
| Text functions (`AI_COMPLETE`, `AI_CLASSIFY`, `AI_FILTER`, `AI_TRANSLATE`, ...) | Input and output tokens at the model's credit rate; built-in prompts add tokens; `AI_CLASSIFY` labels, descriptions and examples count on every row |
| `AI_EMBED`, `AI_SIMILARITY` | Input tokens only |
| `AI_EXTRACT` | Input and output tokens; each page counts as 970 tokens; the response format counts as input |
| `AI_PARSE_DOCUMENT` | Per page processed |
| Audio (`AI_TRANSCRIBE`) | 50 tokens per second |
| Cortex Guard | Input tokens, on top of `AI_COMPLETE` |
| `AI_COUNT_TOKENS` | Warehouse time only, no token charge |
| Warehouse | Normal compute while the query runs; Snowflake advises MEDIUM or smaller, because larger warehouses do not speed up AI functions |
| Search, Agents, CoWork, services | Their own consumption (serving, refresh, compute pools) |

Credit rates per model and function are in Snowflake's Service Consumption Table; they change, so keep them as parameters.

```sql
-- estimate before running: tokens per row for the real prompt, on a sample
SELECT AVG(AI_COUNT_TOKENS('ai_classify', review_text)) AS avg_tokens
FROM reviews.raw.product_reviews SAMPLE (1000 ROWS);

-- attribute afterwards (hourly windows; CREDITS excludes warehouse credits)
SELECT function_name, model_name, ROLE_NAMES[0]::STRING AS role, SUM(credits) AS ai_credits
FROM SNOWFLAKE.ACCOUNT_USAGE.CORTEX_AI_FUNCTIONS_USAGE_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())
GROUP BY 1, 2, 3 ORDER BY ai_credits DESC;
```

`CORTEX_AI_FUNCTIONS_USAGE_HISTORY` is the current view (data from January 2026, with query, warehouse, role and user columns). The older `CORTEX_FUNCTIONS_USAGE_HISTORY` and `CORTEX_FUNCTIONS_QUERY_USAGE_HISTORY` were slated for deprecation on 22 November 2026, and `CORTEX_AISQL_USAGE_HISTORY` on 15 January 2027: move dashboards now. Join on `query_id` and `warehouse_id` to add warehouse cost for a full picture.

## Locally: a cost model with the levers

```python
RATES = {   # credits per million tokens: PLACEHOLDERS for the exercise; copy real values from the Service Consumption Table
    "small-model": {"in": 0.10, "out": 0.10},
    "large-model": {"in": 1.50, "out": 1.50},
    "classify":    {"in": 0.40, "out": 0.40},
}
def job_cost(rows, in_tokens, out_tokens, rate, overhead_tokens=0, credit_price=3.0):
    r = RATES[rate]
    credits = rows * ((in_tokens + overhead_tokens) * r["in"] + out_tokens * r["out"]) / 1e6
    return round(credits, 1), round(credits * credit_price)

SCENARIOS = [
    ("first run: large model, long descriptions, all rows", dict(rows=4_000_000, in_tokens=180, out_tokens=40, rate="large-model", overhead_tokens=260)),
    ("AI_CLASSIFY with short descriptions",                 dict(rows=4_000_000, in_tokens=180, out_tokens=10, rate="classify", overhead_tokens=80)),
    ("same, only new reviews each day (incremental)",       dict(rows=11_000, in_tokens=180, out_tokens=10, rate="classify", overhead_tokens=80)),
    ("small model for a first pass, large for 10% unclear", None),
]
for name, spec in SCENARIOS:
    if spec is None:
        a = job_cost(4_000_000, 180, 10, "small-model", 80); b = job_cost(400_000, 180, 40, "large-model", 120)
        print(f"{name:58} {a[0] + b[0]:>9,.1f} credits  ${a[1] + b[1]:>8,}"); continue
    c, usd = job_cost(**spec)
    print(f"{name:58} {c:>9,.1f} credits  ${usd:>8,}")
```

With these placeholder rates the ranking is what matters, and it holds for real rates too: a task function with short descriptions beats a general model with a long prompt; incremental processing turns a large one-off into a small daily cost; routing easy rows to a small model and only unclear ones to a large model cuts the bill again. The dollar figure uses an assumed credit price; use your contract's.

## Controls

- **Per-user quotas**: the only AI control with built-in enforcement; evaluated within minutes; cover AI Functions, Agents, CoCo, AI Gateway and CoWork.
- **Budgets**: monthly limits for the account or groups of objects with notifications and actions (actions can lag hours); resource budgets for tagged agents, CoWork and Search; shared resource budgets for tagged users.
- **Query tags**: set `QUERY_TAG` on pipelines so the usage view attributes credits to jobs, not just roles.
- **Warehouse**: a dedicated MEDIUM or smaller warehouse for AI work, with auto-suspend.
- **Caching**: response caching for AI functions (September 2026) and prompt caching for `AI_COMPLETE` (GA 18 Nov 2026) cut the cost of repeated instructions; put the shared part of a prompt first.
- **CoCo limits**: per-surface daily limits (`CORTEX_CODE_*_DAILY_EST_CREDIT_LIMIT_PER_USER`, lesson 33.21); weekly per-user quota limits and named include/exclude lists (GA 16 Sep 2026); users can check their own limits with `MY_BUDGET_SUMMARY` (GA 28 Oct 2026).

| Usage view (`SNOWFLAKE.ACCOUNT_USAGE`) | Covers |
|---|---|
| `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` | AI functions, including custom AI functions |
| `CORTEX_REST_API_USAGE_HISTORY` | Cortex REST API calls (lesson 33.9) |
| `AI_GATEWAY_USAGE_HISTORY` | Cortex AI Gateway (lesson 33.23) |
| `CORTEX_AGENT_USAGE_HISTORY` | Cortex Agents (GA 25 Feb 2026) |
| `SNOWFLAKE_INTELLIGENCE_USAGE_HISTORY` | CoWork (GA 25 Feb 2026) |
| `SNOWFLAKE_COCO_USAGE_HISTORY` | CoCo (GA 17 Aug 2026; also in Organization Usage) |
| `CORTEX_AI_GUARDRAILS_USAGE_HISTORY` | Guardrail checks |
| `METERING_DAILY_HISTORY` | Service-level totals, including the `AI_SERVICES` breakout (April 2026) |

Organisation-level budgets across accounts, tag-based cost anomaly detection and cross-account organisation usage views were announced as generally available in November 2026.

:::check
Which statements are right?

- ✓ `AI_COUNT_TOKENS` estimates tokens without token charges, so it is a cheap way to size a job.
- ✗ A larger warehouse makes AI functions run proportionally faster.
  Snowflake advises MEDIUM or smaller; larger warehouses add cost without speeding them up.
- ✓ Category descriptions in `AI_CLASSIFY` are billed on every row.
:::

:::recap What to keep
- Tokens times rows; pages and audio seconds; warehouse time on top.
- Estimate with `AI_COUNT_TOKENS`; attribute with `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` and query tags.
- Levers: task functions, shorter prompts, routing, incremental runs, page selection, small warehouses; quotas to cap.
:::

## Exercises

1. Put the real rates for two models from the Service Consumption Table into `RATES` and rerun.
2. Add page-based `AI_EXTRACT` cost for 900 contracts at 40 pages each versus 3 selected pages (970 tokens per page).
3. Write the alert query that flags any role whose AI credits doubled week on week.

:::checked Sources and further reading
- [Cost considerations for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-cost)
- [CORTEX_AI_FUNCTIONS_USAGE_HISTORY view](https://docs.snowflake.com/en/sql-reference/account-usage/cortex_ai_functions_usage_history)
- [AI cost management and governance](https://docs.snowflake.com/en/user-guide/snowflake-cortex/governance-and-availability/ai-cost-management-and-governance)
- [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf)
:::
