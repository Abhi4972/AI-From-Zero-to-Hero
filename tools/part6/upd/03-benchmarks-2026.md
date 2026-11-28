---
title: Reading Agent Benchmarks in Late 2026: Terminal-Bench 4, OSWorld 2, Humanity's Last Exam and Why Scores Need an Audit
minutes: 45
group: 
lessons: a1419, a1420
---
:::goals What you will be able to do
- Name the benchmarks vendors report in late 2026 and what each measures
- Read a leaderboard number with its confidence interval, harness settings and known task defects
- Decide how much weight a public benchmark deserves next to your own evaluation
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 45 minutes.
:::

:::plain The idea in one line
A benchmark score is a measurement made with a particular harness on a particular set of tasks, some of which are broken; treat it like any other measurement and ask about its error before you compare two numbers.
:::

## The problem

A new model page reports Terminal-Bench 4.0, OSWorld 2.1 and Humanity's Last Exam, and no longer mentions SWE-bench. Your manager asks whether the model is "better at agents". The honest answer depends on what those benchmarks measure and how reliable each number is.

## What vendors report now

| Benchmark | Measures | Notes for late 2026 |
|---|---|---|
| Terminal-Bench 4.0 | Long command-line tasks across software, science, ML, operations, security, hardware and media | A "continuous" benchmark with semantic versions; 4.0 removed 8 tasks, fixed about 20 and set a flat 8-hour agent timeout; scores are the mean of five runs with 95% intervals, with token use and cost shown |
| OSWorld 2.x | Computer use on real desktop applications | Successor to the OSWorld covered earlier in this phase |
| Humanity's Last Exam | Hard closed-ended questions across fields | Knowledge and reasoning, not tool use |
| SWE-bench Pro, τ²-bench, GAIA, BrowseComp | Repository fixes; tool use with a simulated user; assistant tasks; hard web research | Still used; SWE-bench Verified is close to saturated for frontier models |
| METR time horizons | Length of task a model completes at 50% reliability | A trend measure rather than a leaderboard |

## Why an audit matters

Epoch AI reviewed Terminal-Bench 4.0.0 in September 2026 and rated it "flawed": about 30 of 66 tasks had publicly noted scoring defects. The examples are the classic ones: a task where a submission can write the success signal before the tests run (reward hacking), tasks where the answer leaks through a filename or a file in the repository, and tasks that mark plausibly correct answers wrong. The review also found harness asymmetries: a maximum-output setting not enabled for one model, and one scaffold retrying safety refusals by default while others did not. The maintainers publish fixes in point releases, which is the benefit of versioning, and also the reason scores from different versions cannot be compared.

None of this makes the benchmark useless. It means a three-point gap between two models may be inside the noise from task defects and harness settings.

## Locally: is the gap real?

```python
import numpy as np
r = np.random.default_rng(11)
TASKS, RUNS = 66, 5
skill_a, skill_b = 0.58, 0.61                               # true success rates on sound tasks
defective = r.random(TASKS) < 0.45                          # tasks with scoring defects
def run(skill):
    p = np.where(defective, 0.5 * skill + 0.25, skill)      # defects pull scores towards chance and add noise
    return (r.random((RUNS, TASKS)) < p).mean(axis=1)       # one score per run

a, b = run(skill_a), run(skill_b)
ci = lambda x: 1.96 * x.std(ddof=1) / np.sqrt(len(x))
print(f"model A: {a.mean():.3f} +/- {ci(a):.3f}    model B: {b.mean():.3f} +/- {ci(b):.3f}    gap {b.mean() - a.mean():+.3f}")

gaps = []
for _ in range(2000):                                        # repeat the whole comparison many times
    defective = r.random(TASKS) < 0.45
    gaps.append(run(skill_b).mean() - run(skill_a).mean())
gaps = np.array(gaps)
print(f"true gap +0.030; measured gap ranges from {np.percentile(gaps, 2.5):+.3f} to {np.percentile(gaps, 97.5):+.3f}; B looks worse in {np.mean(gaps < 0):.0%} of repeats")
```

With 66 tasks, five runs and many defective tasks, a real three-point advantage is measured as anything from a clear loss to a large win, and the better model looks worse in a noticeable share of repeats. Small leaderboard gaps are not evidence.

## How to use public benchmarks

1. Use them to shortlist, not to choose.
2. Read the version, the harness, the number of runs and the interval, and look for an independent review.
3. Compare cost and tokens at the same score, not score alone.
4. Decide with your own task set, scored the way your users would score it (the evaluation lessons of this phase).

:::check
Which statements are right?

- ✓ Scores from different versions of a continuous benchmark should not be compared directly.
- ✗ A two-point lead on a 66-task benchmark shows which model is better for your agent.
  The gap can be inside the noise from run-to-run variation, task defects and harness settings.
- ✓ Harness settings such as retries and output limits can change a model's score.
:::

:::recap What to keep
- Late-2026 model pages cite Terminal-Bench 4, OSWorld 2 and Humanity's Last Exam more than SWE-bench.
- Check version, harness, runs, intervals and independent audits.
- Shortlist with public numbers; decide with your own evaluation.
:::

## Exercises

1. Increase the task count to 500 in the simulation. How much does the measured-gap range shrink?
2. Find one benchmark number in a recent model announcement and list what you cannot tell from the page.
3. Write the three tasks from your own work that no public benchmark covers.

:::checked Sources and further reading
- [Terminal-Bench 4.0](https://www.tbench.ai/news/terminal-bench-4-0), Terminal-Bench maintainers
- [Benchmark review: Terminal-Bench 4](https://epoch.ai/benchmarks/terminal-bench-4/review), Epoch AI, September 2026
- [AI agents in fall 2026: what changed](https://dev.to/10xgraph/ai-agents-in-fall-2026-what-changed-and-how-to-build-for-it-with-10xgraph-2f1b)
:::
