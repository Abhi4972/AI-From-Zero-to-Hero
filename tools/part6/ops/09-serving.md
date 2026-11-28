---
title: Packaging and Serving Models: Batch or Online, ONNX Export, Input Checks and Latency Budgets
minutes: 65
group: Serving, release and monitoring
lessons: a0007, a1708
---
:::goals What you will be able to do
- Choose between batch scoring and an online endpoint from the business need, not habit
- Export a scikit-learn pipeline to ONNX and prove the exported model gives the same answers
- Put input validation and a latency budget around an online model
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 65 minutes.
- **Setup**: `pip install skl2onnx onnxruntime` for the export section.
:::

:::plain The idea in one line
Serve predictions in the simplest way that meets the deadline the business has, package the model so it runs the same everywhere, and guard the endpoint against bad inputs and slow answers.
:::

## The problem

Lakeside's platform team assumed the churn model needed a real-time API. The retention team only calls customers the next morning. A nightly batch job writing scores to a table would have been cheaper, simpler to monitor and easier to roll back.

## Batch or online

| Question | Batch scoring | Online endpoint |
|---|---|---|
| When is the prediction needed? | Hours later (campaigns, reports, queues) | During a user interaction |
| Inputs available | All in the warehouse | Some only at request time |
| Cost | Compute once per period | Always-on service |
| Failure handling | Keep yesterday's scores | Fallback answer needed in milliseconds |
| Monitoring | Compare full runs | Per-request logs and sampling |

Lakeside chooses **batch** for the retention list, and **online** for one place: the cancellation page, where an offer must be chosen while the customer waits.

## A pipeline that travels: export to ONNX

ONNX is a portable model format with fast runtimes for many languages and platforms. Exporting the whole scikit-learn pipeline (scaling included) avoids re-implementing preprocessing in the serving language.

```python
import time
import numpy as np, pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from skl2onnx import to_onnx
import onnxruntime as ort

r = np.random.default_rng(0); n = 5000
X = np.column_stack([r.integers(1, 72, n), r.normal(55, 18, n).clip(10, 150), r.poisson(1.2, n), r.random(n) < .55]).astype(np.float32)
logit = -1.2 - .04 * X[:, 0] + .02 * (X[:, 1] - 55) + .45 * X[:, 2] + 1.4 * X[:, 3]
y = (r.random(n) < 1 / (1 + np.exp(-logit))).astype(int)

pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500)).fit(X, y)
onx = to_onnx(pipe, X[:1], options={id(pipe.steps[-1][1]): {"zipmap": False}})
sess = ort.InferenceSession(onx.SerializeToString(), providers=["CPUExecutionProvider"])
print("inputs:", [(i.name, i.shape) for i in sess.get_inputs()], "outputs:", [o.name for o in sess.get_outputs()])
```

## Parity: prove the export is the same model

```python
sample = X[:2000]
p_sklearn = pipe.predict_proba(sample)[:, 1]
p_onnx = sess.run(None, {sess.get_inputs()[0].name: sample})[1][:, 1]
diff = np.abs(p_sklearn - p_onnx).max()
print(f"max probability difference: {diff:.2e}  ->", "PASS" if diff < 1e-5 else "FAIL")
print("same decisions at 0.5:", bool(((p_sklearn > .5) == (p_onnx > .5)).all()))
```

Run this parity test in CI for every exported version. Small floating-point differences are normal (ONNX computes in 32-bit floats); a large one means an unsupported option or a preprocessing step that did not export.

## Latency: measure percentiles, not averages

```python
def bench(fn, rows, reps=300):
    times = []
    for i in range(reps):
        x = rows[i % len(rows)][None, :]
        t = time.perf_counter(); fn(x); times.append((time.perf_counter() - t) * 1000)
    return {q: round(float(np.percentile(times, q)), 3) for q in (50, 95, 99)}

name = sess.get_inputs()[0].name
print("sklearn  ms per single prediction p50/p95/p99:", bench(lambda x: pipe.predict_proba(x), X))
print("onnxrt   ms per single prediction p50/p95/p99:", bench(lambda x: sess.run(None, {name: x}), X))
```

For one-row requests the runtime overhead dominates, and the ONNX runtime is usually several times faster than calling scikit-learn directly. The numbers on your machine will differ; what matters is that you measure p95 and p99 against the budget the product sets (for the cancellation page, say 50 ms for the whole request, of which the model may use 5).

## The endpoint: validate, predict, fall back

```python
BUDGET_MS, FALLBACK = 5.0, {"risk": None, "offer": "standard", "reason": "fallback"}
RANGES = [(0, 120), (5, 400), (0, 50), (0, 1)]

def score(request):
    try:
        x = np.array([[request["tenure"], request["monthly"], request["tickets"], request["month_to_month"]]], dtype=np.float32)
    except (KeyError, TypeError, ValueError):
        return FALLBACK | {"reason": "bad input"}
    if any(not lo <= v <= hi for v, (lo, hi) in zip(x[0], RANGES)):
        return FALLBACK | {"reason": "out of range"}
    t = time.perf_counter(); risk = float(sess.run(None, {name: x})[1][0, 1]); ms = (time.perf_counter() - t) * 1000
    if ms > BUDGET_MS:
        return FALLBACK | {"reason": f"slow ({ms:.1f} ms)"}
    return {"risk": round(risk, 3), "offer": "retention_discount" if risk > .5 else "standard", "reason": "model"}

for req in [{"tenure": 3, "monthly": 95, "tickets": 5, "month_to_month": 1},
            {"tenure": 60, "monthly": 40, "tickets": 0, "month_to_month": 0},
            {"tenure": 3, "monthly": 9500, "tickets": 5, "month_to_month": 1},
            {"tenure": "three"}]:
    print(score(req))
```

In production this function sits behind a web framework (FastAPI is common), runs in a container, and logs every request with the model version, inputs, output, latency and reason. Those logs are what monitoring (lesson 32.11) reads.

```pyshow
# FastAPI wrapper (sketch): the model is loaded once at start-up, by registry alias
from fastapi import FastAPI
from pydantic import BaseModel, Field
app = FastAPI()

class Customer(BaseModel):
    tenure: int = Field(ge=0, le=120); monthly: float = Field(ge=5, le=400)
    tickets: int = Field(ge=0, le=50); month_to_month: int = Field(ge=0, le=1)

@app.post("/score")
def score_endpoint(c: Customer):
    return score(c.model_dump())     # pydantic has already rejected bad types and ranges with a 422
```

:::check
Which statements are right?

- ✓ If predictions are only used the next morning, batch scoring is usually the better design.
- ✗ An exported ONNX model can be trusted without testing because the converter is deterministic.
  Run a parity test on real inputs for every exported version.
- ✓ Latency budgets should be checked against p95 or p99, not the average.
:::

:::recap What to keep
- Pick batch or online from when the prediction is needed.
- Export the whole pipeline; prove parity on real inputs.
- Validate inputs, measure percentiles, and always have a fallback.
:::

## Exercises

1. Benchmark batches of 1, 100 and 10,000 rows for both runtimes. Where does the ONNX advantage shrink, and why?
2. Add a reason code for "model unavailable" and simulate it by deleting the session.
3. Write the batch version: score 1 million rows in chunks and write `(customer_id, score_date, risk, model_version)` idempotently.

:::checked Sources and further reading
- [skl2onnx documentation](https://onnx.ai/sklearn-onnx/)
- [ONNX Runtime documentation](https://onnxruntime.ai/docs/)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
:::
