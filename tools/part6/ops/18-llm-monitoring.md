---
title: Monitoring LLM Applications: Quality Signals, Safety, Cost, Latency and Topic Drift
minutes: 60
group: LLMOps in production
lessons: a1713, a1727, a1112
---
:::goals What you will be able to do
- Choose the online signals that stand in for quality when there are no labels
- Build weekly monitors for quality, safety, cost and latency from request logs
- Detect a shift in what users ask about, and connect it to the golden set
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
You rarely know whether an LLM answer was right, so watch the signals that move when it is not, and watch what people are asking, because that is what drifts.
:::

## The problem

Lesson 32.11 monitored a model whose labels arrive in six weeks. An LLM reply has no label at all unless someone reviews it. Lakeside needs signals available on every request, and alerts that point at a cause.

| Signal | What it suggests | Caveat |
|---|---|---|
| Thumbs-down rate | Users dislike replies | Few users vote; voters are unhappy more often |
| Edit distance of agent edits | Drafts need rework | Only where a person edits before sending |
| Escalation or reopen rate | The reply did not solve it | Lagging by days |
| Guardrail flag rate | Policy risk in inputs or outputs | Depends on filter versions |
| Refusal rate | Over-cautious prompts or model change | Some refusals are right |
| Cost per request, tokens | Prompt or retrieval growth | Moves with traffic mix |
| p95 latency | Slow model, long outputs, tool timeouts | Vendor-side variance |
| Topic mix | Users ask about new things | Needs a topic classifier |

## Six weeks of request logs

```python
import numpy as np, pandas as pd
r = np.random.default_rng(8)
TOPICS = ["billing", "technical", "cancel", "account", "other"]
rows = []
for week in range(1, 7):
    n = 4000
    p_topics = [.35, .3, .1, .15, .1] if week < 5 else [.25, .25, .1, .15, .25]     # week 5: a new tariff launch
    topic = r.choice(TOPICS, n, p=p_topics)
    new_tariff = (topic == "other") & (week >= 5)
    prompt_tokens = r.normal(1800 if week < 4 else 2600, 150, n)                    # week 4: a longer prompt shipped
    out_tokens = r.normal(220, 40, n)
    rows.append(pd.DataFrame({
        "week": week, "topic": topic,
        "thumbs_down": r.random(n) < np.where(new_tariff, .14, .04),
        "edited_chars": r.gamma(2, np.where(new_tariff, 60, 25)),
        "guardrail_flag": r.random(n) < .01, "refused": r.random(n) < .02,
        "cost_usd": (prompt_tokens * 2 + out_tokens * 10) / 1e6,      # $2 / $10 per million tokens, as in Sonnet 5.5's list price
        "latency_ms": r.lognormal(np.log(1900), .25, n) + (out_tokens - 220) * 8,
    }))
logs = pd.concat(rows)
print(len(logs), "requests logged")
```

## The weekly report

```python
weekly = logs.groupby("week").agg(
    requests=("topic", "size"), thumbs_down=("thumbs_down", "mean"), edited_chars=("edited_chars", "median"),
    guardrail=("guardrail_flag", "mean"), refusals=("refused", "mean"),
    cost_per_1k=("cost_usd", lambda s: s.mean() * 1000), p95_ms=("latency_ms", lambda s: s.quantile(.95)))
weekly.round(3)
```

Two changes stand out. Cost per thousand requests jumps in week 4 with no change in quality: the longer prompt shipped. Thumbs-down and edit lengths rise in week 5. The weekly numbers alone do not say why.

## Topic drift explains the quality drop

```python
def psi_categorical(ref, cur, eps=1e-4):
    cats = sorted(set(ref) | set(cur))
    p = np.array([(ref == c).mean() for c in cats]) + eps; q = np.array([(cur == c).mean() for c in cats]) + eps
    return float(np.sum((q - p) * np.log(q / p)))

ref = logs[logs.week <= 2].topic.to_numpy()
for w in range(3, 7):
    cur = logs[logs.week == w]
    td = cur.groupby("topic").thumbs_down.mean().round(3).to_dict()
    print(f"week {w}: topic PSI {psi_categorical(ref, cur.topic.to_numpy()):.3f}   thumbs-down by topic {td}")
```

From week 5 the share of "other" questions jumps (customers asking about the new tariff), and that topic carries most of the thumbs-downs. The knowledge base and golden set do not cover the tariff. The action is not "retrain"; it is: add the tariff documents to the index, add tariff cases to the golden set (lesson 32.17), and release through the gate.

## Alerts

```python
BASE = weekly.loc[[1, 2]].mean()
RULES = [("thumbs_down", 1.5, "quality: check topic mix and recent releases"),
         ("cost_per_1k", 1.25, "cost: compare prompt and output tokens with the last release manifest"),
         ("p95_ms", 1.3, "latency: check output length, tool timeouts and vendor status"),
         ("refusals", 2.0, "refusals: check prompt or model changes")]
for w, row in weekly.iterrows():
    for metric, ratio, action in RULES:
        if row[metric] > BASE[metric] * ratio:
            print(f"week {w}: {metric} {row[metric]:.3f} vs baseline {BASE[metric]:.3f} -> {action}")
```

Each alert names its first check. In production these rules run on a dashboard tool (Phase 17 compares observability stacks), with the release manifest and prompt version recorded on every trace so a jump can be matched to the release that caused it.

:::check
Which statements are right?

- ✓ Thumbs-down and edit distance are proxies for quality when there are no labels.
- ✗ A rise in thumbs-down always means the prompt got worse.
  Here the cause was a shift in what customers asked about.
- ✓ Recording the release and prompt version on every trace lets a metric jump be tied to a release.
:::

:::recap What to keep
- Proxies for quality, plus safety, cost and latency, from every request.
- Topic mix is the LLM equivalent of input drift.
- Alerts name a first check; fixes often mean new documents and golden cases, not a new model.
:::

## Exercises

1. Add a per-topic cost breakdown. Which topic got most expensive after week 4, and why might that be?
2. Make the thumbs-down alert require at least 200 votes in the week before firing.
3. Write the incident note for week 5: what happened, impact, cause, fix, and the golden-set cases added.

:::checked Sources and further reading
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), Claude documentation
- [OpenTelemetry semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
:::
