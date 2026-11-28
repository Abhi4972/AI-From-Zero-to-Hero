---
title: Embeddings, the VECTOR Type and Chunking Text for Retrieval
minutes: 60
group: Retrieval: Cortex Search and RAG
lessons: a1106, a1105
---
:::goals What you will be able to do
- Store embeddings in `VECTOR(FLOAT, n)` columns with `AI_EMBED`, and search them with vector similarity functions
- Chunk parsed documents with `SPLIT_TEXT_RECURSIVE_CHARACTER` and choose chunk size and overlap from evidence
- Decide when to manage vectors yourself and when to let Cortex Search do it
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Retrieval quality is decided before any search runs: how text is split, and which embedding model represents it.
:::

## The problem

Brightwell's parsed policy pages (lesson 33.3) are too long to retrieve whole, and splitting them badly separates a rule from its exceptions. The team needs chunks that keep meaning together, and a way to compare chunking choices with numbers rather than taste.

## Vectors in SQL

```sql
CREATE OR REPLACE TABLE docs.rag.chunks (
  relative_path STRING, page_index INT, chunk_index INT, chunk STRING,
  embedding VECTOR(FLOAT, 1024));

INSERT INTO docs.rag.chunks
SELECT p.relative_path, p.page_index, c.index, c.value::STRING,
       AI_EMBED('snowflake-arctic-embed-l-v2.0', c.value::STRING)          -- 1,024 dimensions, multilingual
FROM docs.parsed.pages p,
     LATERAL FLATTEN(input => SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(p.content, 'markdown', 1200, 150)) c;

-- nearest chunks to a question
SELECT relative_path, chunk,
       VECTOR_COSINE_SIMILARITY(embedding, AI_EMBED('snowflake-arctic-embed-l-v2.0', 'Can I return a used tent?')) AS sim
FROM docs.rag.chunks ORDER BY sim DESC LIMIT 5;
```

Embedding models available include `snowflake-arctic-embed-m-v1.5` (768 dimensions, English), `snowflake-arctic-embed-l-v2.0` (1,024, multilingual), `voyage-multilingual-2` (1,024, 32k context) and others; most have a 512-token context, so chunks longer than that are cut. Embeddings are billed on input tokens only. `SPLIT_TEXT_RECURSIVE_CHARACTER(text, format, chunk_size, overlap)` splits on paragraphs, then lines, then words, and in `'markdown'` mode also on headings, code blocks and tables; sizes are in characters.

## Locally: a recursive splitter and an experiment

```python
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

def recursive_split(text, size, overlap=0, seps=("\n## ", "\n\n", "\n", " ", "")):
    """A small version of the recursive character splitter: try coarse separators first, fall back to finer ones."""
    if len(text) <= size: return [text]
    for sep in seps:
        if sep and sep in text:
            parts, chunks, cur = text.split(sep), [], ""
            for p in parts:
                piece = (sep if cur else "") + p
                if len(cur) + len(piece) <= size: cur += piece
                else:
                    if cur: chunks.append(cur)
                    cur = p if len(p) <= size else ""
                    if len(p) > size: chunks += recursive_split(p, size, 0, seps[seps.index(sep) + 1:])
            if cur: chunks.append(cur)
            if overlap:
                chunks = [chunks[0]] + [chunks[i - 1][-overlap:] + chunks[i] for i in range(1, len(chunks))]
            return chunks
    return [text[i:i + size] for i in range(0, len(text), size)]

POLICY = """# Returns policy
## Unused items
Unused items may be returned within 60 days with a receipt. Refunds go to the original payment method within 5 working days.
## Used items
Tents, sleeping bags and backpacks that show use are refunded at 50% if returned within 30 days. Footwear that shows use cannot be returned.
## Exceptions
Clearance items are final sale. Custom-fitted skis cannot be returned. Gift cards are not refundable.
## Damaged on arrival
Report damage within 7 days with a photo. We pay return shipping for items damaged on arrival.
## Warranty
Manufacturing defects are covered for 2 years. Wear and tear, misuse and accidents are not covered."""

QUESTIONS = {  # question -> a phrase that must be in the retrieved chunk for the answer to be supported
    "Can I return a used tent?": "refunded at 50%",
    "Are clearance items returnable?": "final sale",
    "Who pays shipping if my order arrived damaged?": "We pay return shipping",
    "How long is the warranty?": "covered for 2 years",
    "Can I return worn hiking boots?": "Footwear that shows use",
    "How quickly do refunds arrive?": "within 5 working days",
}

def hit_rate(chunks, k=1):
    vec = TfidfVectorizer().fit(chunks + list(QUESTIONS))
    C = vec.transform(chunks)
    hits = 0
    for q, needle in QUESTIONS.items():
        sims = (C @ vec.transform([q]).T).toarray().ravel()
        top = [chunks[i] for i in np.argsort(-sims)[:k]]
        hits += any(needle in c for c in top)
    return hits / len(QUESTIONS)

for size, overlap in [(80, 0), (160, 0), (160, 40), (300, 0), (2000, 0)]:
    chunks = recursive_split(POLICY, size, overlap)
    print(f"size {size:4} overlap {overlap:3}: {len(chunks):2} chunks, top-1 hit rate {hit_rate(chunks):.2f}, top-3 {hit_rate(chunks, 3):.2f}")
```

Tiny chunks cut rules in half, and one huge chunk always "contains" the answer but would bury it in irrelevant text and exceed embedding context limits in practice. The middle sizes, split on headings, do best. TF-IDF stands in for a neural embedding here; the method is what transfers: a fixed question set with a known answer phrase, a hit rate at k, and a sweep over chunking settings. Run the same sweep in Snowflake with `AI_EMBED` and your real questions before fixing the numbers.

## Manage vectors yourself, or use Cortex Search?

| Own `VECTOR` columns | Cortex Search service |
|---|---|
| Full control of chunking, model and query | Managed embedding, indexing and refresh (`TARGET_LAG`) |
| Pure vector similarity unless you build hybrid ranking | Hybrid keyword plus vector search with reranking, filters and boosts |
| Good for similarity features in pipelines (deduplication, clustering) | Good for question answering, agents and apps |

Most question-answering work belongs on Cortex Search (next lesson); own vectors suit analytical uses such as finding near-duplicate reviews.

:::check
Which statements are right?

- ✓ Chunk size and overlap should be chosen with a question set and a hit rate, not by habit.
- ✗ Bigger chunks are always better because they are more likely to contain the answer.
  They bury the answer, cost more tokens downstream and can exceed the embedding model's context.
- ✓ `SPLIT_TEXT_RECURSIVE_CHARACTER` in `'markdown'` mode also splits on headings and tables.
:::

:::recap What to keep
- `VECTOR(FLOAT, n)`, `AI_EMBED`, `VECTOR_COSINE_SIMILARITY`.
- Chunk with structure in mind; measure hit rate at k across settings.
- Own vectors for analytics; Cortex Search for retrieval in apps and agents.
:::

## Exercises

1. Add two questions whose answers span two sections. Which chunk settings handle them?
2. Change the separators so the splitter never breaks inside a Markdown table row.
3. Write the SQL that finds review pairs with cosine similarity above 0.95 (likely duplicates).

:::checked Sources and further reading
- [Vector embeddings](https://docs.snowflake.com/en/user-guide/snowflake-cortex/vector-embeddings)
- [SPLIT_TEXT_RECURSIVE_CHARACTER](https://docs.snowflake.com/en/sql-reference/functions/split_text_recursive_character-snowflake-cortex)
- [AI_EMBED](https://docs.snowflake.com/en/sql-reference/functions/ai_embed)
:::
