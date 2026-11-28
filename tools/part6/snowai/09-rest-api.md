---
title: Cortex REST API: Chat Completions, Messages, Tool Calling and Structured Outputs from Applications
minutes: 55
group: AI in SQL: Cortex AI Functions
lessons: a1110, a1719
---
:::goals What you will be able to do
- Call Snowflake-hosted models from application code through the OpenAI-compatible and Anthropic-compatible endpoints
- Use tool calling and structured outputs through the REST API, and pick the right role for API-only users
- Decide between AI functions in SQL, the REST API and Cortex AI Gateway, and track REST usage
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 55 minutes.
:::

:::plain The idea in one line
When the caller is an application rather than a query, use the Cortex REST API: standard request shapes, Snowflake authentication and billing, data staying in the Snowflake perimeter.
:::

## The problem

Brightwell's mobile app team wants a model to draft replies in the support inbox. They write Python and TypeScript, not SQL, and their framework already speaks the OpenAI and Anthropic APIs. Running inference outside Snowflake would mean another vendor contract and copying ticket text out.

## The endpoints

| Endpoint | Path | Models |
|---|---|---|
| Chat Completions (OpenAI-compatible) | `POST /api/v2/cortex/v1/chat/completions` | All Cortex models (OpenAI, Claude, Llama, Mistral, DeepSeek, Snowflake) |
| Messages (Anthropic-compatible) | `POST /api/v2/cortex/v1/messages` | Claude models |
| Responses (preview) | `POST /api/v2/cortex/v1/responses` | OpenAI models on AWS |

Authentication is a bearer token: key-pair JWT, OAuth, or a programmatic access token. The user's default role needs `SNOWFLAKE.CORTEX_USER` or the narrower `SNOWFLAKE.CORTEX_REST_API_USER`, which covers only the REST API: the right choice for a service user that should never run AI functions in SQL. Model access follows model RBAC (lesson 33.2). Fine-tuned models are addressed as `database.schema.model`.

```pyshow
from openai import OpenAI
client = OpenAI(base_url=f"https://{ACCOUNT_HOST}/api/v2/cortex/v1", api_key=PAT)
resp = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "system", "content": "Draft a short, polite reply. Never promise refunds."},
              {"role": "user", "content": ticket_text}],
    tools=[{"type": "function", "function": {"name": "get_order", "description": "Look up an order by ID",
            "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}}}],
)
```

Tool calling works for OpenAI and Claude models (`tools` with `type: "function"` in Chat Completions; Anthropic-style tools with `input_schema` in Messages). Structured outputs use `response_format` with `json_schema` in Chat Completions, and `output_config.format` with `json_schema` in Messages.

## Which door for which caller

| Caller | Use | Why |
|---|---|---|
| A query or pipeline over many rows | AI functions in SQL (lessons 33.5 to 33.8) | Set-based, governed by the query's role, usage in `CORTEX_AI_FUNCTIONS_USAGE_HISTORY` |
| An application making individual calls | Cortex REST API | Standard SDKs, per-request usage in `CORTEX_REST_API_USAGE_HISTORY` |
| Many applications and coding agents, centrally governed | Cortex AI Gateway (lesson 33.23) | Gateway access control, traces and cost attribution on top of the same request shapes |
| Governed answers over Brightwell data | A Cortex Agent (lesson 33.17) | The model alone does not know your data or rules |

REST calls do not write to the AI Observability event table, so log what you need (prompt version, latency, outcome) in the application, and join to `CORTEX_REST_API_USAGE_HISTORY` by request ID for tokens and credits.

## Locally: a thin client with retries and a usage log

```python
import json, random, time

class FakeCortex:   # stands in for the REST endpoint so the client logic can be tested offline
    def __init__(self, fail_first=2): self.calls, self.fail_first = 0, fail_first
    def post(self, path, body):
        self.calls += 1
        if self.calls <= self.fail_first: return 429, {"message": "rate limited"}
        return 200, {"id": f"req-{self.calls}", "model": body["model"],
                     "choices": [{"message": {"content": "Thanks for getting in touch. A specialist will reply within 2 working days."}}],
                     "usage": {"prompt_tokens": 412, "completion_tokens": 21}}

def chat(api, model, messages, log, retries=4, base_delay=0.01):
    for attempt in range(retries + 1):
        status, body = api.post("/api/v2/cortex/v1/chat/completions", {"model": model, "messages": messages})
        if status == 200:
            log.append({"request_id": body["id"], "model": model, "attempts": attempt + 1, **body["usage"]})
            return body["choices"][0]["message"]["content"]
        if status in (429, 503) and attempt < retries:
            time.sleep(base_delay * 2 ** attempt * (1 + random.random()))      # exponential backoff with jitter
            continue
        raise RuntimeError(f"Cortex call failed: {status} {body}")

log = []
reply = chat(FakeCortex(), "claude-sonnet-4-5", [{"role": "user", "content": "My bill doubled"}], log)
print(reply); print(json.dumps(log, indent=1))
```

Retry only on rate limits and temporary errors, back off exponentially, and log the request ID with tokens so finance can reconcile the application's numbers with Snowflake's usage view.

:::check
Which statements are right?

- ✓ `SNOWFLAKE.CORTEX_REST_API_USER` suits a service user that should only call the REST API.
- ✗ REST API calls appear in the AI Observability event table automatically.
  They do not; log in the application and use `CORTEX_REST_API_USAGE_HISTORY` for usage.
- ✓ The Messages endpoint is for Claude models; Chat Completions serves all Cortex models.
:::

:::recap What to keep
- Chat Completions for all models, Messages for Claude, Responses in preview; bearer-token auth.
- Tool calling and JSON-schema structured outputs work through both.
- SQL for rows, REST for apps, Gateway for central governance, Agents for governed answers.
:::

## Exercises

1. Change `FakeCortex` to return a 400 error. What should `chat` do, and why must it not retry?
2. Add the prompt version to the usage log and write the SQL join to `CORTEX_REST_API_USAGE_HISTORY`.
3. Decide which door Brightwell's warehouse-staff mobile app should use for "where is order X?", and why.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Getting started with Anthropic on Snowflake Cortex](https://www.snowflake.com/en/developers/guides/getting-started-with-anthropic-on-snowflake-cortex/) (Snowflake guide)
- [LangChain agents on Cortex AI Gateway with MCP tools and traces](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/langchain-mcp-agent-tracing) (Cortex AI Cookbook)

:::checked Sources and further reading
- [Cortex REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api)
- [Inference with Cortex AI Gateway](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-ai-gateway/inference)
- [Model availability for Snowflake Cortex AI](https://docs.snowflake.com/en/user-guide/snowflake-cortex/model-availability)
:::
