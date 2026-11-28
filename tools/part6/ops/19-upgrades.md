---
title: Model Upgrades and Adapters: Migrating to a New Model Version and Serving Fine-Tuned LoRA Adapters
minutes: 60
group: LLMOps in production
lessons: a1728, a1709, a1720
---
:::goals What you will be able to do
- Plan a model migration before the vendor retires the current version
- Decide a migration with paired results by slice, plus cost and latency, rather than a single average
- Explain how fine-tuned LoRA adapters are versioned and served next to a shared base model
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
A new model version is the biggest change an LLM application gets; test it like a new model, slice by slice, and plan it before the old one is retired.
:::

## The problem

Every hosted model has a retirement date. Teams that pin a model (as they should) eventually must move, often under time pressure. Lakeside's assistant runs on a model that is scheduled for deprecation; a newer, cheaper one is available. Is it safe to switch?

## A migration report on the golden set

The golden set (lesson 32.17) is run on both models. Results are **paired**: the same case, two models. That allows a precise comparison and shows where they disagree.

```python
import numpy as np, pandas as pd
r = np.random.default_rng(12)
cases = pd.DataFrame({"case": range(240), "slice": r.choice(["billing", "technical", "cancel", "account", "tariff"], 240, p=[.3, .25, .15, .15, .15])})
p_old = cases.slice.map({"billing": .9, "technical": .82, "cancel": .88, "account": .93, "tariff": .7})
p_new = cases.slice.map({"billing": .93, "technical": .88, "cancel": .8, "account": .94, "tariff": .78})
cases["old_pass"] = r.random(240) < p_old
cases["new_pass"] = r.random(240) < p_new
cases["old_cost"], cases["new_cost"] = r.normal(.0052, .0006, 240), r.normal(.0031, .0004, 240)
cases["old_ms"], cases["new_ms"] = r.lognormal(np.log(2100), .2, 240), r.lognormal(np.log(1700), .2, 240)

def paired_interval(a, b, n=4000, seed=1):
    d = (b.astype(int) - a.astype(int)).to_numpy(); rr = np.random.default_rng(seed)
    boots = [d[rr.integers(0, len(d), len(d))].mean() for _ in range(n)]
    return round(float(d.mean()), 3), np.percentile(boots, [2.5, 97.5]).round(3).tolist()

report = cases.groupby("slice").agg(n=("case", "size"), old=("old_pass", "mean"), new=("new_pass", "mean")).round(2)
report["change"] = (report.new - report.old).round(2)
print(report)
print("overall pass-rate change and 95% interval:", paired_interval(cases.old_pass, cases.new_pass))
print(f"cost per request ${cases.old_cost.mean():.4f} -> ${cases.new_cost.mean():.4f};  p95 {cases.old_ms.quantile(.95):.0f} ms -> {cases.new_ms.quantile(.95):.0f} ms")
print("cases the new model breaks:", int((cases.old_pass & ~cases.new_pass).sum()), "| fixes:", int((~cases.old_pass & cases.new_pass).sum()))
```

Read it slice by slice. The new model is clearly cheaper and faster, but the overall interval spans zero: on quality it is not shown to be better or worse. It gains on tariff and technical questions and drops on billing and cancellations. With 84 and 32 cases those drops may be noise, but they are the customers who matter most for revenue, so read every one of the 24 cases it breaks before deciding. A typical decision: migrate, with a prompt fix for the weak slices verified by the gate, and keep the old model available as a fallback until the retirement date.

## The migration plan

| When | Step |
|---|---|
| On the announcement | Add the new model to the eval matrix; run the golden set; estimate cost |
| Before switching | Fix prompts for weak slices; rerun; shadow traffic for a few days (lesson 32.10) |
| Switch | Canary by percentage; guardrails on thumbs-down, refusals, latency, cost |
| After | Keep the old model ID as a fallback until it is retired; update the release manifest |

## Fine-tuned adapters

Some teams fine-tune an open-weight model for a narrow task. LoRA trains small low-rank matrices instead of all weights, so each fine-tune is a small **adapter** file over a shared base model. Operationally, an adapter is a model version: it needs a registry entry, the base model it was trained for, its training data fingerprint, eval results and an alias. Several adapters can be served from one copy of the base model.

```pyshow
# vLLM serving one base model with LoRA adapters (from the vLLM docs)
#   vllm serve meta-llama/Llama-3.2-3B-Instruct --enable-lora \
#       --lora-modules support-tone=./adapters/support-tone-v3 sql-helper=./adapters/sql-v1 --max-lora-rank 64
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1", api_key="unused")
reply = client.chat.completions.create(model="support-tone",           # the adapter name chosen at start-up
                                       messages=[{"role": "user", "content": email_text}])
```

```python
ADAPTERS = {
    "support-tone": {"v2": {"base": "Llama-3.2-3B-Instruct", "pass_rate": .84}, "v3": {"base": "Llama-3.2-3B-Instruct", "pass_rate": .88}},
}
ALIASES = {"support-tone@production": "v2"}

def can_promote(name, version, serving_base="Llama-3.2-3B-Instruct"):
    a = ADAPTERS[name][version]
    if a["base"] != serving_base: return False, f"trained for {a['base']}, server runs {serving_base}"
    cur = ADAPTERS[name][ALIASES[f"{name}@production"]]
    return (a["pass_rate"] >= cur["pass_rate"], f"pass rate {cur['pass_rate']} -> {a['pass_rate']}")

print(can_promote("support-tone", "v3"))
print(can_promote("support-tone", "v3", serving_base="Llama-3.1-8B-Instruct"))
```

An adapter only works with the base model it was trained on; upgrading the base model means retraining and re-evaluating every adapter. Keep that dependency in the registry so the check is automatic. Set `--max-lora-rank` to the largest rank among your adapters, as the vLLM docs advise, and do not enable runtime adapter loading in production: the docs flag it as a security risk.

:::check
Which statements are right?

- ✓ Paired results on the same golden cases give a sharper comparison than two separate averages.
- ✗ If the new model is better on average, it can be switched in without looking at slices.
  A slice can get worse while the average improves; read the cases it breaks.
- ✓ A LoRA adapter must be re-evaluated when the base model changes.
:::

:::recap What to keep
- Plan migrations from the announcement, not the retirement date.
- Paired results, slices, broken cases, cost and latency; then shadow and canary.
- Adapters are model versions tied to a base model; register that dependency.
:::

## Exercises

1. Raise the `cancel` slice's new pass rate to 0.9 and rerun. What changes in the decision?
2. Compute the monthly saving at 40,000 requests a day, and the number of broken cases you would accept for it.
3. Add `training_data` and `eval_set` fields to the adapter registry, and block promotion if the eval set version is older than the production adapter's.

:::checked Sources and further reading
- [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations), Claude documentation
- [LoRA adapters](https://docs.vllm.ai/en/stable/features/lora/), vLLM documentation
- Hu et al., "LoRA: Low-Rank Adaptation of Large Language Models", ICLR 2022
:::
