---
title: Getting AI to People and Tools: Snowflake CoWork, the Managed MCP Server and Cortex AI Gateway
minutes: 55
group: Structured questions and agents
lessons: a1114, a1719
---
:::goals What you will be able to do
- Publish an agent to business users in Snowflake CoWork (formerly Snowflake Intelligence)
- Expose agents, search services and semantic views to external AI clients through a Snowflake-managed MCP server, without bypassing governance
- Point OpenAI- and Anthropic-compatible clients at Cortex AI Gateway, and know when that is the right door
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about 55 minutes.
:::

:::plain The idea in one line
Build the agent once in Snowflake, then choose the door: CoWork for people, an MCP server for AI tools, the AI Gateway for applications that just need a model.
:::

## The problem

Brightwell's returns agent works in a notebook. Store managers want it in a chat app, the engineering team wants the same governed numbers inside their coding assistant, and a partner's chatbot wants to call a model without moving data out. Three audiences, three doors, one governance model.

## Door 1: Snowflake CoWork for people

CoWork is the end-user surface for agents (renamed from Snowflake Intelligence at Summit 2026, with per-user personalised agents, skills, connectors, memory and publishable dashboards called artifacts). Setup, from the getting-started guide: an ACCOUNTADMIN creates the CoWork object, grants usage to an admin role, and agents are created under **AI & ML » Agents** and made available to users with the right roles.

```sql
USE ROLE ACCOUNTADMIN;
CREATE SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;   -- the object keeps its original name
GRANT USAGE ON SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT TO ROLE snowflake_intelligence_admin;
GRANT USAGE ON AGENT support.agents.returns_assistant TO ROLE store_manager;
```

Requests from CoWork are rate-limited separately from the Agents REST API. Resource budgets can cap a CoWork deployment's monthly credits (lesson 33.18).

## Door 2: a Snowflake-managed MCP server for AI tools

The server is a Snowflake object that exposes tools over the Model Context Protocol at `https://<account_url>/api/v2/databases/<db>/schemas/<schema>/mcp-servers/<name>`. Tool types: `CORTEX_AGENT_RUN` (an agent), `CORTEX_SEARCH_SERVICE_QUERY`, `CORTEX_ANALYST_MESSAGE` (a semantic view), `SYSTEM_EXECUTE_SQL` (read-only by default) and `GENERIC` (a UDF or procedure); up to 50 tools. Snowflake's own advice: for governed business questions expose **only the agent**, because putting `SYSTEM_EXECUTE_SQL` on the same server lets clients go around the agent's rules; give direct SQL its own server and a least-privileged role.

```sql
CREATE OR REPLACE MCP SERVER support.mcp.returns_server
  FROM SPECIFICATION $$
  tools:
    - name: "returns-assistant"
      title: "Brightwell returns assistant"
      type: "CORTEX_AGENT_RUN"
      identifier: "support.agents.returns_assistant"
      description: "Answers questions about Brightwell return policies and return numbers."
  $$;
GRANT USAGE ON MCP SERVER support.mcp.returns_server TO ROLE mcp_returns_client;
GRANT USAGE ON AGENT support.agents.returns_assistant TO ROLE mcp_returns_client;
```

Authentication: Snowflake OAuth (recommended; a security integration with `ALLOWED_ROLES_LIST` restricted to the MCP role) or a programmatic access token sent as a bearer header, restricted to the least-privileged role and kept out of shared config files. If the account name contains underscores, use hyphens in the host name.

## Door 3: Cortex AI Gateway for applications

The gateway accepts standard API shapes at `https://<account-host>/api/v2/aigateways/SNOWFLAKE`: `/v1/chat/completions` (OpenAI-compatible, non-Claude models), `/v1/messages` (Anthropic-compatible, Claude models) and `/v1/responses` (OpenAI Responses, preview). Inference stays in the Snowflake perimeter and usage is attributed to the calling user. It needs `USAGE` on the gateway plus model access (lesson 33.2); `DESCRIBE AI GATEWAY SNOWFLAKE` gives the exact endpoint.

```pyshow
from anthropic import Anthropic
client = Anthropic(base_url="https://<account-host>/api/v2/aigateways/SNOWFLAKE", api_key=SNOWFLAKE_OAUTH_TOKEN)  # SDK appends /v1/messages
msg = client.messages.create(model="claude-sonnet-4-5", max_tokens=300,
                             messages=[{"role": "user", "content": "Summarise this return request: ..."}])
```

The gateway gives a model, not Brightwell's data or rules. If the client needs governed answers, use door 2 with the agent.

## Locally: review an MCP server design

```python
SERVERS = {
    "returns_server": {"role": "mcp_returns_client", "tools": [("returns-assistant", "CORTEX_AGENT_RUN", {})]},
    "everything_server": {"role": "sysadmin", "tools": [("returns-assistant", "CORTEX_AGENT_RUN", {}),
                                                        ("sql", "SYSTEM_EXECUTE_SQL", {"read_only": False}),
                                                        ("search", "CORTEX_SEARCH_SERVICE_QUERY", {})]},
}
BROAD_ROLES = {"accountadmin", "sysadmin", "securityadmin"}

def review(name, server):
    findings = []
    types = [t for _, t, _ in server["tools"]]
    if server["role"].lower() in BROAD_ROLES: findings.append(f"runs as broad role {server['role']}: use a least-privileged role")
    if "SYSTEM_EXECUTE_SQL" in types and "CORTEX_AGENT_RUN" in types:
        findings.append("SQL tool beside an agent lets clients bypass the agent's governance: split into two servers")
    for tname, ttype, cfg in server["tools"]:
        if ttype == "SYSTEM_EXECUTE_SQL" and cfg.get("read_only") is False: findings.append(f"{tname}: read_only disabled")
    if len(server["tools"]) > 50: findings.append("more than 50 tools")
    return findings or ["ok"]

for n, srv in SERVERS.items(): print(n, "->", review(n, srv))
```

:::check
Which statements are right?

- ✓ For governed business questions, an MCP server should expose the agent rather than raw SQL.
- ✗ Cortex AI Gateway gives external clients access to Brightwell's governed data.
  It gives access to models; governed data and rules come through an agent or MCP tools.
- ✓ Snowflake CoWork is the 2026 name for Snowflake Intelligence.
:::

:::recap What to keep
- CoWork for people, MCP server for AI tools, AI Gateway for apps that need a model.
- MCP: agent-only servers for governed answers; separate, least-privileged SQL servers.
- OAuth over long-lived tokens; restrict roles at every door.
:::

## Exercises

1. Fix `everything_server` by splitting it into two servers, and rerun the review.
2. Write the security integration for the MCP server with `OAUTH_CLIENT_TYPE` and `ALLOWED_ROLES_LIST`.
3. Decide which door a supplier-portal chatbot should use, and justify it in three sentences.

:::checked Sources and further reading
- [Getting started with Snowflake CoWork](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/getting-started)
- [Snowflake-managed MCP server](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp)
- [Inference with Cortex AI Gateway](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-ai-gateway/inference)
:::
