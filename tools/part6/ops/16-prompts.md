---
title: Prompt Management: a Prompt Registry, Evaluation Gates and Rollback by Alias
minutes: 60
group: LLMOps in production
lessons: a2929, a1110
---
:::goals What you will be able to do
- Keep prompts in a registry with immutable versions, commit messages and aliases
- Release a prompt only when it passes an evaluation gate against the current production version
- Roll back a prompt in seconds by moving an alias, with no code deploy
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
- **Setup**: `pip install mlflow`. The model calls are replaced by recorded outputs so the lesson runs offline; the last section shows the live call.
:::

:::plain The idea in one line
Treat prompts like models: versioned in a registry, promoted by alias after an evaluation, and loaded by alias at run time.
:::

## The problem

Lakeside's system prompt lives in a Python string. Changing it needs a code deploy, so product managers paste "temporary" prompt overrides into a config file, and nobody knows which version produced Tuesday's complaints. A prompt registry separates prompt changes from code changes without losing control.

## Register versions

```python
import os, logging, warnings
os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"; warnings.filterwarnings("ignore")
import tempfile; os.chdir(tempfile.mkdtemp())          # a fresh, empty workspace for this lesson's MLflow files
import mlflow
for name in ("mlflow", "alembic"): logging.getLogger(name).setLevel(logging.ERROR)
mlflow.set_tracking_uri("sqlite:///mlflow.db")

V1 = ("You are Lakeside Telecom's support assistant. Reply to the customer email below.\n"
      "Be polite. If you need account details, say so.\n\nEmail: {{email}}")
V2 = ("You are Lakeside Telecom's support assistant. Reply to the customer email below in under 120 words.\n"
      "Rules: never promise refunds or credits; for billing disputes, say a specialist will reply within 2 working days;\n"
      "ask only for the account number, never for passwords or card details.\n\nEmail: {{email}}")

p1 = mlflow.genai.register_prompt(name="support-reply", template=V1, commit_message="first version")
p2 = mlflow.genai.register_prompt(name="support-reply", template=V2, commit_message="add refund and data rules, length limit")
mlflow.genai.set_prompt_alias("support-reply", alias="production", version=p1.version)
prod = mlflow.genai.load_prompt("prompts:/support-reply@production")
print("production is version", prod.version)
print(prod.format(email="My bill is double this month!")[:120], "...")
```

Versions are immutable: version 1 means the same text forever, so a trace that records `support-reply/1` is reproducible. The alias is the only thing that moves.

## The evaluation gate

The gate runs both versions on the golden set and compares. To keep this lesson offline, `OUTPUTS` holds replies recorded from earlier runs of each version; in production the same function calls the model.

```python
GOLDEN = [   # case, slice, rule checks the reply must satisfy
    ("bill doubled, wants money back", "billing", {"no_refund_promise": True, "mentions_specialist": True}),
    ("router keeps dropping",          "technical", {"asks_account": True}),
    ("cancel contract",                "cancel",  {"no_refund_promise": True}),
    ("charged after cancelling",       "billing", {"no_refund_promise": True, "mentions_specialist": True}),
    ("change address",                 "account", {"no_sensitive_ask": True}),
    ("wants card details updated",     "account", {"no_sensitive_ask": True}),
]
OUTPUTS = {
    1: ["Sorry about that! We'll refund the extra charge right away.", "Please send your account number and we'll check the line.",
        "We're sorry to see you go. We'll refund any unused days.", "Apologies, a refund is on its way.",
        "Sure, please confirm your password and new address.", "Please reply with your card number and expiry date."],
    2: ["Sorry about the higher bill. A billing specialist will reply within 2 working days.", "Please send your account number so we can check your line.",
        "We're sorry to see you go. Please send your account number and we'll start the cancellation.", "Sorry about this. A billing specialist will reply within 2 working days.",
        "Please send your account number and new address.", "For security, please update card details in the app; never send them by email."],
}

def grade(reply, rules):
    r = reply.lower(); res = {}
    if "no_refund_promise" in rules: res["no_refund_promise"] = not any(w in r for w in ["refund the", "refund is", "we'll refund", "credit you"])
    if "mentions_specialist" in rules: res["mentions_specialist"] = "specialist" in r
    if "asks_account" in rules: res["asks_account"] = "account number" in r
    if "no_sensitive_ask" in rules: res["no_sensitive_ask"] = not any(w in r for w in ["password", "card number", "expiry", "cvv"])
    return all(res.values()), res

def evaluate(version):
    rows = [(case, sl, grade(OUTPUTS[version][i], rules)[0]) for i, (case, sl, rules) in enumerate(GOLDEN)]
    by_slice = {}
    for _, sl, ok in rows: by_slice.setdefault(sl, []).append(ok)
    return sum(ok for *_, ok in rows) / len(rows), {s: sum(v) / len(v) for s, v in by_slice.items()}, rows

def gate(candidate, production):
    c_all, c_sl, _ = evaluate(candidate); p_all, p_sl, _ = evaluate(production)
    worse = [s for s in c_sl if c_sl[s] < p_sl.get(s, 0)]
    return ("PROMOTE" if c_all >= p_all and not worse else "BLOCK"), round(p_all, 2), round(c_all, 2), worse

decision, before, after, worse = gate(p2.version, prod.version)
print(f"{decision}: pass rate {before} -> {after}; slices worse: {worse or 'none'}")
for case, sl, ok in evaluate(prod.version)[2]:
    if not ok: print("  production fails:", case)
```

Version 1 promised refunds and asked for passwords and card numbers: real failures the gate makes visible. Version 2 passes every case. Rule-based graders are crude but fast and exact; lesson 32.17 adds calibrated model graders for qualities rules cannot check.

## Promote and roll back

```python
def promote(name, version, reason):
    current = mlflow.genai.load_prompt(f"prompts:/{name}@production").version
    mlflow.genai.set_prompt_alias(name, alias="previous", version=current)
    mlflow.genai.set_prompt_alias(name, alias="production", version=version)
    print(f"{name}: production {current} -> {version} ({reason})")

def rollback(name):
    prev = mlflow.genai.load_prompt(f"prompts:/{name}@previous").version
    mlflow.genai.set_prompt_alias(name, alias="production", version=prev)
    print(f"{name}: rolled back to {prev}")

if decision == "PROMOTE": promote("support-reply", p2.version, "gate passed on golden set 12")
rollback("support-reply")
promote("support-reply", p2.version, "re-promoted after rollback drill")
```

## The live call loads by alias

```pyshow
import anthropic, mlflow
client = anthropic.Anthropic()
prompt = mlflow.genai.load_prompt("prompts:/support-reply@production")      # cache it for a minute in production
msg = client.messages.create(model="claude-sonnet-5-5", max_tokens=400,
                             messages=[{"role": "user", "content": prompt.format(email=email_text)}])
log_trace(prompt_name="support-reply", prompt_version=prompt.version, model="claude-sonnet-5-5", output=msg.content[0].text)
```

Record the prompt version with every trace. Without it, the production logs cannot tell you which prompt produced a complaint, and the next golden-set cases cannot be traced to their cause.

:::check
Which statements are right?

- ✓ Prompt versions should be immutable, with only aliases moving.
- ✗ Prompt changes are safe to release without evaluation because they are only text.
  Version 1 above promised refunds and asked for passwords; text changes behaviour.
- ✓ Each trace should record the prompt name and version that produced it.
:::

:::recap What to keep
- Registry: immutable versions, commit messages, aliases.
- Gate against production on the golden set, overall and by slice.
- Load by alias at run time; roll back by moving the alias; log the version with every trace.
:::

## Exercises

1. Write a version 3 that breaks the `asks_account` rule, record its outputs, and confirm the gate blocks it.
2. Add a `staging` alias and change `gate` so a prompt must spend one day in staging before production.
3. Store the golden set's version as a tag on each prompt version you promote.

:::checked Sources and further reading
- [Prompt Registry](https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/), MLflow 3 on Databricks: register, load by alias, version management
- [Prompt engineering overview](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview), Claude documentation
:::
