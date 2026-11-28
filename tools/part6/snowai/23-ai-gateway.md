---
title: Cortex AI Gateway: One Governed Endpoint for Models, Coding Agents and Tools, with Traces, Payload Capture and Cost Attribution
minutes: 55
group: Agent products: CoWork, CoCo, apps and the gateway
lessons: a3309, a3302
---
:::goals What you will be able to do
- Route applications and third-party coding agents through Cortex AI Gateway, and control who may use it
- Configure the gateway specification: exposed models, logging, client telemetry and payload capture with exemptions
- Read gateway usage and traces, and know which gateway features are GA, preview or private preview
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about 55 minutes.
:::

:::plain The idea in one line
If every AI client in the company sends its model calls through one Snowflake-run endpoint, access, logging and spend can be governed in one place, with the same roles and quotas as the rest of Snowflake.
:::

## The problem

Brightwell's teams use four coding agents and two internal apps, each with its own API key to a different model provider. Security cannot see what is sent, finance cannot split the bill, and revoking a leaver means finding six keys.

## The gateway

Each account has one gateway object, `SNOWFLAKE`, provisioned automatically. It accepts the standard request shapes at `https://<account-host>/api/v2/aigateways/SNOWFLAKE`: `/v1/chat/completions` (OpenAI-compatible), `/v1/messages` (Anthropic-compatible) and `/v1/responses` (preview). Pricing is AI Credits per token at each model's rate, as for Cortex inference.

```sql
SHOW AI GATEWAYS;                                    -- returns the endpoint
DESCRIBE AI GATEWAY SNOWFLAKE;                       -- current specification
REVOKE USAGE ON AI GATEWAY SNOWFLAKE FROM ROLE PUBLIC;   -- USAGE is granted to PUBLIC by default
GRANT USAGE ON AI GATEWAY SNOWFLAKE TO ROLE engineering;
GRANT MONITOR ON AI GATEWAY SNOWFLAKE TO ROLE ai_platform_admin;   -- read everyone's usage and traces
```

`USAGE` does not widen model access: requests still need model RBAC (lesson 33.2), and model-grant changes reach the gateway within about five minutes. Without `MONITOR`, a user sees only their own traces.

## The specification

`ALTER AI GATEWAY SNOWFLAKE FROM SPECIFICATION $$ ... $$` replaces the **whole** specification, and omitted fields fall back to defaults, so always start from `DESCRIBE` output.

```yaml
schema_version: 1
models:
  - name: claude-sonnet-4-5
  - name: llama3.1-70b              # or name: '*' for every model the account can use
logging:
  enabled: true                     # false records nothing, whatever else is set
  enable_client_telemetry: true     # accept traces exported by clients
  capture_payload:
    request_response: true          # store prompts and responses: treat the trace table as sensitive
    exclude_tags:
      - governance.tags.payload_capture_exempt     # users tagged with this get metadata-only logging
```

```sql
CREATE TAG IF NOT EXISTS governance.tags.payload_capture_exempt;
ALTER USER hr_director SET TAG governance.tags.payload_capture_exempt = 'true';   -- only direct user tags count
```

## What is GA and what is not

| Part | Status |
|---|---|
| Inference, observability (traces and spans), cost management | Preview 15 Sep, GA 3 Nov 2026; Azure, Google Cloud and AWS New Zealand from 16 Oct |
| Usage metadata: `AI_GATEWAY_USAGE_HISTORY`; budgets and per-user quotas on gateway spend | GA |
| Trace analytics charts in Snowsight | Preview |
| Tools: govern which MCP servers and tools clients reach, with the user's identity | Preview 19 Oct 2026 |
| Guardrails for agents routed through the gateway | Public preview (announced Nov 2026) |
| Cortex Sandboxes, Agent Trace Intelligence, Dynamic Model Routing, Agent Abuse Detection | Private preview (announced Nov 2026) |

Do not confuse it with the Snowflake ML `GATEWAY` object, which splits traffic between your own model-serving endpoints (lesson 33.27).

## Locally: cost attribution from gateway usage

```python
import pandas as pd
usage = pd.DataFrame([   # the shape of gateway usage rows joined to user tags
    ("asha", "engineering", "claude-sonnet-4-5", 1_200_000, 300_000), ("ben", "engineering", "llama3.1-70b", 4_000_000, 900_000),
    ("chen", "analytics", "claude-sonnet-4-5", 600_000, 150_000), ("dev_bot", None, "claude-sonnet-4-5", 9_000_000, 2_500_000),
    ("hr_director", "hr", "llama3.1-70b", 200_000, 40_000)],
    columns=["user", "team", "model", "input_tokens", "output_tokens"])
RATE = {"claude-sonnet-4-5": (1.50, 7.50), "llama3.1-70b": (0.60, 0.60)}   # illustrative credits per million tokens (in, out)

usage["credits"] = [(i * RATE[m][0] + o * RATE[m][1]) / 1e6 for m, i, o in zip(usage.model, usage.input_tokens, usage.output_tokens)]
by_team = usage.fillna({"team": "UNATTRIBUTED"}).groupby("team").credits.sum().sort_values(ascending=False)
print(by_team.round(2).to_string())
print(f"\nunattributed share: {by_team.get('UNATTRIBUTED', 0) / by_team.sum():.0%} -> tag every gateway user, especially service users")
```

The largest line is an untagged service user, which is common: automation runs more tokens than people do. Tag users before you allocate cost, and put automation on its own identity with its own quota (lesson 33.30). The rates here are placeholders; real rates are in Snowflake's Service Consumption Table.

:::check
Which statements are right?

- ✓ `ALTER AI GATEWAY ... FROM SPECIFICATION` replaces the whole specification.
- ✗ Granting `USAGE` on the gateway gives a role access to every model.
  Model access still comes from model RBAC; `USAGE` only allows sending requests through the gateway.
- ✓ Payload capture can be turned off for specific users with an exclusion tag.
:::

:::recap What to keep
- One `SNOWFLAKE` gateway per account; standard request shapes; revoke the PUBLIC default and grant by role.
- The specification controls exposed models, logging, client telemetry and payload capture with tag exemptions.
- Inference, traces and cost GA; Tools, trace analytics and guardrails in preview; sandboxes, trace intelligence and routing in private preview.
:::

## Exercises

1. Write the specification that exposes two models, captures payloads for everyone except users tagged `payload_capture_exempt`, and accepts client traces.
2. Who at Brightwell should have `MONITOR`, given that it reveals every user's traces?
3. Plan the move of one coding agent from its own API key to the gateway, including the cutover check.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Cortex AI Gateway governance quickstart](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/gateway-governance-quickstart) (Cortex AI Cookbook)
- [LangChain agents on Cortex AI Gateway with MCP tools and traces](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/langchain-mcp-agent-tracing) (Cortex AI Cookbook)

:::checked Sources and further reading
- [Cortex AI Gateway](https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-ai-gateway)
- [Build trust in AI agents with governed business context and AI security](https://snowflake.com/en/blog/ai-agents-governance-ai-security-cost-control), Snowflake blog, November 2026
- Snowflake release notes: Cortex AI Gateway (15 Sep, 16 Oct, 3 Nov 2026), Tools for Cortex AI Gateway (19 Oct 2026)
:::
