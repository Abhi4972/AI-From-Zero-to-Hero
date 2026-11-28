---
title: Cortex Search Services: Hybrid Retrieval, Attributes and Filters, Boosts and Refresh
minutes: 70
group: Retrieval: Cortex Search and RAG
lessons: a1106, a1105
---
:::goals What you will be able to do
- Create a Cortex Search service with the right search column, attributes, embedding model and refresh settings
- Query it from SQL for testing and from Python or REST for applications, with filters and boosts
- Explain hybrid retrieval (keyword plus vector plus reranking) and show why it beats either half alone
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
A Cortex Search service keeps an always-fresh hybrid index over a query's results; you choose what is searched, what can be filtered, and how fresh it must be.
:::

## The problem

Brightwell's support agents need answers from policies, product manuals and 300,000 past tickets. Pure vector search misses exact product codes ("TH-2P"); pure keyword search misses paraphrases ("my tent leaks" against "water ingress"). They also need filters: only this product line, only current policies.

## Creating the service

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE support.search.knowledge
  ON chunk
  ATTRIBUTES product_line, doc_type, valid_from
  WAREHOUSE = ai_wh
  TARGET_LAG = '1 hour'
  EMBEDDING_MODEL = 'snowflake-arctic-embed-l-v2.0'
AS
  SELECT chunk, relative_path, page_index, product_line, doc_type, valid_from, updated_at
  FROM docs.rag.chunks_with_meta
  WHERE is_current;
```

Decisions in that statement: the **search column** is the chunk text; **attributes** are the only columns you can filter on; **TARGET_LAG** sets freshness (and refresh cost); the **embedding model** cannot be changed later without `CREATE OR REPLACE` (the default is `snowflake-arctic-embed-m-v1.5`, English). A `PRIMARY KEY` (text columns) enables a cheaper refresh path, and the multi-index form (`TEXT INDEXES`, `VECTOR INDEXES`) lets you choose which columns are searched by keyword and which by vector, including your own embeddings.

## Querying

```sql
-- for testing and validation only (string literals, higher latency, 300 KB response cap)
SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW('support.search.knowledge', '{
   "query": "tent pole snapped can I get a replacement",
   "columns": ["chunk", "relative_path", "page_index"],
   "filter": {"@and": [{"@eq": {"product_line": "tents"}}, {"@eq": {"doc_type": "policy"}}]},
   "limit": 5}'))['results'] AS results;
```

```pyshow
from snowflake.core import Root
svc = Root(session).databases["SUPPORT"].schemas["SEARCH"].cortex_search_services["KNOWLEDGE"]
resp = svc.search(query="tent pole snapped can I get a replacement",
                  columns=["chunk", "relative_path", "page_index"],
                  filter={"@and": [{"@eq": {"product_line": "tents"}}, {"@eq": {"doc_type": "policy"}}]},
                  limit=5)
# REST: POST /api/v2/databases/SUPPORT/schemas/SEARCH/cortex-search-services/KNOWLEDGE:query  (PAT, key-pair JWT or OAuth)
```

Filter operators: `@eq`, `@contains` (arrays), `@gte` and `@lte` (numbers and dates), `@primarykey`, combined with `@and`, `@or`, `@not`. Ranking can be tuned with `scoring_config`: `numeric_boosts` (for example, popular articles), `time_decays` (newer tickets first) and, in multi-index services, text and vector weights; reranking is on by default.

## Locally: why hybrid wins

A small version of what the service does: one keyword ranking (BM25), one semantic ranking, fused with reciprocal rank fusion after an attribute filter, then a reranker over the top few. The semantic side here is a stand-in for an embedding model: it maps related words to one meaning ("broke", "snapped", "break") and, like many embedding models, gives product codes little weight.

```python
import math, re
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer

DOCS = [   # (product_line, doc_type, text)
    ("tents", "ticket", "TR-4P fly leaked in heavy rain; seam resealed under warranty."),
    ("tents", "ticket", "TH-2P zipper stuck; slider replaced."),
    ("tents", "policy", "Tent poles that break in normal use are replaced free within 2 years under warranty."),
    ("tents", "manual", "TH-2P setup: insert the colour-coded poles into the matching sleeves before staking."),
    ("tents", "ticket", "TH-2P fly seam let water in after heavy rain; seam resealed under warranty."),
    ("tents", "policy", "Used tents are refunded at 50% within 30 days."),
    ("jackets", "policy", "Jackets with delaminated waterproof membranes are replaced under warranty for 2 years."),
    ("tents", "manual", "Seam sealing: apply sealer to the fly seams if the tent leaks in rain."),
    ("boots", "policy", "Footwear that shows use cannot be returned."),
    ("tents", "ticket", "Pole snapped on night two at the campsite, replacement pole shipped, no charge."),
    ("tents", "ticket", "TR-4P door zipper stuck; slider replaced."),
]
tok = lambda s: re.findall(r"[a-z0-9-]+", s.lower())
MEANING = {"break": "BROKEN", "broke": "BROKEN", "snapped": "BROKEN", "leak": "LEAK", "leaks": "LEAK", "leaking": "LEAK",
           "leaked": "LEAK", "water": "LEAK", "covered": "WARRANTY", "warranty": "WARRANTY", "pole": "POLE", "poles": "POLE",
           "tent": "TENT", "tents": "TENT", "refunded": "REFUND", "money": "REFUND", "zip": "ZIP", "zipper": "ZIP",
           "used": "USED", "worn": "USED"}
meaning = lambda s: " ".join(MEANING.get(w, w) for w in tok(s) if not re.search(r"\d", w))
codes = lambda s: {w for w in tok(s) if re.search(r"\d", w) and "-" in w}

def bm25(query, docs, k1=1.5, b=0.75):
    toks = [tok(d) for d in docs]; avg = np.mean([len(t) for t in toks]); N = len(docs)
    df = Counter(w for t in toks for w in set(t)); out = []
    for t in toks:
        tf = Counter(t)
        out.append(sum(math.log(1 + (N - df[w] + .5) / (df[w] + .5)) * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(t) / avg))
                       for w in tok(query) if w in tf))
    return np.array(out)

def semantic(query, docs):
    v = TfidfVectorizer().fit([meaning(d) for d in docs] + [meaning(query)])
    return (v.transform([meaning(d) for d in docs]) @ v.transform([meaning(query)]).T).toarray().ravel()

def rrf(a, b, k=60):
    fused = Counter()
    for scores in (a, b):
        for rank, i in enumerate(np.argsort(-scores, kind="stable")): fused[i] += 1 / (k + rank + 1)
    return [i for i, _ in fused.most_common()]

def rerank(query, texts, candidates, sem):   # a stand-in reranker over the top candidates: meaning plus exact product-code agreement
    return sorted(candidates, key=lambda i: -(sem[i] + 1.0 * len(codes(query) & codes(texts[i]))))

def ranked(query, product_line, mode):
    idx = [i for i, d in enumerate(DOCS) if d[0] == product_line]          # attribute filter first
    texts = [DOCS[i][2] for i in idx]
    kw, sem = bm25(query, texts), semantic(query, texts)
    order = {"keyword": list(np.argsort(-kw, kind="stable")), "semantic": list(np.argsort(-sem, kind="stable")),
             "hybrid": rrf(kw, sem)}.get(mode)
    if mode == "hybrid + rerank":
        fused = rrf(kw, sem); order = rerank(query, texts, fused[:5], sem) + fused[5:]
    return [idx[i] for i in order]

QUERIES = {"TH-2P leaking in rain": 4, "my tent pole broke, is it covered?": 2, "TR-4P zip": 10,
           "can I get money back for a worn tent": 5, "pole snapped": 9}
MODES = ["keyword", "semantic", "hybrid", "hybrid + rerank"]
table = pd.DataFrame({m: [ranked(q, "tents", m).index(t) + 1 for q, t in QUERIES.items()] for m in MODES}, index=list(QUERIES))
print(table.to_string())
print("\nmean reciprocal rank:", {m: round(float(np.mean([1 / r for r in table[m]])), 2) for m in MODES})
```

Each cell is the rank of the right document. Keyword search nails the product-code questions and fails the paraphrases ("money back for a worn tent" against "used tents are refunded"). The semantic side handles paraphrase but confuses near-identical tickets for different products (TH-2P against TR-4P). Fusion brings the right document into the top five for every question, and reranking those five with the full query puts it first. That is the design of Cortex Search: lexical and vector retrieval, fused, then reranked by default, with neural models in place of these stand-ins.

## Whose rights does search use?

By default a Cortex Search service answers with its **owner's** rights: anyone who may use the service retrieves everything it indexed, and row access and masking policies on the source table do not apply at query time. Three ways to handle it:

| Approach | How | Status |
|---|---|---|
| Index only what every user may see | Build the service on a view filtered to the lowest-privileged audience; one service per audience if needed | Always available |
| Filter by permission attributes | Index an attribute such as `user_emails` or `allowed_roles` and have the application pass the caller in a filter (the Openflow SharePoint pattern) | Available; the application must supply the right identity |
| Inherit source policies | `INHERIT_DATA_GOVERNANCE_POLICIES = TRUE` plus a `PRIMARY KEY`; query only with `CORTEX_SEARCH_RETRIEVE` or `CORTEX_SEARCH_BATCH`; the REST and Python APIs and `SEARCH_PREVIEW` are blocked for such services; filtering happens after retrieval, so fewer results can come back | Public preview 17 Nov 2026 |

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE support.search.tickets_governed
  ON body  PRIMARY KEY (ticket_id)  ATTRIBUTES region, product_line
  WAREHOUSE = ai_wh  TARGET_LAG = '1 hour'
  INHERIT_DATA_GOVERNANCE_POLICIES = TRUE
AS SELECT ticket_id, body, region, product_line FROM support.raw.tickets;
```

Other 2026 additions: `CORTEX_SEARCH_RETRIEVE` (GA 18 Nov), batch search for high-throughput jobs (GA 18 May), component scores in results (GA 4 Feb), replication (GA 14 Apr), request monitoring (preview Apr), resource budgets for search (July), auto-suspend and resume of serving (preview May), and lineage for search services (October).

## Operating a service

| Setting | Trade-off |
|---|---|
| `TARGET_LAG` | Fresher index costs more refresh compute; policies need hours, tickets maybe minutes |
| Warehouse | Used for refreshes; size it for the source query, not for search traffic |
| Attributes | Filterable but must be in the source query; add the ones agents will need (product line, region, permissions) |
| `INITIALIZE = ON_SCHEDULE` | Creates instantly but queries fail until the first refresh |
| Rights | Owner's rights by default; filter by permission attributes or inherit policies (preview) |

:::check
Which statements are right?

- ✓ Only columns listed as `ATTRIBUTES` can be used in search filters.
- ✗ `SEARCH_PREVIEW` is the right way for an application to query a service.
  It is for testing; applications use the Python API or REST endpoint.
- ✓ Hybrid retrieval helps when queries mix exact identifiers with paraphrased language.
- ✗ Row access policies on the source table always filter Cortex Search results.
  By default the service uses its owner's rights; inheritance must be enabled, and it is in preview.
:::

:::recap What to keep
- Search column, attributes, `TARGET_LAG`, embedding model (fixed after creation).
- `SEARCH_PREVIEW` to test; Python or REST in apps; filters and scoring config.
- Hybrid keyword plus vector plus reranking; filter by attributes first.
- Search answers with the owner's rights unless you filter by permissions or inherit policies.
:::

## Exercises

1. Add a query with a typo ("TH-2P leeking"). Which mode survives it, and what would a real embedding model do?
2. Add a `time_decays` idea locally: multiply ticket scores by a factor that halves every 90 days.
3. Write the `CREATE` statement for a separate ticket-only service with `TARGET_LAG = '10 minutes'`, and justify splitting it from the policy service.

:::checked Sources and further reading
- [Data governance policy inheritance for Cortex Search](https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-search/cortex-search-data-governance-inheritance)
- [CREATE CORTEX SEARCH SERVICE](https://docs.snowflake.com/en/sql-reference/sql/create-cortex-search)
- [Query a Cortex Search service](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/query-cortex-search-service)
- [Cortex Search overview](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview)
- Cormack, Clarke and Büttcher, "Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods", SIGIR 2009
:::
