---
title: Getting Unstructured Data In: Stages, Directory Tables, Openflow and AI_PARSE_DOCUMENT
minutes: 60
group: Foundations: the stack, access and data
lessons: a3016, a3002
---
:::goals What you will be able to do
- Land files in a stage with a directory table, so they can be listed, tracked and referenced from SQL
- Parse PDFs, slides and images into text or layout-preserving Markdown with `AI_PARSE_DOCUMENT`
- Build an incremental parse pipeline that only processes new files and only pays for the pages it needs
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Files become usable by AI when they sit on a stage Snowflake can list, are parsed once into text with page structure, and are stored in a table that later steps can chunk, search and extract from.
:::

## The problem

Brightwell's knowledge lives in 3,400 files: return policies (PDF), supplier contracts (PDF and DOCX), product spec sheets (PPTX) and scanned warranty cards (JPEG). Some arrive weekly from SharePoint. Parsing every file on every run is slow and costly; parsing nothing leaves the agents blind.

## Stages and directory tables

```sql
CREATE STAGE IF NOT EXISTS docs.raw.files
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');       -- server-side encryption: the simplest choice for stages AI functions read
ALTER STAGE docs.raw.files REFRESH;            -- update the directory table after uploads
SELECT relative_path, size, last_modified FROM DIRECTORY(@docs.raw.files) ORDER BY last_modified DESC LIMIT 5;
```

`TO_FILE('@docs.raw.files', 'policies/returns-2026.pdf')` turns a staged path into a FILE reference that `AI_PARSE_DOCUMENT`, `AI_EXTRACT`, `AI_COMPLETE` and `AI_TRANSCRIBE` accept. For sources such as SharePoint and Google Drive, **Openflow connectors** sync files incrementally into a stage (the "simple ingest" variants) or straight into a Cortex Search service (the Cortex Search variants), optionally with document permissions.

## Parsing

`AI_PARSE_DOCUMENT(file, options)` has three modes: `'OCR'` (text only), `'LAYOUT'` (keeps headings and tables as Markdown) and `'AGENTIC'` (adds understanding of charts and diagrams). `page_split => TRUE` returns one object per page, which you want for citations and chunking. It is billed per page processed, so parse once and keep the result.

```sql
CREATE TABLE IF NOT EXISTS docs.parsed.pages (relative_path STRING, page_index INT, content STRING, parsed_at TIMESTAMP_NTZ);

INSERT INTO docs.parsed.pages
WITH todo AS (                                   -- only files not parsed yet
  SELECT d.relative_path FROM DIRECTORY(@docs.raw.files) d
  LEFT JOIN (SELECT DISTINCT relative_path FROM docs.parsed.pages) p USING (relative_path)
  WHERE p.relative_path IS NULL AND d.relative_path ILIKE ANY ('%.pdf', '%.docx', '%.pptx', '%.jpg')
),
parsed AS (
  SELECT relative_path,
         AI_PARSE_DOCUMENT(TO_FILE('@docs.raw.files', relative_path), {'mode': 'LAYOUT', 'page_split': TRUE}) AS doc
  FROM todo
)
SELECT relative_path, pg.value:index::INT, pg.value:content::STRING, CURRENT_TIMESTAMP()::TIMESTAMP_NTZ
FROM parsed, LATERAL FLATTEN(input => doc:pages) pg;
```

Client-side encrypted stages also work with `AI_EXTRACT` and `AI_PARSE_DOCUMENT` since August 2026. Limits worth designing around: 100 MB per file, up to 2,000 pages per document, and page selection (`page_filter` or `FL_FILTER_PAGES`) to process only the pages you need, which also limits the bill.

## Locally: what a parse result looks like, and what it costs

```python
import json
import pandas as pd

parse_results = {   # the shape AI_PARSE_DOCUMENT returns with page_split: metadata.pageCount and pages[{index, content}]
    "policies/returns-2026.pdf": {"metadata": {"pageCount": 3}, "pages": [
        {"index": 0, "content": "# Returns policy 2026\n\nUnused items may be returned within 60 days with a receipt."},
        {"index": 1, "content": "## Used items\n\nTents and sleeping bags that show use are refunded at 50% if returned within 30 days."},
        {"index": 2, "content": "## Exceptions\n\n| Item | Rule |\n|---|---|\n| Clearance | Final sale |\n| Custom skis | Not returnable |"}]},
    "contracts/supplier-alpine.pdf": {"metadata": {"pageCount": 41}, "pages": [
        {"index": i, "content": f"Clause {i + 1}. ..."} for i in range(41)]},
}

rows = [{"relative_path": path, "page_index": p["index"], "chars": len(p["content"]), "has_table": "|---|" in p["content"]}
        for path, doc in parse_results.items() for p in doc["pages"]]
pages = pd.DataFrame(rows)
print(pages.groupby("relative_path").agg(pages=("page_index", "count"), chars=("chars", "sum"), tables=("has_table", "sum")))
```

```python
def parse_plan(files, already_parsed, pages_needed=None):
    """files: {path: page_count}; pages_needed: {path: [page indexes]} to use page selection."""
    todo = {f: n for f, n in files.items() if f not in already_parsed}
    billed = sum(len(pages_needed[f]) if pages_needed and f in pages_needed else n for f, n in todo.items())
    return {"files_to_parse": len(todo), "pages_billed": billed}

library = {f"contracts/c{i:03d}.pdf": 40 for i in range(900)} | {f"policies/p{i:02d}.pdf": 4 for i in range(60)}
parsed_before = {f for f in library if f.startswith("policies/")}
print("first full run      :", parse_plan(library, set()))
print("incremental run     :", parse_plan(library, parsed_before))
print("contracts, pages 1-3 only (where the refund terms live):",
      parse_plan(library, parsed_before, {f: [0, 1, 2] for f in library if f.startswith("contracts/")}))
```

The incremental run skips what is already parsed, and page selection cuts the contract bill by more than ten times when only the first pages matter. Multiply the page counts by the per-page rate in Snowflake's Service Consumption Table to turn this into credits.

:::check
Which statements are right?

- ✓ A directory table lets SQL list staged files and find the ones not processed yet.
- ✗ `OCR` mode is the best choice for documents with tables.
  `LAYOUT` keeps tables and headings as Markdown; `OCR` returns plain text.
- ✓ `AI_PARSE_DOCUMENT` is billed per page, so parse once and store the pages.
:::

:::recap What to keep
- Stage with a directory table and server-side encryption; `TO_FILE` to reference files.
- `LAYOUT` and `page_split` for downstream chunking and citations.
- Parse incrementally and select pages; store results in a table.
:::

## Exercises

1. Add a `content_hash` column and re-parse a file only when its content changes, not when it is re-uploaded unchanged.
2. Which Brightwell files would need `AGENTIC` mode? What would you check before paying for it?
3. Write the task that runs the incremental `INSERT` every night after the stage refresh.

:::checked Sources and further reading
- [Parsing documents with AI_PARSE_DOCUMENT](https://docs.snowflake.com/en/user-guide/snowflake-cortex/parse-document)
- [About Openflow Connector for SharePoint](https://docs.snowflake.com/en/user-guide/data-integration/openflow/connectors/sharepoint/about)
- [Cost considerations for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-cost)
:::
