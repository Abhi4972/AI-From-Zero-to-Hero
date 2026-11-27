---
title: Cost, Latency and Capacity: a Per-Transaction Model with Caching, Batching and Routing
minutes: 70
group: Trust: evals, security and cost
lessons: a1111, a1714, a1716
---
:::goals What you will be able to do
- Compute the model cost of one business transaction from token counts and the price list
- Estimate what prompt caching, the Batches API and model routing save, and what they cost in latency or complexity
- Present a monthly cost range the finance team can plan with
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 70 minutes.
:::

:::plain The idea in one line
Price the business transaction, not the token: count what each claim sends and receives, then apply caching, batching and routing where the workflow allows.
:::

## The problem

"How much will it cost?" deserves a number per claim and a monthly range, with the levers shown. The model cost is usually small next to the value, but an unbounded agent or a missing cache can multiply it, and finance teams remember surprises.

## Prices (November 2026)

From the Claude documentation, per million tokens, input / output: Claude Haiku 5.5 from $0.10 / $0.50, Claude Sonnet 5.5 $2 / $10, Claude Opus 5.5 $4 / $20, Claude Fable 5.2 $8 / $40. The Batches API is 50% off input and output. A cache read costs 5% of the base input price on Opus 5.5 and Sonnet 5.5; a 5-minute cache write costs 1.25 times the input price. Prices change: keep them in one table and reload them from the pricing page when you quote.

```python
PRICE = {  # $ per million tokens: input, output, cache read, 5-minute cache write
    "haiku-5.5":  dict(inp=0.10, out=0.50, cr=0.01, cw=0.125),
    "sonnet-5.5": dict(inp=2.0,  out=10.0, cr=0.10, cw=2.50),
    "opus-5.5":   dict(inp=4.0,  out=20.0, cr=0.20, cw=5.00),
}
# Haiku's cache prices here assume the default 10% read rate; check the pricing page for each model.

def step_cost(model, inp, out, cached=0, cache_hit=0.0, batch=False):
    p = PRICE[model]
    fresh = inp - cached
    cost = (fresh * p["inp"] + cached * (cache_hit * p["cr"] + (1 - cache_hit) * p["cw"]) + out * p["out"]) / 1e6
    return cost * (0.5 if batch else 1.0)

# One Harbor claim: triage (small), extraction (main), document-request draft (main)
STEPS = [("triage", 1500, 60, 1200), ("extract", 9000, 700, 4000), ("draft request", 3000, 250, 2000)]

def claim_cost(models, cache_hit=0.0, batch=False):
    return sum(step_cost(models[name], inp, out, cached, cache_hit, batch) for name, inp, out, cached in STEPS)

scenarios = {
    "all Opus, no cache, live":         (dict(triage="opus-5.5", extract="opus-5.5", **{"draft request": "opus-5.5"}), 0.0, False),
    "all Sonnet, cache 90%, live":      (dict(triage="sonnet-5.5", extract="sonnet-5.5", **{"draft request": "sonnet-5.5"}), 0.9, False),
    "routed + cache 90% + batch":       (dict(triage="haiku-5.5", extract="sonnet-5.5", **{"draft request": "sonnet-5.5"}), 0.9, True),
}
for name, (models, hit, batch) in scenarios.items():
    c = claim_cost(models, hit, batch)
    print(f"{name:32} ${c:.4f} per claim   ${c * 400 * 21:,.0f} per month at 400 claims a day")
```

The token counts in `STEPS` are estimates until the prototype runs; replace them with the medians from your traces (lesson 31.8 records `usage` per call).

## What each lever costs you

| Lever | Saves | Costs | Use when |
|---|---|---|---|
| Prompt caching | Most of the repeated prefix (instructions, wordings, examples) | Prompts must put stable content first; cache expires after its lifetime | The same long prefix serves many requests |
| Batches API | Half the price | Results arrive within 24 hours, not seconds | Nobody waits for the answer (overnight intake, backfills, evals) |
| Model routing | The gap between tiers on easy steps | A router to build and evaluate; one more thing to monitor | Steps differ clearly in difficulty |
| Shorter outputs | Output tokens, which cost several times input | Prompt and schema work | Outputs are verbose or include reasoning nobody reads |

## Capacity and latency

Intake at 400 claims a day is modest, but it arrives in bursts after weekends and storms. Check the account's rate limits against the peak hour, not the average, and decide what happens at the limit: queue and process later (fine for batch intake), or degrade (skip the document-request draft and let handlers write it).

```python
peak_share = 0.18                    # share of a day's claims in the busiest hour after a storm
claims_peak_hour = 400 * 3 * peak_share     # a storm triples the day's volume
tokens_per_claim = sum(i + o for _, i, o, _ in STEPS)
print(f"peak: {claims_peak_hour:.0f} claims/hour, about {claims_peak_hour * tokens_per_claim / 60:,.0f} tokens/minute")
```

:::check
Which statements are right?

- ✓ The Batches API halves the price when results can wait.
- ✗ Caching saves money even when every request has a different prefix.
  Caching pays only for repeated prefixes; put stable content first so it can be reused.
- ✓ Capacity should be checked against the peak hour, not the daily average.
:::

:::recap What to keep
- Price per business transaction, from measured token counts.
- Caching, batching, routing and shorter outputs; each has a cost.
- Plan for the peak hour and decide behaviour at the limit.
:::

## Exercises

1. Add a scenario that routes extraction to Opus 5.5 only for scanned PDFs (15% of claims). What is the blended cost per claim?
2. Change the cache hit rate to 50% (prompts edited often during the pilot). How much does the routed scenario's cost change?
3. Write the two-sentence cost statement you would put in the sponsor readout, with a range rather than a point.

:::checked Sources and further reading
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), Claude documentation
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), Claude documentation
- [Claude Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview): model comparison and batch and cache rates
:::
