---
title: Context and Retrieval on Customer Data: Permissions First, Then Relevance
minutes: 70
group: Building in the customer's environment
lessons: a1106, a1105, a0523
---
:::goals What you will be able to do
- Decide what goes into the model's context for each request, and what must never go in
- Filter retrieved documents by the caller's permissions before ranking them
- Make answers cite the passages they used, so a reviewer can check them in seconds
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Retrieval in an enterprise is an access-control problem before it is a search problem: only documents the user may read can be candidates.
:::

## The problem

Harbor Mutual wants handlers to ask questions such as "does this policy cover water damage from a burst pipe?" and get answers grounded in policy wordings and internal guidance. Some guidance is restricted (fraud indicators, legal matters). A retrieval system that ranks everything and filters afterwards, or worse, lets the model see restricted text and "not mention it", will leak.

## What goes into context

| Put in | Keep out |
|---|---|
| The task instructions and the customer's rules | Other customers' or other users' data |
| The passages needed for this question, with their source IDs | Restricted documents the caller cannot read |
| Structured facts from tools (policy line, status) | Secrets, keys, connection strings |
| One or two examples of a good answer | Whole documents "just in case" |

## Permission-aware retrieval

```python
import re
from collections import Counter
from math import log

DOCS = [
    {"id": "PW-HOME-4.2", "acl": {"handlers", "adjusters"}, "text": "Escape of water from a burst or leaking pipe is covered, excluding gradual seepage over time."},
    {"id": "PW-HOME-4.7", "acl": {"handlers", "adjusters"}, "text": "Damage caused by frost to pipes is covered if the home was heated or drained."},
    {"id": "GUIDE-17",    "acl": {"handlers", "adjusters"}, "text": "For water claims ask for a plumber's report naming the cause of the leak."},
    {"id": "FRAUD-03",    "acl": {"fraud-team"},            "text": "Repeated water claims within twelve months at one address are a fraud indicator."},
]

def tokens(s): return re.findall(r"[a-z]+", s.lower())
N = len(DOCS); df = Counter(t for d in DOCS for t in set(tokens(d["text"])))

def score(q, d):
    tf = Counter(tokens(d["text"]))
    return sum(tf[t] * log((N + 1) / (df[t] + 0.5)) for t in tokens(q) if t in tf)

def retrieve(question, user_groups, k=2):
    visible = [d for d in DOCS if d["acl"] & user_groups]          # 1. permissions first
    ranked = sorted(visible, key=lambda d: -score(question, d))      # 2. then relevance
    return [d for d in ranked[:k] if score(question, d) > 0]

q = "is water damage from a burst pipe covered, and how many water claims at this address"
for groups in ({"handlers"}, {"fraud-team"}):
    print(sorted(groups), "->", [d["id"] for d in retrieve(q, groups)])
```

A handler never sees `FRAUD-03` as a candidate, so no prompt instruction is needed to hide it. In production the same rule applies inside the vector store: pass the user's groups as a filter in the query, not as a post-filter on the top results (post-filtering can leave a user with zero results, or tempt you to raise `k` until restricted documents slip in elsewhere).

## Answers that cite

Pass each retrieved passage with its ID and require citations. Claude's citations feature does this natively when documents are passed as document content blocks; with plain text, ask for `[PW-HOME-4.2]`-style markers and check them in code.

```python
def check_citations(answer, allowed_ids):
    cited = set(re.findall(r"\[([A-Z]+-[A-Z0-9.-]+)\]", answer))
    return {"cited": sorted(cited), "unknown": sorted(cited - allowed_ids), "uncited": not cited}

ctx = retrieve(q, {"handlers"})
answer = "Yes, a burst pipe is covered [PW-HOME-4.2]; gradual seepage is not. Ask for a plumber's report [GUIDE-17]."
print(check_citations(answer, {d["id"] for d in ctx}))
```

`GUIDE-17` is cited but was not in the retrieved context for this question: the model used something it was not given in this request (from an earlier turn, or invented). The check flags it for review.

:::check
Which statements are right?

- ✓ Filtering by the caller's permissions must happen before ranking, inside the retrieval query.
- ✗ It is fine to retrieve restricted passages if the prompt tells the model not to reveal them.
  Anything in context can leak through the answer; restricted text must never be a candidate.
- ✓ A citation to a source that was not in this request's context is a reason to send the answer to review.
:::

:::recap What to keep
- Decide context per request: what goes in, what never does.
- Permissions first, relevance second, in the store's query.
- Require citations and check them against what was actually retrieved.
:::

## Exercises

1. Raise `k` to 3 for the handler query. Which passage enters, and does it help the answer?
2. Add a document visible to adjusters only, and a user who is in both groups. Write a test that proves each user sees exactly what their groups allow.
3. Change the citation check so a citation counts only if the cited passage contains at least two words of the sentence that cites it.

:::checked Sources and further reading
- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations), Claude documentation
- Robertson and Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond", 2009
:::
