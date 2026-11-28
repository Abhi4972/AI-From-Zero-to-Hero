---
title: LLMOps: What Changes When the Model Is an API, and the Release Manifest That Tames It
minutes: 55
group: LLMOps in production
lessons: a1110, a1713, a1719
---
:::goals What you will be able to do
- List the artifacts that define an LLM application's behaviour and version them together
- Write a release manifest and diff two releases to decide which checks must run
- Explain how vendor model updates, non-determinism and per-request cost change operations
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 55 minutes.
:::

:::plain The idea in one line
An LLM application's behaviour is set by many small artifacts (prompts, model ID, settings, retrieval index, tools, guardrails); release them together as one versioned manifest, and test according to what changed.
:::

## The problem

Lakeside's support assistant drafts replies to customer emails. In one week, four people changed it: a product manager edited the system prompt, an engineer switched to a newer model version, the knowledge base was re-indexed after a policy update, and someone raised the temperature "to sound friendlier". Replies got worse. Nobody could say which change did it, because none of them was a "deployment".

## What defines behaviour

| Artifact | Example | Changes how often |
|---|---|---|
| Model identifier | `claude-sonnet-5-5` | When the vendor releases or retires models |
| Generation settings | temperature, max tokens, effort | Occasionally |
| Prompts | system prompt, templates, few-shot examples | Often |
| Retrieval | index version, embedding model, chunking, top-k | Whenever documents change |
| Tools | tool names, schemas, descriptions | With features |
| Guardrails | input and output filters, redaction rules | With incidents and policy |
| Eval set | golden cases and graders | Grows over time |

In classic ML, the weights are the artifact. In an LLM application the weights belong to someone else and these artifacts are the "model". So they get the same treatment: version control, review, testing and staged release.

## The release manifest

```python
import json
REL_41 = {
    "release": "support-assistant 41",
    "model": "claude-sonnet-5-5", "settings": {"temperature": 0.2, "max_tokens": 800},
    "prompts": {"system": "support-system@7", "reply_template": "reply@3"},
    "retrieval": {"index": "kb-2026-11-10", "embedder": "embed-v3", "chunking": "400/50", "top_k": 6},
    "tools": {"get_account": "v2", "create_ticket": "v1"},
    "guardrails": {"pii_redaction": "v4", "output_policy": "v2"},
    "eval_set": "support-golden@12",
}
REL_42 = json.loads(json.dumps(REL_41))
REL_42.update({"release": "support-assistant 42"})
REL_42["prompts"]["system"] = "support-system@8"
REL_42["retrieval"]["index"] = "kb-2026-11-24"
REL_42["settings"]["temperature"] = 0.7

def diff(a, b, path=""):
    out = []
    for k in sorted(set(a) | set(b)):
        p = f"{path}.{k}" if path else k
        if isinstance(a.get(k), dict) and isinstance(b.get(k), dict): out += diff(a[k], b[k], p)
        elif a.get(k) != b.get(k) and k != "release": out.append((p, a.get(k), b.get(k)))
    return out

changes = diff(REL_41, REL_42)
for c in changes: print(c)
```

## What changed decides what to test

```python
REQUIRED = {   # artifact prefix -> checks that must pass before release
    "model":      ["full golden set", "slices", "cost and latency benchmark", "safety set", "shadow traffic 48h"],
    "settings":   ["full golden set", "consistency check (5 samples per case)"],
    "prompts":    ["full golden set", "slices", "safety set"],
    "retrieval":  ["retrieval recall@k", "citation check", "golden set questions about changed documents"],
    "tools":      ["tool-call accuracy set", "argument schema tests"],
    "guardrails": ["red-team set", "false-positive set"],
}

def plan(changes):
    checks = []
    for path, _, _ in changes:
        for c in REQUIRED[path.split(".")[0]]:
            if c not in checks: checks.append(c)
    return checks

print("release 42 must pass:"); [print("  -", c) for c in plan(changes)]
print("\nthree changes in one release: if quality drops, which one did it?")
```

Three changes in one release make a regression hard to attribute. The usual rule: change one artifact per release unless the changes are coupled (a new tool and the prompt that explains it). The manifest makes that rule checkable.

## Three operational differences from classic ML

**The vendor changes the model.** Model versions are retired on a published schedule, and a pinned model identifier is the only protection from silent changes. Treat a model upgrade as a release with the heaviest test plan (lesson 32.19).

**Outputs vary.** At temperature above zero the same input gives different outputs, and even at zero small variations can occur. Evaluate with several samples per case where consistency matters, and compare releases on many cases rather than reading single outputs.

**Every request costs money.** Cost per request is an operational metric next to latency and errors. Prompt length, retrieval top-k and output length are cost levers; a prompt edit that adds 2,000 tokens is a cost change and should show up in review (Phase 17 covers caching, batching and routing).

:::check
Which statements are right?

- ✓ Prompts, model ID, retrieval index and tool schemas should be versioned and released together.
- ✗ Changing the temperature is a minor setting that does not need testing.
  It changes output variability; run the golden set and a consistency check.
- ✓ Changing several artifacts in one release makes it hard to tell which caused a regression.
:::

:::recap What to keep
- The behaviour of an LLM app lives in many artifacts; put them in one manifest.
- Diff manifests; the diff decides the test plan.
- Pin model IDs, sample more than once, and treat cost as a metric.
:::

## Exercises

1. Add a `max_tokens` change to release 42. Which checks does the plan add?
2. Make the planner reject a release that changes more than one top-level artifact unless it carries a `coupled` note.
3. Write the manifest for an LLM application you know. Which artifact is not under version control today?

:::checked Sources and further reading
- [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations), Claude documentation: retirement schedule for model versions
- [Define success criteria and build evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), Claude documentation
:::
