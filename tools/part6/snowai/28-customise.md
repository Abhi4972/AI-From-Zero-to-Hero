---
title: Customising Models: Cortex Fine-tuning, arctic-extract Fine-tuning, Cortex Training and When Not to Train
minutes: 50
group: Quality, ML and serving
lessons: a3311, a3327
---
:::goals What you will be able to do
- Decide, with evidence, whether a task needs a customised model at all
- Know the three ways to customise on Snowflake in late 2026 and their status: Cortex Fine-tuning (being retired), arctic-extract fine-tuning, and Cortex Training (preview)
- Plan the evaluation, cost and lifecycle of a customised model before training it
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 50 minutes.
:::

:::plain The idea in one line
Train last: prompts, examples, retrieval and model choice are cheaper and reversible; customise only when a measured quality or cost target cannot be met any other way, and budget for retraining when the base model changes.
:::

## The problem

A Brightwell team wants to fine-tune a model "so it understands our products". The real complaint is wrong product details in generated descriptions, which retrieval of the spec sheet already fixes.

## The decision first

| Question | If yes |
|---|---|
| Do prompting, a few examples, retrieval or a better model already meet the quality bar on a golden set? | Stop; no training needed |
| Can AI Function optimization (lesson 33.11) find a cheaper model and prompt that meets it? | Use that; it is reversible |
| Is the task narrow, high-volume and stable, with thousands of good labelled examples? | Customising a small model may cut cost and latency |
| Will the base model be retired or upgraded soon? | Budget for retraining and re-evaluation |
| Can you evaluate the customised model on the same golden set and beat the hosted model? | Required before any switch |

## The three routes

| Route | What it is | Status |
|---|---|---|
| Cortex Fine-tuning | Serverless LoRA fine-tuning of selected base models with `SNOWFLAKE.CORTEX.FINETUNE`, results callable from `AI_COMPLETE` by name | Deprecated, with retirement planned for Q1 2027; new model training stopped in AWS US East 1 on 20 Oct 2026; plan to move to Cortex Training |
| arctic-extract fine-tuning | Fine-tune the document extraction model behind `AI_EXTRACT` on your documents | Preview 28 Jan, GA 20 Apr 2026 |
| Cortex Training | Serverless SFT and reinforcement learning of open-weight models on managed GPUs, through the `cortex_training` Python namespace or CLI with a programmatic access token; checkpoints to an experiment run stage; deployments that serve streamed chat completions | Preview 30 Oct 2026, commercial AWS regions, needs enablement |

```sql
-- Cortex Fine-tuning (existing jobs and models only; check availability in your region)
SELECT SNOWFLAKE.CORTEX.FINETUNE('CREATE', 'support.ai.review_tagger', 'llama3.1-8b',
  'SELECT prompt, completion FROM support.ml.review_tags_train',
  'SELECT prompt, completion FROM support.ml.review_tags_val');

-- Cortex Training: privileges
GRANT USE CORTEX TRAINING ON ACCOUNT TO ROLE ml_training;
GRANT CREATE EXPERIMENT ON SCHEMA ml.training TO ROLE ml_training;
```

Cortex Training bills per second in AI Credits from when GPU capacity is assigned (including model loading) until the job reaches a terminal state or the deployment is dropped; queued jobs are free. Drop idle deployments, and cancel jobs you no longer need.

## Locally: break-even for a customised small model

```python
def monthly_cost(rows_per_month, in_tok, out_tok, rate_in, rate_out, fixed=0.0):
    return rows_per_month * (in_tok * rate_in + out_tok * rate_out) / 1e6 + fixed

# illustrative credits per million tokens; real rates are in Snowflake's Service Consumption Table
LARGE = dict(rate_in=1.50, rate_out=7.50)
SMALL_TUNED = dict(rate_in=0.20, rate_out=0.20)
TRAINING_ONE_OFF = 400      # credits: training plus evaluation runs
DEPLOYMENT_MONTHLY = 0      # serverless: no always-on deployment in this scenario

for rows in [50_000, 500_000, 5_000_000]:
    big = monthly_cost(rows, 600, 20, **LARGE)                            # long prompt with examples
    small = monthly_cost(rows, 120, 5, **SMALL_TUNED, fixed=DEPLOYMENT_MONTHLY)   # short prompt: behaviour is trained in
    saving = big - small
    months = TRAINING_ONE_OFF / saving if saving > 0 else float("inf")
    print(f"{rows:>9,} rows/month: large {big:8.1f}  tuned small {small:6.1f}  pays back in {months:5.1f} months")
```

At 50,000 rows a month payback takes most of a year, probably longer than the base model will stay current; at half a million rows it pays back within a month, and at millions within days. Add the cost of keeping a golden set and retraining, and require the tuned model to match the large model's quality on that set.

:::check
Which statements are right?

- ✓ Customisation should follow only when cheaper, reversible options miss a measured quality or cost target.
- ✗ Cortex Training bills for jobs while they wait in the queue.
  Billing starts when GPU capacity is assigned; queued jobs are not billed.
- ✓ Cortex Fine-tuning is being retired, so new work should plan for Cortex Training.
:::

:::recap What to keep
- Prompt, retrieve, optimise and choose models first; train last.
- Fine-tuning is being retired; arctic-extract fine-tuning is GA; Cortex Training is in preview.
- Break-even depends on volume; budget for evaluation and retraining.
:::

## Exercises

1. Find the volume at which the tuned model pays back in exactly three months.
2. Write the golden-set evaluation that must pass before review tagging switches to a tuned model.
3. Brightwell has a Cortex Fine-tuning model in production. Write the migration plan to Cortex Training.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Own your intelligence with Cortex Training](https://www.snowflake.com/en/developers/guides/own-your-intelligence-cortex-training/) (Snowflake guide)
- [Serverless LLM fine-tuning with Cortex AI](https://www.snowflake.com/en/developers/solutions-center/llm-serverless-fine-tuning-with-snowflake-cortex-ai/) (Snowflake docs)

:::checked Sources and further reading
- [Cortex Training](https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-training) and [Own your intelligence with Cortex Training](https://snowflake.com/en/blog/cortex-training-fine-tune-open-weight-llms), Snowflake blog
- Snowflake release notes: Fine-tuning arctic-extract models (28 Jan, 20 Apr 2026), Cortex Fine-tuning availability change (20 Oct 2026), Cortex Training (30 Oct 2026)
:::
