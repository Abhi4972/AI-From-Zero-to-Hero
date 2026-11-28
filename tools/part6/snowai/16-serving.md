---
title: Serving Your Own Models: Warehouse Inference, Snowpark Container Services, GPUs and When to Customise a Model
minutes: 60
group: Quality, ML and serving
lessons: a3214, a3060, a1728
---
:::goals What you will be able to do
- Choose between warehouse inference, a real-time service in Snowpark Container Services, and a hosted Cortex model
- Deploy a registered model as a service with `create_service` and call it over REST
- Size a GPU service from traffic and latency, and decide whether customising an open model is worth it
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Batch scores run in a warehouse; real-time and GPU models run as container services; and a hosted Cortex model is often cheaper than serving your own unless you have a clear reason.
:::

## The problem

Brightwell has three models: the demand forecast (weekly batch), a fraud score that the checkout must call within 150 ms, and a request from the product team to "train our own LLM" on product descriptions.

## Three ways to serve

| Option | How | Good for | Watch |
|---|---|---|---|
| Warehouse inference | `mv.run(df, function_name=...)` or `MODEL(name, version)!method(...)` in SQL | Batch scoring, CPU models | Not for millisecond latency |
| Snowpark Container Services | `mv.create_service(...)` on a compute pool, REST endpoint with ingress | Real-time APIs, GPU models, large open models | Always-on cost; scaling settings |
| Hosted Cortex model | `AI_COMPLETE` and task functions | Language tasks | Model choice limited to hosted models |

```pyshow
mv = reg.get_model("FRAUD_SCORE").version("V3")
mv.create_service(service_name="FRAUD_SCORE_SVC",
                  service_compute_pool="CHECKOUT_CPU_POOL",
                  ingress_enabled=True,
                  gpu_requests=None)                      # e.g. "1" on a GPU pool for GPU models
print(mv.list_services())                                 # includes the endpoint; SHOW ENDPOINTS IN SERVICE also works
```

```pyshow
import json, requests
payload = {"dataframe_split": json.loads(orders_df.to_json(orient="split"))}
r = requests.post(f"{ENDPOINT_URL}/predict-proba",          # method names use dashes in the URL
                  headers={"Authorization": f'Snowflake Token="{PAT}"', "Content-Type": "application/json"},
                  json=payload, timeout=1.0)
```

System compute pools (`SYSTEM_COMPUTE_POOL_CPU`, `SYSTEM_COMPUTE_POOL_GPU`) exist for getting started; production services get their own pools so they can be sized, scaled and budgeted separately. GPU instance families include `GPU_NV_S` (`GPU_NV_SM` on Azure).

## Locally: size a real-time service

```python
import math

def size_service(peak_rps, p95_ms_per_request, concurrency_per_instance, target_utilisation=0.6,
                 instance_credits_per_hour=None, hours_per_month=730):
    per_instance_rps = concurrency_per_instance * 1000 / p95_ms_per_request * target_utilisation
    instances = max(1, math.ceil(peak_rps / per_instance_rps))
    out = {"per_instance_rps": round(per_instance_rps, 1), "instances_at_peak": instances}
    if instance_credits_per_hour is not None:
        out["monthly_credits_always_on"] = round(instances * instance_credits_per_hour * hours_per_month)
    return out

# fraud score: CPU model, 12 ms per request, 8 concurrent requests per instance, Black Friday peak 900 requests/s
print("fraud score :", size_service(900, 12, 8, instance_credits_per_hour=0.5))
# an open 8B LLM on one GPU: 900 ms per request, 16 concurrent, peak 20 requests/s
print("open LLM    :", size_service(20, 900, 16, instance_credits_per_hour=4.0))
```

The credit rates here are placeholders for the exercise: use the compute-pool rates for your instance family from Snowflake's Service Consumption Table. The shape of the result is the lesson: real-time services are paid for by the hour whether busy or idle, so compare the monthly figure with what the same traffic would cost per token on a hosted model (lesson 33.18), and set `max_instances` and auto-suspend to match the traffic pattern.

## Should Brightwell customise an LLM?

Snowflake announced Cortex Training at Summit 2026 for customising open-weight LLMs on managed GPUs. Before reaching for it, the honest checklist:

| Question | If yes |
|---|---|
| Can prompting, examples and retrieval reach the quality bar? | Stop; no training needed |
| Is the task narrow, high-volume and stable, with thousands of good labelled examples? | Customising a small model may cut cost and latency |
| Will the base model be retired or upgraded soon? | Budget for re-training and re-evaluation (lesson 32.19) |
| Can you evaluate the customised model on a golden set better than the hosted one? | Required before any switch |

For Brightwell's product descriptions, retrieval of the spec sheet plus a hosted model met the bar in the pilot, so the request was declined: a cheaper, reversible answer.

:::check
Which statements are right?

- ✓ Real-time services in Snowpark Container Services cost compute by the hour, busy or idle.
- ✗ A fraud score that must answer in 150 ms is best served by warehouse inference.
  Warehouse inference suits batch; real-time calls need a service with an endpoint.
- ✓ Customising an LLM should only follow when prompting and retrieval cannot meet a measured quality bar.
:::

:::recap What to keep
- Warehouse for batch, container services for real-time and GPU, Cortex for language tasks.
- `create_service`, ingress endpoint, `dataframe_split` payloads.
- Size from peak traffic and latency; compare always-on cost with per-token cost; customise last.
:::

## Exercises

1. Halve the fraud model's latency. How many instances do you save at peak?
2. Find the request rate at which the open-LLM service becomes cheaper than a hosted model for you, given rates from the consumption table.
3. Write the evaluation plan that would justify customising a model for review tagging (lesson 33.5).

:::checked Sources and further reading
- [Deploy models for real-time inference (REST API)](https://docs.snowflake.com/en/developer-guide/snowflake-ml/inference/real-time-inference-rest-api)
- [Model serving in Snowpark Container Services](https://docs.snowflake.com/developer-guide/snowflake-ml/model-registry/container)
- [Snowflake Summit 2026: context, custom model training, Iceberg v3](https://www.constellationr.com/index%2Ephp/insights/news/snowflake-summit-2026-context-custom-model-training-iceberg-v3), Constellation Research
:::
