---
title: Evaluating and Observing AI Apps on Snowflake: TruLens Runs, Agent Traces and Feedback
minutes: 65
group: Quality, ML and serving
lessons: a3113, a3217, a3218
---
:::goals What you will be able to do
- Run a batch evaluation of a RAG app or agent with AI Observability (TruLens) and its LLM-judge metrics
- Read agent traces and end-user feedback from the AI Observability event table
- Turn traces into weekly quality, latency and token reports, and into new golden cases
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
:::

:::plain The idea in one line
Evaluate before release with a golden set and judges; observe after release with traces and feedback; and feed what you observe back into the golden set.
:::

## The problem

Brightwell's returns agent is live. Is it right? The MLOps and LLMOps phase taught the general method (golden sets, calibrated judges, monitoring, lessons 32.15 to 32.19); this lesson shows where those pieces live in Snowflake.

## Before release: an evaluation run

AI Observability runs TruLens evaluations in Snowflake. You instrument your app, register it, create a run over a dataset, invoke it, and compute metrics: `answer_relevance`, `context_relevance`, `groundedness`, `correctness` (needs a ground-truth answer) and `coherence`. Results appear in Snowsight under **AI & ML » Evaluations**.

```pyshow
# instrumentation maps function inputs and outputs to span attributes the judges read
@instrument(span_type=SpanAttributes.SpanType.RETRIEVAL,
            attributes={SpanAttributes.RETRIEVAL.QUERY_TEXT: "query", SpanAttributes.RETRIEVAL.RETRIEVED_CONTEXTS: "return"})
def retrieve_context(self, query: str) -> list: ...

run = tru_app.add_run(run_config=RunConfig(
    run_name="returns-v2", label="returns-agent", source_type="TABLE", dataset_name="SUPPORT.EVAL.GOLDEN_V3",
    dataset_spec={"RETRIEVAL.QUERY_TEXT": "QUESTION", "RECORD_ROOT.INPUT": "QUESTION", "RECORD_ROOT.GROUND_TRUTH_OUTPUT": "ANSWER"}))
run.start()                                    # invokes the app on every row
run.compute_metrics(metrics=["context_relevance", "groundedness", "answer_relevance", "correctness"])
```

The judges are LLMs; calibrate them against human labels before trusting them as a gate (lesson 32.17), and compare runs only on the same dataset version.

## After release: traces and feedback

Agent telemetry lands in the `SNOWFLAKE.LOCAL.AI_OBSERVABILITY_EVENTS` event table: one trace per turn, with spans for planning, each tool call (Search, Analyst, MCP), SQL execution, chart generation and the response. End-user feedback is stored as `CORTEX_AGENT_FEEDBACK` events. Reading full inputs and outputs needs the account privilege `READ UNREDACTED AI OBSERVABILITY EVENTS TABLE`; without it, roles see metadata only. That is a privacy control worth keeping narrow.

```sql
SELECT *
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('SUPPORT', 'AGENTS', 'RETURNS_ASSISTANT', 'CORTEX AGENT'))
WHERE RECORD:name = 'CORTEX_AGENT_FEEDBACK';
```

## Locally: a weekly report from traces

```python
import numpy as np, pandas as pd
r = np.random.default_rng(14)
n = 1200
traces = pd.DataFrame({
    "trace_id": range(n),
    "week": r.choice([46, 47], n),
    "tools": r.choice(["search", "analyst", "search+analyst", "order_status+search"], n, p=[.45, .3, .15, .1]),
    "latency_s": np.round(r.lognormal(np.log(6), .45, n), 1),
    "tokens": r.normal(5200, 1400, n).clip(800).astype(int),
    "feedback": r.choice(["none", "up", "down"], n, p=[.8, .17, .03]),
})
# week 47: a semantic view change slowed Analyst and caused more thumbs-down on analyst questions
slow = (traces.week == 47) & traces.tools.str.contains("analyst")
traces.loc[slow, "latency_s"] = (traces.loc[slow, "latency_s"] * 1.8).round(1)
traces.loc[slow & (r.random(n) < .12), "feedback"] = "down"

def weekly(t):
    g = t.groupby(["week", "tools"])
    rep = g.agg(turns=("trace_id", "size"), p50_s=("latency_s", "median"), p95_s=("latency_s", lambda s: s.quantile(.95)),
                tokens=("tokens", "mean"), down=("feedback", lambda s: (s == "down").sum()), votes=("feedback", lambda s: (s != "none").sum()))
    rep["down_rate"] = (rep.down / rep.votes.where(rep.votes > 0)).round(2)
    return rep.drop(columns="down").round({"p50_s": 1, "p95_s": 1, "tokens": 0})
weekly(traces)
```

Week 47 shows Analyst turns roughly twice as slow at p95 and a much higher thumbs-down share on turns that use Analyst, while Search-only turns are no worse. That points at the semantic view change, not the model. Vote counts per group are small, so treat the rates as a signal to investigate, not as proof. The next steps are the loop from lesson 32.17: pull the thumbs-down traces, label them, add the failures to the golden set, fix the semantic view, and re-run the evaluation before releasing again.

```python
golden_candidates = traces[(traces.feedback == "down") & (traces.week == 47)].groupby("tools").head(5)
print(len(golden_candidates), "traces queued for labelling; by tool path:", golden_candidates.tools.value_counts().to_dict())
```

:::check
Which statements are right?

- ✓ Agent traces in the AI Observability event table show which tools ran and how long each step took.
- ✗ Any role that can monitor an agent can read full conversation text.
  Full inputs, outputs and feedback text need the READ UNREDACTED AI OBSERVABILITY EVENTS TABLE privilege.
- ✓ Thumbs-down traces are good candidates for new golden-set cases.
:::

:::recap What to keep
- Before release: TruLens runs with relevance, groundedness and correctness judges.
- After release: traces, feedback and weekly reports by tool path.
- Close the loop: failures become golden cases; re-evaluate before the next release.
:::

## Exercises

1. Add a "turns per thread" metric. What would a rising value suggest?
2. Write the SQL that counts thumbs-down feedback per day for the last 30 days.
3. Decide which role should hold the unredacted-events privilege at Brightwell, and why not the agent's developers by default.

:::checked Sources and further reading
- [Evaluate applications with TruLens](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-observability/evaluate-applications-trulens)
- [Monitor Cortex Agent requests](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-monitor)
- [AI Observability reference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-observability/reference)
:::
