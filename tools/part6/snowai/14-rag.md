---
title: RAG on Snowflake: Search, Answer with Citations, and Check Grounding Before Users Do
minutes: 60
group: Retrieval: Cortex Search and RAG
lessons: a1106, a3113
---
:::goals What you will be able to do
- Combine a Cortex Search call with `AI_COMPLETE` to answer questions with numbered citations
- Check every answer for citation validity and grounding before it is shown
- Build a small golden set that tells you whether a retrieval or prompt change helped
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Retrieve a few relevant chunks, ask the model to answer only from them and cite them, then verify the citations in code.
:::

## The problem

Brightwell's first prototype answered "Can I return a used tent?" with "Yes, within 60 days", which is the rule for **unused** items. The retrieved chunks were right; the model blended two rules. Citations and a grounding check would have caught it.

## The pattern in Snowflake

In an application: query the Cortex Search service (Python or REST), build a prompt with numbered sources, call `AI_COMPLETE`, then validate. In most production cases the same flow sits inside a Cortex Agent (lesson 33.17), which does retrieval, answering and citations for you; building it once by hand shows what the agent is doing and what to test.

```pyshow
from snowflake.core import Root
from snowflake.snowpark.functions import ai_complete     # or run AI_COMPLETE through session.sql

def answer(session, question, product_line):
    svc = Root(session).databases["SUPPORT"].schemas["SEARCH"].cortex_search_services["KNOWLEDGE"]
    hits = svc.search(query=question, columns=["chunk", "relative_path", "page_index"],
                      filter={"@eq": {"product_line": product_line}}, limit=4).results
    sources = "\n".join(f"[{i + 1}] {h['chunk']}" for i, h in enumerate(hits))
    prompt = ("Answer the question using only the numbered sources. Cite sources like [1]. "
              "If the sources do not answer it, say you don't know.\n\n" + sources + "\n\nQuestion: " + question)
    text = session.sql("SELECT AI_COMPLETE('claude-sonnet-4-5', ?)", params=[prompt]).collect()[0][0]
    return text, hits
```

## Locally: check citations and grounding

```python
import re

SOURCES = {
    1: "Unused items may be returned within 60 days with a receipt.",
    2: "Tents, sleeping bags and backpacks that show use are refunded at 50% if returned within 30 days.",
    3: "Clearance items are final sale.",
}
ANSWERS = {   # recorded answers from three prompt versions to "Can I return a used tent?"
    "v1 (no citation rule)": "Yes, you can return it within 60 days for a full refund.",
    "v2 (cites the wrong rule)": "Yes, a used tent can be returned within 60 days for a full refund [2].",
    "v3 (cites, grounded)": "Yes, a used tent can be returned within 30 days for a 50% refund [2].",
}

def numbers(s): return set(re.findall(r"\d+%?", s))

def check(answer, sources):
    cited = [int(c) for c in re.findall(r"\[(\d+)\]", answer)]
    issues = []
    if not cited: issues.append("no citations")
    issues += [f"cites missing source [{c}]" for c in cited if c not in sources]
    for sentence in re.split(r"(?<=[.!?])\s+", answer):
        refs = [int(c) for c in re.findall(r"\[(\d+)\]", sentence) if int(c) in sources]
        support = " ".join(sources[c] for c in refs) if refs else ""
        unsupported = numbers(re.sub(r"\[\d+\]", "", sentence)) - numbers(support)
        if unsupported: issues.append(f"numbers {sorted(unsupported)} not in the cited source(s)")
    return issues or ["ok"]

for name, a in ANSWERS.items():
    print(f"{name:26} {check(a, SOURCES)}")
```

The check is simple but catches the failure that matters most in policy answers: a number (days, percentages, prices) that does not appear in the source cited for it. Version 2 looks trustworthy, with a citation and a confident tone, but its 60 days come from the unused-items rule while it cites the used-items rule, which says 30. Version 1 has no citations at all. A model-based grounding judge (lesson 33.24) adds checks for claims without numbers, such as "full refund".

## A golden set for the retrieval layer

```python
GOLDEN = [  # question, product line, the source id that must be retrieved
    ("Can I return a used tent?", "tents", 2), ("Are clearance tents returnable?", "tents", 3),
    ("Return window for an unused stove?", "cooking", 1)]
RETRIEVED = {   # top-3 source ids from two service configurations
    "service A (default model)": {0: [1, 2, 3], 1: [1, 2, 3], 2: [2, 1, 3]},
    "service B (filter + l-v2.0)": {0: [2, 1, 3], 1: [3, 1, 2], 2: [1, 2, 3]},
}
for name, got in RETRIEVED.items():
    top1 = sum(got[i][0] == g[2] for i, g in enumerate(GOLDEN)) / len(GOLDEN)
    top3 = sum(g[2] in got[i] for i, g in enumerate(GOLDEN)) / len(GOLDEN)
    print(f"{name:28} recall@1 {top1:.2f}  recall@3 {top3:.2f}")
```

Measure retrieval separately from answering. If the right chunk is not in the top results, no prompt will fix the answer; if it is and the answer is still wrong, work on the prompt or the model.

:::check
Which statements are right?

- ✓ Checking that numbers in an answer appear in the cited source catches many policy errors.
- ✗ If the answer is wrong, the retrieval must be wrong.
  The right chunks can be retrieved and still be blended or misread by the model.
- ✓ Recall at k on a small golden set tells you whether a search-service change helped.
:::

:::recap What to keep
- Search, numbered sources, `AI_COMPLETE`, then validate citations in code.
- Numeric grounding checks catch the costliest policy errors.
- Evaluate retrieval (recall at k) and answering separately.
:::

## Exercises

1. Write an answer that cites [4]. What does the checker say?
2. Extend the checker to flag the words "full refund" when no cited source contains "full".
3. Add five Brightwell questions to the golden set, including one the sources cannot answer, and decide what a correct answer looks like for it.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Build a RAG app with Streamlit and Snowflake Cortex](https://www.snowflake.com/en/developers/guides/build-rag-app-with-streamlit-and-snowflake-cortex/) (Snowflake guide)
- [Attach documents to Cortex Agent conversations](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/document-context) (Cortex AI Cookbook)

:::checked Sources and further reading
- [Query a Cortex Search service](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/query-cortex-search-service)
- [AI_COMPLETE](https://docs.snowflake.com/en/sql-reference/functions/ai_complete-single-string)
- [Evaluate applications with TruLens](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-observability/evaluate-applications-trulens): groundedness and context relevance metrics
:::
