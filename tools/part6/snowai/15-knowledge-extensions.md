---
title: Cortex Knowledge Extensions, AI-Ready Listings, Agents for Shared Data and Agentic Marketplace Discovery
minutes: 50
group: Retrieval: Cortex Search and RAG
lessons: a3312, a3313
---
:::goals What you will be able to do
- Publish a Cortex Search service as a Cortex Knowledge Extension (CKE) with attribution and content protection, and use one from an agent
- Make a data listing AI-ready, so consumers get semantic views and agents with the data
- Explain who pays for what when knowledge crosses accounts
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 50 minutes.
:::

:::plain The idea in one line
Knowledge can be shared like data: a provider shares a search service instead of the documents, consumers' agents query it with citations, and the provider decides how much of the corpus can be retrieved per day.
:::

## The problem

Brightwell's suppliers publish care and warranty manuals as PDFs that go stale in Brightwell's stage. A supplier offers to share the manuals through Snowflake, but does not want Brightwell, or anyone, to be able to download the whole corpus.

## Cortex Knowledge Extensions

A CKE is a Cortex Search service shared through a listing (Marketplace, private or organizational). The provider indexes text in a table, creates the service, and points a listing at it; consumers add it to Cortex Agents, AI applications or CoWork like their own search service, and answers carry citations.

| Concern | How it works |
|---|---|
| Attribution | Index a `SOURCE_URL` column so agents and CoWork can link back to the source |
| Content protection | Set in the listing manifest (`cke_content_protection`): a cap on the share of the corpus a consumer can retrieve in a rolling 24 hours; beyond it queries fail until the window refreshes |
| Regions | Consumers can only use a CKE in their region, so enable auto-fulfillment to replicate it |
| Availability | Keep indexing active; check with `DESCRIBE CORTEX SEARCH SERVICE`, resume with `ALTER CORTEX SEARCH SERVICE ... RESUME INDEXING`; disabling serving breaks consumers |
| Billing | Provider pays hosting, indexing, serving and replication; consumer pays the listing price (if any) and their own agent's usage; usage-based listing billing is not supported for CKEs |
| Monitoring | Query counts in Provider Studio; document-level access history for providers |
| Side effect | Adding a CKE to a listing turns off Egress Cost Optimizer for that listing or its replication group |

## AI-ready listings and agents for shared data

The same idea extends to structured data shared through listings:

- **AI-ready listings**: providers include semantic views (and optionally agents) with the data, so consumers can ask questions on day one instead of reverse-engineering the schema.
- **Agents for Shared Data** (public preview, announced at Expedition 2026): Snowflake generates a Cortex Agent and semantic view over shared data for the recipient.
- **AI Data Package** (public preview): 60+ curated external datasets with semantic views and a ready-to-use CoWork agent.
- **Agentic Marketplace Discovery** (public preview from 9 October 2026): find and compare Marketplace data, apps and AI products by conversation with CoCo, and start trials or installs where supported.

Treat shared definitions like any third-party code: read the semantic view before letting an agent answer from it, and check that its metrics mean what your business means (lesson 33.16).

## Locally: the content-protection window

```python
from collections import deque

class ProtectedCKE:
    """Rolling-window cap on the share of a corpus one consumer can retrieve, as a CKE provider can set."""
    def __init__(self, corpus_chunks, max_share=0.05, window_hours=24):
        self.n, self.max_share, self.window = corpus_chunks, max_share, window_hours
        self.served = {}      # consumer -> deque of (hour, chunk_id)

    def query(self, consumer, hour, chunk_ids):
        log = self.served.setdefault(consumer, deque())
        while log and log[0][0] <= hour - self.window: log.popleft()          # drop retrievals older than the window
        distinct = {c for _, c in log}
        if len(distinct | set(chunk_ids)) > self.max_share * self.n:
            return "BLOCKED: content protection threshold reached, try again later"
        log.extend((hour, c) for c in chunk_ids)
        return f"ok ({len(distinct | set(chunk_ids))} distinct chunks in window)"

cke = ProtectedCKE(corpus_chunks=2000, max_share=0.05)
print("normal agent :", [cke.query("brightwell", h, [h % 40, (h * 7) % 40]) for h in range(0, 48, 12)])
scraper = [cke.query("scraper", h, list(range(h * 30, h * 30 + 30))) for h in range(6)]
print("scraper      :", scraper)
print("next day     :", cke.query("scraper", 30, [1999]))
```

The normal agent keeps re-reading the same few chunks and never approaches the cap; the scraper walking the corpus is blocked on its fourth call, and the window lets it back in the next day. The cap protects the corpus as a whole, not individual documents, so a provider still prices the listing for what one window can reveal.

:::check
Which statements are right?

- ✓ A CKE shares a search service, so consumers get retrieved passages with citations rather than the source table.
- ✗ Consumers pay per query to the provider through usage-based listing billing.
  Usage-based billing is not supported for CKEs; consumers pay the listing price and their own compute.
- ✓ Content protection caps the share of the corpus retrievable in a rolling 24-hour window.
:::

:::recap What to keep
- CKE = shared Cortex Search service: attribution via `SOURCE_URL`, content protection in the manifest, replicate to consumer regions.
- AI-ready listings ship semantic views and agents with data; review them like code.
- Providers pay to host and replicate; consumers pay the listing and their own agents.
:::

## Exercises

1. Set `max_share` so a consumer can read at most 200 distinct pages a day of a 10,000-page corpus.
2. List what Brightwell must check in a supplier's semantic view before its agent may use it.
3. A consumer's agent cites a manual that the supplier has since withdrawn. Whose process failed, and what should change?

:::checked Sources and further reading
- [Cortex Knowledge Extensions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-knowledge-extensions/cke-overview)
- [Make your listing AI-ready](https://docs.snowflake.com/collaboration/provider-listings-ai-ready)
- [Build faster, work smarter with AI agents and apps grounded in data](https://www.snowflake.com/en/blog/ai-agents-governed-data-business-context/), Snowflake blog, November 2026
:::
