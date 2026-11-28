---
title: AI_COMPLETE in Practice: Models, PROMPT(), Structured Outputs and Usage Details
minutes: 60
group: AI in SQL: Cortex AI Functions
lessons: a1110, a1111
---
:::goals What you will be able to do
- Call `AI_COMPLETE` from SQL with a model, a `PROMPT()` template, parameters and a JSON schema
- Validate structured outputs before they reach a table, and route failures to review
- Read token usage from `show_details` and attach it to each row for cost tracking
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
`AI_COMPLETE` is a model call that runs per row inside a query; give it a schema so every row comes back in the same shape, and check that shape before you trust it.
:::

## The problem

Brightwell wants every support ticket turned into a structured record: product, problem type, whether the customer asks for a refund, and urgency. Free-text answers would need parsing and would vary row to row. Structured outputs make the model return an object that matches a schema.

## The call

`AI_COMPLETE(model, prompt [, model_parameters, response_format, show_details])`. Parameters: `temperature` and `top_p` (0 to 1, default 0), `max_tokens` (default 4096) and `guardrails` (TRUE enables Cortex Guard filtering, billed as extra input tokens). `response_format` takes a JSON schema object whose top level is an OBJECT.

```sql
CREATE OR REPLACE TABLE support.enriched.ticket_fields AS
SELECT t.ticket_id,
       AI_COMPLETE(
         model => 'claude-haiku-4-5',
         prompt => PROMPT('Extract fields from this Brightwell support ticket. Ticket: {0}', t.body),
         model_parameters => {'temperature': 0, 'max_tokens': 300},
         response_format => {
           'type': 'json',
           'schema': {'type': 'object',
                      'properties': {'product': {'type': 'string'},
                                     'problem': {'type': 'string', 'enum': ['defect', 'sizing', 'delivery', 'billing', 'other']},
                                     'wants_refund': {'type': 'boolean'},
                                     'urgency': {'type': 'string', 'enum': ['low', 'medium', 'high']}},
                      'required': ['product', 'problem', 'wants_refund', 'urgency']}},
         show_details => TRUE
       ) AS result
FROM support.raw.tickets t
WHERE t.created_at >= DATEADD(day, -1, CURRENT_DATE());
```

With `show_details => TRUE`, the result holds `structured_output` (with the object in `raw_message`), `created`, `model` and `usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`, and `prompt_cache_tokens` when the cache was read). Model names change as Snowflake adds and retires models; check `SHOW CORTEX BASE MODELS` and the model availability page, and pin the name in code.

## Locally: validate, route and account

The results below have the shape `AI_COMPLETE` returns with `show_details`. One is broken on purpose, as real runs occasionally are.

```python
import json
import pandas as pd

SCHEMA = {"product": str, "problem": {"defect", "sizing", "delivery", "billing", "other"},
          "wants_refund": bool, "urgency": {"low", "medium", "high"}}

RESULTS = {
    "T-1001": {"structured_output": [{"raw_message": {"product": "Trailhead 2P tent", "problem": "defect", "wants_refund": True, "urgency": "high"}, "type": "json"}],
               "model": "claude-haiku-4-5", "usage": {"prompt_tokens": 412, "completion_tokens": 38, "total_tokens": 450}},
    "T-1002": {"structured_output": [{"raw_message": {"product": "Summit jacket M", "problem": "sizing", "wants_refund": False, "urgency": "low"}, "type": "json"}],
               "model": "claude-haiku-4-5", "usage": {"prompt_tokens": 380, "completion_tokens": 35, "total_tokens": 415, "prompt_cache_tokens": 300}},
    "T-1003": {"structured_output": [{"raw_message": {"product": "", "problem": "refund", "wants_refund": "yes", "urgency": "high"}, "type": "json"}],
               "model": "claude-haiku-4-5", "usage": {"prompt_tokens": 401, "completion_tokens": 33, "total_tokens": 434}},
}

def validate(obj):
    problems = []
    for field, rule in SCHEMA.items():
        v = obj.get(field)
        if isinstance(rule, set):
            if v not in rule: problems.append(f"{field}={v!r} not in {sorted(rule)}")
        elif not isinstance(v, rule) or (rule is str and not v.strip()):
            problems.append(f"{field}={v!r} is not a valid {rule.__name__}")
    return problems

rows = []
for tid, res in RESULTS.items():
    obj = res["structured_output"][0]["raw_message"]
    problems = validate(obj)
    u = res["usage"]
    rows.append({"ticket": tid, "status": "review" if problems else "ok", "problems": "; ".join(problems),
                 "in_tokens": u["prompt_tokens"], "out_tokens": u["completion_tokens"], "cached": u.get("prompt_cache_tokens", 0)})
pd.DataFrame(rows).set_index("ticket")
```

The third ticket passes JSON parsing but fails the business rules: an empty product, an invented `problem` value and a string where a boolean belongs. A JSON schema reduces this, but your own validation decides what reaches the table. In SQL, the same checks are a `CASE` over the object's fields, with failures written to a review table instead of the main one.

## What to keep in the prompt and what not

| Keep | Avoid |
|---|---|
| The task, the allowed values, and the definition of each field | Asking the model to compute totals or dates it can read from columns |
| A short example for ambiguous fields | Long instructions repeated per row when a task function would do (lesson 33.5) |
| The text the model needs, nothing else | Passing whole customer records "for context": cost and privacy |

:::check
Which statements are right?

- ✓ `show_details => TRUE` returns token usage that can be stored per row for cost tracking.
- ✗ A response that matches the JSON schema is always correct.
  It can be well-formed and still wrong or empty; validate business rules too.
- ✓ `guardrails => TRUE` in `model_parameters` turns on Cortex Guard for that call, at extra input-token cost.
:::

:::recap What to keep
- `AI_COMPLETE(model, PROMPT(...), params, response_format, show_details)`.
- Schema for shape, your own checks for meaning, a review table for failures.
- Store usage per row; pin model names and re-check availability.
:::

## Exercises

1. Add an `order_id` field with a regex rule (`BW-` followed by eight digits) and a ticket that violates it.
2. Write the SQL `CASE` that sends invalid rows to `support.enriched.ticket_review`.
3. Estimate tokens for 50,000 tickets a day from the usage above, and say which field you would drop if cost had to fall by a third.

:::checked Sources and further reading
- [AI_COMPLETE (single string)](https://docs.snowflake.com/en/sql-reference/functions/ai_complete-single-string)
- [Snowflake Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql)
- [Model availability for Snowflake Cortex AI](https://docs.snowflake.com/en/user-guide/snowflake-cortex/model-availability)
:::
