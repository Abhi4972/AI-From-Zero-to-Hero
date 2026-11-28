---
title: Custom AI Functions: CREATE AI FUNCTION, Cortex AI Function Studio, Evaluation, Optimization and Snowflake Decision
minutes: 65
group: AI in SQL: Cortex AI Functions
lessons: a3113, a1110
---
:::goals What you will be able to do
- Package a prompt and model as a governed, reusable SQL object with `CREATE AI FUNCTION`
- Measure a function's quality and cost on a versioned labelled dataset with `AI_FUNCTION_EVALUATION`, and search for a better or cheaper version with `AI_FUNCTION_OPTIMIZATION`
- Choose between a general-purpose model and Snowflake Decision for bounded classify-and-score tasks
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
:::

:::plain The idea in one line
Stop copying the same prompt into twenty queries: make it a named function, prove how good it is on labelled data, let Snowflake search for a cheaper version, and adopt it only if the numbers say so.
:::

## The problem

Brightwell's ticket-routing prompt exists in nine dashboards, three dynamic tables and a notebook, each slightly different. When someone "improved" one copy, routing accuracy dropped and nobody noticed for a month. There was no single object to version, test or grant.

## Step 1: a custom AI function

`CREATE AI FUNCTION` makes a schema-level function whose body is a single scalar SQL expression calling at least one scalar AI function (`AI_COMPLETE`, `AI_CLASSIFY` and so on; the legacy `SNOWFLAKE.CORTEX.*` functions and `AI_AGG` are not accepted). It needs `CREATE FUNCTION` on the schema, like a UDF, and callers need `SNOWFLAKE.CORTEX_USER` plus model access (lesson 33.2). There is no surcharge: you pay the underlying model's tokens.

```sql
CREATE OR REPLACE AI FUNCTION support.ai.route_ticket(body VARCHAR)
  RETURNS VARCHAR
  COMMENT = 'Routes a ticket to billing, delivery, returns or product. Owner: support analytics.'
  AS $$
    AI_COMPLETE('claude-sonnet-4-6',
      'Route this customer ticket to exactly one of: billing, delivery, returns, product. Reply with the label only. Ticket: ' || body)::VARCHAR
  $$;

SELECT ticket_id, support.ai.route_ticket(body) AS queue FROM support.raw.tickets LIMIT 10;
```

Because it is an object, it gets the normal lifecycle: grants, `COMMENT`, tags, `SHOW`, replacement under change control (lesson 33.34), and usage per function in `CORTEX_AI_FUNCTIONS_USAGE_HISTORY`.

## Step 2: evaluate, then optimize

Evaluation and optimization run as **experiments** (`CREATE EXPERIMENT ... TYPE = ... FROM SPECIFICATION $$...$$`, then `EXECUTE EXPERIMENT`), asynchronously on serverless compute. You read results with `SHOW RUNS`, `SHOW RUN METRICS` and `SHOW RUN PARAMETERS`, or in Snowsight, which plots quality against cost.

| Step | Function | What it needs | What you get |
|---|---|---|---|
| Evaluate | `AI_FUNCTION_EVALUATION` | The expression, a versioned `SNOWFLAKE.ML.DATASET` with a `ground_truth` column (50 to 200 rows recommended, 1,000 maximum), one metric | Aggregate quality, cost and tokens; the function is unchanged |
| Optimize | `AI_FUNCTION_OPTIMIZATION` | Candidate `models`, a `reflection_model`, an `algorithm` (`gepa` default, or `cocoevolve`), a `strategy` (`quality_first`, `balanced`, `cost_first`) and a `budget` | A `SEED` run for the original and `ITER_<N>` runs for candidates, each scored on quality and cost |
| Adopt | `CREATE AI FUNCTION ... FROM EXPERIMENT ... RUN ...` | The run you chose | A new function; the original is never modified |

Metrics: `exact_match`, `fuzzy_match`, `contains_match`, `redaction_match`, `llm_judge` and `custom`. Scores are comparable only when dataset version, labels, metric, judge model and any custom function are the same, which is why the dataset must be a versioned Dataset and not a table.

```sql
CREATE OR REPLACE AI FUNCTION support.ai.route_ticket_v2(body VARCHAR)
  RETURNS VARCHAR
  FROM EXPERIMENT support.ai.route_ticket_opt RUN ITER_22;
```

**Cortex AI Function Studio** is the guided, CoCo-driven way to do the same: it can use your labels, label existing inputs for review, or generate synthetic inputs and labels, then runs evaluation and optimization over the same objects. Status: public preview from 20 May 2026, generally available from 16 November 2026, together with Function Optimization.

## Step 3: Snowflake Decision for bounded decisions

**Snowflake Decision** (private preview from 7 October 2026, preview for `AI_COMPLETE` from 20 November 2026) is a model built for high-volume classify, score, filter and route tasks rather than open-ended reasoning. You call it through `AI_COMPLETE` with the model name `'snowflake-decision'` and a JSON prompt holding the input (`state`) and named `questions` of three types: `choice` (pick one option), `score` (an ordered rubric) and `noul` (a 0 to 1 probability). The answer is typed, with per-option probabilities and a confidence value, so a pipeline can route low-confidence rows to a larger model or a person.

## Locally: evaluate and choose on the quality and cost frontier

```python
import pandas as pd
gold = pd.DataFrame({
    "body": ["Charged twice for my order", "Parcel never arrived", "Can I return a used tent?", "Zip on the jacket broke",
             "Refund still not in my account", "Courier left it at the wrong house", "Want to send back unworn boots",
             "Stove will not light", "Invoice shows wrong VAT", "Tracking stuck for a week"],
    "ground_truth": ["billing", "delivery", "returns", "product", "billing", "delivery", "returns", "product", "billing", "delivery"]})

# outputs of four candidate implementations on the same versioned dataset, and their cost per 1,000 rows (illustrative)
runs = {
    "SEED (large model, long prompt)": (["billing", "delivery", "returns", "product", "returns", "delivery", "returns", "product", "billing", "delivery"], 3.10),
    "ITER_7 (large model, short prompt)": (["billing", "delivery", "returns", "product", "billing", "delivery", "returns", "product", "billing", "delivery"], 1.90),
    "ITER_15 (small model)": (["billing", "delivery", "returns", "product", "billing", "delivery", "returns", "product", "billing", "product"], 0.35),
    "ITER_22 (small model, label examples)": (["billing", "delivery", "returns", "product", "billing", "delivery", "returns", "product", "billing", "delivery"], 0.42),
}
rows = [{"run": k, "exact_match": (pd.Series(v[0]) == gold.ground_truth).mean(), "cost_per_1k": v[1]} for k, v in runs.items()]
res = pd.DataFrame(rows).sort_values("cost_per_1k")
res["on_frontier"] = [not any((o.exact_match >= r.exact_match) and (o.cost_per_1k < r.cost_per_1k) for o in res.itertuples() if o.run != r.run)
                      for r in res.itertuples()]
print(res.to_string(index=False))
best = res[res.exact_match >= 0.95].sort_values("cost_per_1k").iloc[0]
print(f"\nadopt: {best.run}  ({best.exact_match:.0%} at {best.cost_per_1k} per 1k rows; {3.10 / best.cost_per_1k:.1f}x cheaper than SEED)")
```

Ten rows are far too few to adopt anything (the documentation asks for 50 to 200), but the decision rule is the real one: set the quality bar first, then take the cheapest run that clears it on the frontier. Re-run the evaluation on the adopted function before switching callers.

:::check
Which statements are right?

- ✓ Optimization never changes the original AI function; adopting a candidate creates a new function.
- ✗ Any table with a label column can be used as the evaluation dataset.
  The evaluation needs a versioned `SNOWFLAKE.ML.DATASET`, so scores stay comparable.
- ✓ Snowflake Decision suits bounded tasks such as routing and scoring, returning typed answers with confidence.
:::

:::recap What to keep
- `CREATE AI FUNCTION`: one governed object per prompt, billed at model cost.
- Evaluate on a versioned Dataset with one metric; optimize across models and prompts; adopt `FROM EXPERIMENT`.
- Quality bar first, then the cheapest run on the frontier.
:::

## Exercises

1. Write the `custom` metric you would use if "billing" and "returns" mistakes cost three times more than others.
2. Which Brightwell prompts, today copied across queries, should become AI functions first, and who owns each?
3. Design the routing rule that sends Snowflake Decision answers with low confidence to a larger model.

:::checked Sources and further reading
- [CREATE AI FUNCTION](https://docs.snowflake.com/sql-reference/sql/create-ai-function)
- [Cortex AI Function evaluation and optimization](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-function-studio) and [AI_FUNCTION_OPTIMIZATION](https://docs.snowflake.com/en/sql-reference/functions/ai_function_optimization)
- [Introducing Snowflake Decision in Cortex AI Functions](https://www.snowflake.com/en/blog/snowflake-decision-cortex-ai-functions/), Snowflake blog
- Snowflake release notes: Cortex AI Function Studio (20 May 2026, 16 Nov 2026)
:::
