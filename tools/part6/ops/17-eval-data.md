---
title: Evaluation Data from Production: Trace Sampling, Labelling Queues and Calibrated Judges
minutes: 65
group: LLMOps in production
lessons: a1110, a1320, a3113
---
:::goals What you will be able to do
- Sample production traces for review so that rare failures are not drowned out by easy cases
- Grow a versioned golden set from reviewed traces
- Calibrate a model-based judge against human labels with Cohen's kappa before trusting it
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
:::

:::plain The idea in one line
Production traffic is the best source of test cases: sample it cleverly, have people label it, keep the best cases forever, and only let a model grade when it agrees with people.
:::

## The problem

Lakeside's golden set was written before launch from what the team imagined customers would ask. Three months in, customers ask about things nobody imagined, and the golden set no longer predicts how releases will do. The fix is a loop: traces in, review, golden set out.

## Sampling traces for review

Uniform sampling mostly picks easy cases. Stratify by slice and over-sample signals of trouble: a thumbs-down, a long conversation, a guardrail flag, a low retrieval score.

```python
import numpy as np, pandas as pd
r = np.random.default_rng(5)
N = 20000
traces = pd.DataFrame({
    "trace_id": np.arange(N),
    "topic": r.choice(["billing", "technical", "cancel", "account", "other"], N, p=[.35, .3, .1, .15, .1]),
    "thumbs_down": r.random(N) < .04,
    "guardrail_flag": r.random(N) < .01,
    "turns": r.poisson(2, N) + 1,
})
traces["bad"] = (r.random(N) < np.where(traces.thumbs_down, .55, .06)) | (traces.guardrail_flag & (r.random(N) < .5))

def sample(traces, k=300, seed=1):
    t = traces.assign(weight=1 + 8 * traces.thumbs_down + 8 * traces.guardrail_flag + 2 * (traces.turns > 4))
    parts = []
    for topic, g in t.groupby("topic"):                         # equal share per topic, weighted inside each
        parts.append(g.sample(n=k // t.topic.nunique(), weights="weight", random_state=seed))
    return pd.concat(parts)

uniform = traces.sample(300, random_state=1)
smart = sample(traces)
print(f"bad cases found: uniform {uniform.bad.sum()} of 300, stratified and weighted {smart.bad.sum()} of 300")
print("topic mix in the review queue:", smart.topic.value_counts().to_dict())
```

The weighted sample finds several times more failures for the same reviewing effort and gives rare topics such as cancellations a fair share. Its failure rate is not the production failure rate, though: to estimate that, use the uniform sample or re-weight.

## From reviewed traces to a golden set

```python
reviewed = smart.assign(label=np.where(smart.bad, "fail", "pass"),
                        reason=np.where(smart.bad, r.choice(["wrong policy", "asked for sensitive data", "missed the question", "tone"], len(smart)), ""))
GOLDEN = {"version": 12, "cases": 180}

def grow(golden, reviewed, per_reason=5, pass_cases=20):
    fails = reviewed[reviewed.label == "fail"]
    new = pd.concat([fails.groupby("reason").head(per_reason), reviewed[reviewed.label == "pass"].head(pass_cases)])
    return {"version": golden["version"] + 1, "cases": golden["cases"] + len(new), "added_by_reason": new.reason.replace("", "pass").value_counts().to_dict()}

print(grow(GOLDEN, reviewed))
```

Keep a few passing cases too, so the set does not become a museum of failures that any change seems to "improve". Freeze each version; scores are only comparable on the same version.

## Calibrating a model judge

People cannot label every release. A model judge (an LLM grading replies against a rubric) can, if it agrees with people. Measure agreement on a sample both have labelled, with Cohen's kappa, which corrects for agreement by chance.

```python
def cohen_kappa(a, b):
    a, b = np.asarray(a), np.asarray(b)
    po = (a == b).mean()
    pe = sum((a == c).mean() * (b == c).mean() for c in np.union1d(a, b))
    return (po - pe) / (1 - pe)

human = (r.random(200) < .3).astype(int)                   # 1 = fail, from two human reviewers who agreed
judge_lenient = np.where(human == 1, r.random(200) < .55, r.random(200) < .03).astype(int)   # misses many failures
judge_tuned = np.where(human == 1, r.random(200) < .9, r.random(200) < .06).astype(int)      # after rubric fixes

for name, j in [("judge v1", judge_lenient), ("judge v2", judge_tuned)]:
    rec = (j[human == 1] == 1).mean()
    print(f"{name}: raw agreement {(j == human).mean():.2f}, kappa {cohen_kappa(human, j):.2f}, catches {rec:.0%} of human-labelled failures")
```

Raw agreement flatters the lenient judge because most replies pass. Its kappa of 0.62 even clears a common rule-of-thumb bar, yet it catches only about half of the failures people found. That is why the bar has two parts: kappa of about 0.6 or more **and** high recall on the failure class, before the judge gates releases, with a fresh human sample each month to check it has not drifted.

:::check
Which statements are right?

- ✓ Over-sampling thumbs-down and guardrail-flagged traces finds more failures per reviewed case.
- ✗ The failure rate in a weighted review sample estimates the production failure rate.
  Weighting changes the mix; use a uniform sample or re-weight to estimate rates.
- ✓ Cohen's kappa corrects agreement for chance, which matters when most cases pass.
:::

:::recap What to keep
- Stratify by topic and over-sample trouble signals.
- Grow the golden set by reason, keep some passes, freeze versions.
- Trust a judge only after kappa and failure recall against humans; re-check monthly.
:::

## Exercises

1. Re-weight the smart sample to estimate the production failure rate, and compare with the uniform sample.
2. Add "language" as a slice and make the sampler give non-English traffic at least 10% of the queue.
3. Write the rubric for judge v2 with three criteria and one example of a fail for each.

:::checked Sources and further reading
- [Define success criteria and build evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), Claude documentation: grading with models and calibrating against humans
- Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023
- Cohen, "A Coefficient of Agreement for Nominal Scales", 1960
:::
