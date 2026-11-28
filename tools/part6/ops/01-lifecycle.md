---
title: MLOps and LLMOps: the Production Lifecycle, Maturity Levels and Where Teams Get Stuck
minutes: 50
group: Foundations: lifecycle, reproducibility and tracking
lessons: a0219, a0220, a1713
---
:::goals What you will be able to do
- Describe the production lifecycle of a model, from data to retirement, and who owns each stage
- Place a team on the MLOps maturity levels (manual, pipeline automation, CI/CD automation) and pick the next step
- Explain what LLMOps adds to MLOps and what stays the same
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 50 minutes.
- **Tools**: the lessons in this phase use pandas, scikit-learn and, from lesson 32.3, MLflow (`pip install mlflow`). Everything runs on a laptop; no GPU and no model training beyond small scikit-learn models.
:::

:::plain The idea in one line
A model in a notebook is an experiment; a model in production is a system that has to be rebuilt, tested, released, watched and retrained, and MLOps is the set of habits and tools that make that routine.
:::

## The problem

Most models that fail in production do not fail because the algorithm was wrong. They fail because nobody can rebuild them, nobody notices when the data changes, a "quick fix" bypasses the tests, or the person who trained the model has moved on. Google's paper on hidden technical debt in ML systems made the point with a picture: the model code is a small box in the middle of a much larger system of data collection, validation, features, serving, monitoring and configuration.

This phase follows one fictional company, **Lakeside Telecom**, through that whole system. It has a classic ML model (predicting which customers will cancel, called churn) and an LLM application (drafting replies to support emails). By the capstone you will have taken both from a notebook to a monitored, retrainable, governed service.

## The lifecycle

| Stage | What happens | Typical owner | Lesson |
|---|---|---|---|
| Data | Collect, validate, version | Data engineering | 32.2, 32.5 |
| Features | Transform with point-in-time correctness, share between training and serving | Data or ML engineering | 32.6 |
| Train and track | Run experiments, record everything | Data science | 32.3 |
| Register and approve | Version the model, attach evidence, approve | ML engineering, risk | 32.4, 32.13 |
| Test and release | CI tests, packaging, shadow and canary releases | ML engineering | 32.8 to 32.10 |
| Serve | Batch or online, with input validation | Platform | 32.9 |
| Monitor | Data drift, prediction drift, performance with delayed labels | ML engineering, on-call | 32.11 |
| Retrain or retire | Triggers, champion and challenger, decommission | ML engineering, owner | 32.12 |

## Maturity levels

Google Cloud's MLOps guide describes three levels. They are a useful map, not a grade to chase: many valuable models live happily at level 1.

| Level | Name | What it looks like | Typical pain |
|---|---|---|---|
| 0 | Manual | Notebooks and scripts; a model file is handed to engineers; releases a few times a year; no monitoring | Training-serving skew, silent decay, nobody can retrain |
| 1 | Pipeline automation | The training pipeline is code; it runs on a schedule or trigger; data and model validation; metadata tracked | Changing the pipeline itself is still manual and risky |
| 2 | CI/CD automation | Changes to the pipeline are built, tested and deployed automatically; registry, feature store, orchestrator | Cost and complexity; only worth it with many models or frequent change |

```python
CHECKS = {   # a short self-assessment drawn from the ML Test Score rubric and the maturity levels
    "Training code is in version control, not only in notebooks": 0,
    "The training data used for each model can be identified and re-read": 0,
    "Each training run's parameters and metrics are recorded": 0,
    "Models are versioned in a registry with an owner": 0,
    "Input data is validated before training and before scoring": 0,
    "Features are computed by the same code in training and serving": 0,
    "Tests run automatically before a model is released": 0,
    "Releases use shadow or canary traffic and can be rolled back": 0,
    "Drift and performance are monitored with alerts": 0,
    "Retraining runs from a pipeline, not by hand": 0,
}

def maturity(answers):
    score = sum(answers.values())
    if score <= 3: level = "level 0: start with version control, tracking and a registry"
    elif score <= 7: level = "level 1: automate the pipeline end to end, then add validation and monitoring"
    else: level = "level 2 candidate: invest in CI/CD for the pipeline itself if you run many models"
    gaps = [k for k, v in answers.items() if not v]
    return score, level, gaps[:3]

lakeside = dict(CHECKS)
for k in list(lakeside)[:3]: lakeside[k] = 1           # Lakeside today: code in git, data findable, metrics in a spreadsheet
score, level, first_gaps = maturity(lakeside)
print(f"score {score}/10 -> {level}")
print("first three gaps:"); [print("  -", g) for g in first_gaps]
```

Lakeside is at level 0. The order of the gaps is the order of this phase: registry next, then validation, features, tests, release and monitoring.

## What LLMOps adds

LLM applications keep every MLOps concern and add some of their own. The model is usually someone else's (an API), so you version **prompts, model identifiers, retrieval indexes and tool definitions** instead of weights. Outputs are text, so evaluation needs golden sets and graders rather than one accuracy number. Vendors update and retire models on their own schedule, so model upgrades become a routine release. Cost moves from training to every request. Lessons 32.15 to 32.19 cover these; Phase 17 already covers serving engines, gateways and inference metrics in depth.

| Concern | Classic ML | LLM application |
|---|---|---|
| What you version | Data, code, weights | Prompts, model ID, retrieval index, tools, eval sets |
| How you test | Metrics on a held-out set | Golden sets with graders, slices, human review |
| What drifts | Feature distributions, label relationships | Question topics, document corpus, the vendor model itself |
| Main running cost | Training and serving compute | Tokens per request |

:::check
Which statements are right?

- ✓ Most production failures come from the system around the model, not from the algorithm.
- ✗ Every team should aim for MLOps level 2.
  Level 2 pays off with many models or frequent change; for one stable model, level 1 is often the right target.
- ✓ In an LLM application, prompts and model identifiers are versioned artifacts, like weights in classic ML.
:::

:::recap What to keep
- Data, features, train, register, release, serve, monitor, retrain: each stage has an owner.
- Level 0 manual, level 1 automated pipeline, level 2 automated changes to the pipeline.
- LLMOps versions prompts, model IDs, indexes and eval sets, and treats vendor model changes as releases.
:::

## Exercises

1. Answer the ten checks for a model you know. Which three gaps would you close first, and why?
2. Add two checks specific to LLM applications to `CHECKS` and justify each.
3. Name one model where level 1 is enough, and one where level 2 is worth the cost.

:::checked Sources and further reading
- [MLOps: Continuous delivery and automation pipelines in machine learning](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning), Google Cloud
- Sculley et al., "Hidden Technical Debt in Machine Learning Systems", NeurIPS 2015
- [The ML Test Score: A Rubric for ML Production Readiness and Technical Debt Reduction](https://research.google/pubs/the-ml-test-score-a-rubric-for-ml-production-readiness-and-technical-debt-reduction/), Breck et al., 2017
:::
