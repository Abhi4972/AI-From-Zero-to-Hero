---
title: Document Extraction at Scale: AI_EXTRACT Schemas, Confidence Scores, Citations and Incremental Pipelines
minutes: 70
group: AI in SQL: Cortex AI Functions
lessons: a3113, a0220
---
:::goals What you will be able to do
- Extract fields and tables from contracts and forms with `AI_EXTRACT` and a JSON schema
- Use per-field scores and citations to route low-confidence values to people and to prove where a value came from
- Run extraction incrementally on new files with a stream and a task, and measure field-level accuracy
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Ask for exactly the fields you need, keep the model's confidence and the page it read from, and send anything uncertain to a person instead of straight into a table.
:::

## The problem

Brightwell's 900 supplier contracts decide what it can claim back when goods are faulty. Finance needs four values from each: supplier name, defect claim window (days), who pays return shipping, and the table of volume discounts. Retyping them took a temp two months last year.

## AI_EXTRACT

`AI_EXTRACT` takes text or a file and a `responseFormat`: an object of `{label: question}`, an array of questions, or a JSON `schema` that can include lists and tables. Named arguments add `scores => TRUE` (a 0 to 1 score per field) and `citation => TRUE` (page and bounding box for documents, character spans for text; citations need cross-region inference). Limits: 100 MB per file; up to 1,000 pages with cross-region inference or 125 without; up to 100 field questions or 10 table questions per call.

```sql
CREATE OR REPLACE TABLE contracts.extracted.terms AS
SELECT relative_path,
       AI_EXTRACT(
         file => TO_FILE('@docs.raw.files', relative_path),
         responseFormat => {
           'schema': {'type': 'object', 'properties': {
             'supplier':        {'description': 'Legal name of the supplier', 'type': 'string'},
             'claim_days':      {'description': 'Days after delivery within which defects can be claimed', 'type': 'string'},
             'return_shipping': {'description': 'Who pays return shipping for defective goods: buyer or supplier', 'type': 'string'},
             'volume_discounts': {'description': 'Volume discount table', 'type': 'object',
                                  'column_ordering': ['min_units', 'discount_pct'],
                                  'properties': {'min_units': {'type': 'array'}, 'discount_pct': {'type': 'array'}}}}}},
         scores => TRUE
       ) AS x
FROM DIRECTORY(@docs.raw.files)
WHERE relative_path LIKE 'contracts/%';
```

The result has `response` (the fields), `error`, and with scores a `scoring` object. Each page counts as 970 input tokens for billing, and the response format counts too, so page selection (lesson 33.3) matters here as much as for parsing.

## Locally: measure, threshold and route

A finance analyst checked 120 contracts by hand. Compare extraction against them field by field, then choose a score threshold that sends doubtful values to review.

```python
import numpy as np, pandas as pd
r = np.random.default_rng(21)
FIELDS = {"supplier": .98, "claim_days": .90, "return_shipping": .84}      # true accuracy per field in this simulation
rows = []
for doc in range(120):
    for f, acc in FIELDS.items():
        correct = r.random() < acc
        score = np.clip(r.normal(.9 if correct else .62, .08), 0, 1)        # wrong answers tend to score lower, not always
        rows.append({"doc": doc, "field": f, "correct": correct, "score": score})
ev = pd.DataFrame(rows)
print(ev.groupby("field").correct.mean().round(3).rename("accuracy"), "\n")

def route(ev, threshold):
    auto = ev[ev.score >= threshold]
    return {"threshold": threshold, "auto_share": round(len(auto) / len(ev), 3),
            "auto_accuracy": round(auto.correct.mean(), 3), "errors_reaching_table": int((~auto.correct).sum()),
            "values_for_review": int((ev.score < threshold).sum())}

pd.DataFrame([route(ev, t) for t in (0.0, 0.7, 0.75, 0.8, 0.85)]).set_index("threshold")
```

With no threshold, all 34 errors land in the finance table. At 0.70, only 4 get through and 31 values go to a person; at 0.75, none get through in this sample and 43 go to review. Raising it further only adds review work. On real data the curve is never this clean, so measure it rather than assume it. Pick the threshold with the data owner: it is a business trade between review effort and errors, and it differs by field (a wrong supplier name is worse than a wrong discount row that finance will see anyway).

## Incremental and auditable

```sql
CREATE OR REPLACE STREAM contracts.raw.new_files ON STAGE docs.raw.files;     -- directory-table stream: new and changed files

CREATE OR REPLACE TASK contracts.ops.extract_new
  WAREHOUSE = ai_wh
  SCHEDULE = '60 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('contracts.raw.new_files')
AS
  INSERT INTO contracts.extracted.terms_log (relative_path, extracted_at, x)
  SELECT relative_path, CURRENT_TIMESTAMP(),
         AI_EXTRACT(file => TO_FILE('@docs.raw.files', relative_path), responseFormat => {'schema': ...}, scores => TRUE)   -- the same schema object as above
  FROM contracts.raw.new_files
  WHERE METADATA$ACTION = 'INSERT' AND relative_path LIKE 'contracts/%';
```

Keep the full JSON (`x`) in an append-only log table and build the clean table as a view or dynamic table over it, with the score threshold applied there. That way a threshold change does not need re-extraction, and every value can be traced to its run, file and, with `citation => TRUE`, its page.

:::check
Which statements are right?

- ✓ Per-field scores let low-confidence values go to review instead of straight into a table.
- ✗ A high overall extraction accuracy means every field can be trusted equally.
  Accuracy differs by field; measure and threshold per field.
- ✓ Keeping the raw extraction JSON in a log lets you change thresholds without paying to extract again.
:::

:::recap What to keep
- `AI_EXTRACT` with a schema; `scores` and `citation` named arguments.
- Measure per field on hand-checked documents; threshold with the data owner.
- Stream plus task for new files; append-only log, clean view on top.
:::

## Exercises

1. Make wrong answers score higher (mean 0.75). What happens to the best threshold, and what does that tell you about trusting scores?
2. Set a different threshold per field so that no field has more than 1% errors in the automatic share.
3. Write the dynamic table that exposes only values above their field's threshold.

:::checked Sources and further reading
- [AI_EXTRACT](https://docs.snowflake.com/en/sql-reference/functions/ai_extract)
- [Extracting information from documents with AI_EXTRACT](https://docs.snowflake.com/en/user-guide/snowflake-cortex/document-extraction)
- [Cost considerations for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-cost)
:::
