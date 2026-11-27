---
title: Prototyping on the Claude API: a Thin Slice with Structured Output and Traces
minutes: 75
group: Building in the customer's environment
lessons: a1103, a1109, a1110
---
:::goals What you will be able to do
- Call the Claude Messages API with a system prompt, examples from the customer's real cases and a JSON schema for the output
- Wrap every model call in a harness that validates the output and records a trace
- Develop offline against recorded responses, so the harness is tested before you spend tokens
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 75 minutes.
- **Runs**: the harness runs here against recorded responses. The API calls are shown, not run; they need your `ANTHROPIC_API_KEY`.
:::

:::plain The idea in one line
Build the smallest path that goes from a real input to a checked output in the customer's format, and record everything the model saw and said.
:::

## The problem

A prototype exists to answer "can it work here?". It answers that only if it runs on the customer's real inputs, produces output their system accepts, and leaves a trace you can show the process owner when something looks wrong. A notebook with one good example answers nothing.

## The call

The first Harbor Mutual slice reads one claims email and returns the claim fields as JSON. The system prompt states the job and the rules; two real (anonymised) emails with their correct output serve as examples; the output is constrained to a schema.

```pyshow
import anthropic, json

client = anthropic.Anthropic()            # reads ANTHROPIC_API_KEY

CLAIM_SCHEMA = {
    "type": "object",
    "properties": {
        "is_claim": {"type": "boolean"},
        "policy_number": {"type": ["string", "null"]},
        "loss_date": {"type": ["string", "null"], "description": "ISO date"},
        "line": {"type": "string", "enum": ["motor", "home", "other"]},
        "missing_documents": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_claim", "policy_number", "loss_date", "line", "missing_documents"],
    "additionalProperties": False,
}

SYSTEM = """You turn insurance claim emails into claim records for Harbor Mutual.
Use only facts stated in the email or its attachments. If a value is not stated, return null.
Policy numbers look like HM-123456. Dates are ISO (YYYY-MM-DD)."""

def extract(email_text, examples):
    msg = client.messages.create(
        model="claude-haiku-5-5",              # start small; move up only if the evals say so
        max_tokens=1024,
        system=SYSTEM,
        messages=examples + [{"role": "user", "content": email_text}],
        output_config={"format": {"type": "json_schema", "schema": CLAIM_SCHEMA}},
    )
    text = next(block.text for block in msg.content if block.type == "text")
    return json.loads(text), msg.usage
```

`output_config.format` constrains the response to the schema (objects need `"additionalProperties": False`). With Pydantic, `client.messages.parse(..., output_format=ClaimModel)` does the same and returns `response.parsed_output`. For tool arguments, `"strict": True` on a tool definition gives the same guarantee for that tool's input.

## The harness: validate, trace, and develop offline

The harness does not care whether the response came from the API or from a file. During development it replays recorded responses, so you can test validation, error handling and traces without spending tokens or waiting.

```python
import json, re, hashlib, time

RECORDED = {  # what the model returned for three real emails, saved during an earlier session
    "e1": '{"is_claim": true, "policy_number": "HM-482913", "loss_date": "2026-11-02", "line": "motor", "missing_documents": ["repair estimate"]}',
    "e2": '{"is_claim": true, "policy_number": "HM 48291", "loss_date": "02/11/2026", "line": "home", "missing_documents": []}',
    "e3": '{"is_claim": false, "policy_number": null, "loss_date": null, "line": "other", "missing_documents": []}',
}

def fake_model(case_id):
    return RECORDED[case_id]

def validate(rec):
    problems = []
    if rec["policy_number"] is not None and not re.fullmatch(r"HM-\d{6}", rec["policy_number"]):
        problems.append(f"policy_number format: {rec['policy_number']!r}")
    if rec["loss_date"] is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", rec["loss_date"]):
        problems.append(f"loss_date not ISO: {rec['loss_date']!r}")
    if rec["is_claim"] and rec["policy_number"] is None:
        problems.append("claim without policy number: route to a human")
    return problems

TRACE = []
def run_case(case_id, email_text, model=fake_model):
    t0 = time.time()
    raw = model(case_id)
    rec = json.loads(raw)
    problems = validate(rec)
    TRACE.append({"case": case_id, "input_sha": hashlib.sha256(email_text.encode()).hexdigest()[:12],
                  "output": rec, "problems": problems, "status": "review" if problems else "ok",
                  "ms": round((time.time() - t0) * 1000, 1)})
    return TRACE[-1]

for cid in RECORDED:
    r = run_case(cid, f"(email text for {cid})")
    print(cid, r["status"], r["problems"])
```

Case `e2` is the important one: the model returned a plausible record in the wrong formats. Validation turns it into a "review" item instead of a bad record in the claims system, and the trace shows exactly why. Normalising the formats in code (or tightening the schema with a pattern) is the next small change.

## What makes a thin slice "thin"

| Thin slice includes | It leaves for later |
|---|---|
| One input type, end to end into the customer's system (or a faithful copy) | Every input type |
| Validation and a review path for failures | Automatic retries and fallbacks |
| A trace per case | Dashboards |
| The cheapest model that might work | Model routing |

:::check
Which statements are right?

- ✓ The harness should accept recorded responses so it can be tested without API calls.
- ✗ If the output matches the JSON schema, it is ready for the customer's system.
  A schema guarantees shape, not business rules: case e2 has valid JSON in the wrong formats.
- ✓ Every case should leave a trace of what the model saw and returned, and why it was accepted or routed to review.
:::

:::recap What to keep
- Real inputs, the customer's output format, a schema, a trace.
- Validate business rules after the schema; route failures to a person.
- Develop against recordings; spend tokens on evals, not on debugging plumbing.
:::

## Exercises

1. Add a normaliser that rewrites `HM 48291`-style numbers and `dd/mm/yyyy` dates before validation, and decide which normalisations are safe (could `HM 48291` be a different policy from `HM-048291`?).
2. Add the token counts from `msg.usage` to the trace record and compute cost per case from your price list.
3. Record five more responses from your own emails (with a real key) and grow the harness's test set.

:::checked Sources and further reading
- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs): JSON outputs and strict tool use
- [Claude Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview): model IDs and the comparison table
:::
