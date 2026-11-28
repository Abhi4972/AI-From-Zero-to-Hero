---
title: Task Functions: AI_CLASSIFY, AI_FILTER, AI_SENTIMENT, AI_AGG, AI_TRANSLATE and AI_REDACT, Measured Like Models
minutes: 65
group: AI in SQL: Cortex AI Functions
lessons: a0209, a1112
---
:::goals What you will be able to do
- Pick the task function that fits each enrichment instead of writing an `AI_COMPLETE` prompt for everything
- Evaluate a classifier built with `AI_CLASSIFY` the way you would any model: confusion matrix, per-class recall, cost
- Avoid the classic `AI_FILTER` join explosion and use aggregate functions for questions across many rows
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
:::

:::plain The idea in one line
Task functions are purpose-built model calls with fixed outputs; use them for routine enrichment and measure them on labelled data before you rely on them.
:::

## The problem

Brightwell has 4 million product reviews and 300,000 support tickets a year. The product team wants each review tagged by theme, the service team wants English translations of non-English tickets, legal wants personal data removed before anything is shared, and leadership wants "what are customers saying about our tents this quarter?"

## Which function for which job

| Function | Returns | Brightwell use |
|---|---|---|
| `AI_CLASSIFY(input, categories [, config])` | `{"labels": [...]}` (single or multi-label) | Review theme: fit, durability, waterproofing, delivery, price |
| `AI_FILTER(input)` or `AI_FILTER(PROMPT(...))` | BOOLEAN | Keep reviews that mention a safety issue; match tickets to policies |
| `AI_SENTIMENT(text)` | Sentiment, overall and by aspect | Track sentiment by product line |
| `AI_AGG(expr, instruction)` / `AI_SUMMARIZE_AGG(expr)` | One string across many rows, no context-window limit | "Top complaints about tents this quarter" |
| `AI_TRANSLATE(text, source, target)` | Translated text | Tickets from French and German customers |
| `AI_REDACT(text)` | Text with personal data masked | Before sharing tickets with a supplier |
| `AI_EXTRACT(text or file, responseFormat)` | Named fields | Lesson 33.7 |
| `AI_SUMMARIZE(text)` | A summary; multimodal theme summarisation in public preview (Sep 2026) | Summarise a long complaint thread |
| `AI_SIMILARITY(a, b)` | A similarity score between two inputs | Find near-duplicate tickets |
| `AI_COUNT_TOKENS(function, input)` | Token estimate before you run a job (GA Jan 2026) | Budget the 4-million-review job |

```sql
-- multi-label theme tagging with descriptions and a task description
SELECT review_id,
       AI_CLASSIFY(review_text,
         [{'label': 'fit', 'description': 'size, sizing chart, too small or too large'},
          {'label': 'durability', 'description': 'tears, breaks, wears out'},
          {'label': 'waterproofing', 'description': 'leaks, gets wet, rain'},
          {'label': 'delivery', 'description': 'late, damaged in transit, wrong item'},
          {'label': 'price', 'description': 'value for money, discounts'}],
         {'task_description': 'Tag the themes a customer review of outdoor gear talks about', 'output_mode': 'multi'}
       ):labels AS themes
FROM reviews.raw.product_reviews
WHERE review_date >= '2026-10-01';

-- a question across thousands of rows in one call
SELECT product_line,
       AI_AGG(review_text, 'List the three most common complaints, each with an approximate share of reviews') AS top_complaints
FROM reviews.raw.product_reviews
WHERE review_date >= '2026-10-01' AND rating <= 2
GROUP BY product_line;
```

## From the legacy functions

The older `SNOWFLAKE.CORTEX.*` functions still work, but new work should use the `AI_*` family, which takes FILE inputs, supports per-function privileges (GA 13 May 2026) and is the only family custom AI functions accept (lesson 33.11).

| Legacy | Use instead |
|---|---|
| `SNOWFLAKE.CORTEX.COMPLETE` | `AI_COMPLETE` |
| `CLASSIFY_TEXT` | `AI_CLASSIFY` (also images and, in preview, documents) |
| `SENTIMENT` | `AI_SENTIMENT` |
| `SUMMARIZE` | `AI_SUMMARIZE` / `AI_SUMMARIZE_AGG` |
| `TRANSLATE` | `AI_TRANSLATE` (long documents since July 2026) |
| `EXTRACT_ANSWER` | `AI_EXTRACT` |
| `EMBED_TEXT_768`, `EMBED_TEXT_1024` | `AI_EMBED` |
| `PARSE_DOCUMENT` | `AI_PARSE_DOCUMENT` |

Two 2026 cost features apply to all of them: response caching (September) and prompt caching for `AI_COMPLETE` (GA 18 Nov 2026), which makes a long shared instruction cheaper when it is repeated across rows (lesson 33.32). `AI_FILTER`, `AI_AGG` and `AI_SUMMARIZE_AGG` became generally available on 22 January 2026.

## Locally: evaluate the classifier before trusting it

Take 300 reviews labelled by the product team, run `AI_CLASSIFY` on them, and compare. Here the model's outputs are simulated with realistic error patterns (it confuses fit and durability sometimes, and over-tags delivery).

```python
import numpy as np, pandas as pd
r = np.random.default_rng(3)
LABELS = ["fit", "durability", "waterproofing", "delivery", "price"]
truth = r.choice(LABELS, 300, p=[.3, .25, .2, .15, .1])
def predict(t):
    x = r.random()
    if t == "fit" and x < .12: return "durability"
    if t == "durability" and x < .10: return "fit"
    if t in ("price", "fit") and x < .18: return "delivery"
    if x < .04: return r.choice(LABELS)
    return t
pred = np.array([predict(t) for t in truth])
cm = pd.crosstab(pd.Series(truth, name="human label"), pd.Series(pred, name="AI_CLASSIFY"))
print(cm, "\n")
report = pd.DataFrame({"recall": [(pred[truth == l] == l).mean() for l in LABELS],
                       "precision": [(truth[pred == l] == l).mean() if (pred == l).any() else np.nan for l in LABELS],
                       "n": [(truth == l).sum() for l in LABELS]}, index=LABELS).round(2)
print(report)
print("overall accuracy:", round((pred == truth).mean(), 3))
```

Overall accuracy looks fine; the per-class table shows where it is not. `fit` has the lowest recall: 17 fit reviews were tagged `durability`, which also drags durability's precision down to 0.80. `delivery` picks up a few stray fit and price reviews. The fixes are cheap: sharpen the category descriptions, add two or three `examples` in the config, and re-measure on the same labelled set. Because labels, descriptions and examples are billed on every row, keep them short.

## The AI_FILTER join trap

`AI_FILTER` can join two tables on a natural-language condition, for example matching tickets to the policy clauses that apply. Every pair is a model call.

```python
def filter_join_calls(left, right, prefilter_share=1.0):
    return int(left * right * prefilter_share)

tickets, clauses = 2_000, 400
print(f"naive join             : {filter_join_calls(tickets, clauses):>9,} model calls")
print(f"same product line only : {filter_join_calls(tickets, clauses, prefilter_share=0.08):>9,} model calls")
print(f"plus top-5 by Search   : {tickets * 5:>9,} model calls")
```

Snowflake optimises `AI_FILTER` queries automatically where it can (reporting 2 to 10 times faster runs and up to 60% fewer tokens), but no optimiser makes 800,000 calls cheap. Narrow with ordinary predicates first (same product line, date range), or retrieve candidates with Cortex Search (lesson 33.13) and filter only those.

:::check
Which statements are right?

- ✓ `AI_CLASSIFY` category descriptions and examples are billed on every row, so they should be short.
- ✗ `AI_AGG` fails when the rows do not fit in the model's context window.
  It is designed for many rows and is not subject to the context-window limit.
- ✓ An `AI_FILTER` join between two tables makes a model call per pair, so pre-filter first.
:::

:::recap What to keep
- Task functions for routine enrichment; `AI_COMPLETE` when the output is open-ended.
- Evaluate on labelled data: confusion matrix, per-class recall and precision.
- Pre-filter before `AI_FILTER` joins; use `AI_AGG` for questions across rows.
:::

## Exercises

1. Change `predict` so `fit` is confused with `durability` 25% of the time. Which number in the report warns you first?
2. Write the `AI_CLASSIFY` config with two `examples` that would fix the delivery over-tagging.
3. Design the redaction step for tickets shared with suppliers: where in the pipeline does `AI_REDACT` run, and what do you test?

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Support operations with AI functions and dynamic tables](https://www.snowflake.com/en/developers/guides/support-ops-ai-functions-dynamic-tables/) (Snowflake guide)
- [PII redaction recipe](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/pii-redaction) (Cortex AI Cookbook)

:::checked Sources and further reading
- [AI_CLASSIFY](https://docs.snowflake.com/en/sql-reference/functions/ai_classify)
- [AI_FILTER](https://docs.snowflake.com/en/sql-reference/functions/ai_filter)
- [AI_AGG](https://docs.snowflake.com/en/sql-reference/functions/ai_agg)
- [Cost considerations for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-cost)
:::
