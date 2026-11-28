---
title: Getting AI to People and Tools: the Managed MCP Server, Streamlit, App Runtime and the Choice of Door
minutes: 55
group: Agent products: CoWork, CoCo, apps and the gateway
lessons: a1114, a1719
---
:::goals What you will be able to do
- Choose the right door for each audience: CoWork, CoCo, an MCP server, your own app, a Native App or the AI Gateway
- Expose agents, search services and semantic views to external AI clients through a Snowflake-managed MCP server, without bypassing governance
- Build your own front end with Streamlit in Snowflake or App Runtime, keeping the logic in the agent
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about 55 minutes.
:::

:::plain The idea in one line
Build the agent once in Snowflake, then choose the door: CoWork for people, CoCo for builders, an MCP server for AI tools, your own app or a Native App for customers, the AI Gateway for applications that just need a model.
:::

## The problem

Brightwell's returns agent works in a notebook. Store managers want it in a chat app, the engineering team wants the same governed numbers inside their coding assistant, and a partner's chatbot wants to call a model without moving data out. Three audiences, three doors, one governance model.

## The doors at a glance

| Door | For | Lesson |
|---|---|---|
| Snowflake CoWork | Business users: chat, artifacts, automations | 33.20 |
| Snowflake CoCo | Developers and data teams | 33.21 |
| A Snowflake-managed MCP server | External AI clients that need governed answers | this lesson |
| Streamlit in Snowflake and App Runtime | Your own application, inside the account | this lesson |
| A Native App | Customers in their own accounts | 33.22 |
| Cortex AI Gateway | Applications and coding agents that need models, not your data | 33.23 |

## A Snowflake-managed MCP server for AI tools

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

Authentication: Snowflake OAuth (recommended; External OAuth and configurable scopes are GA from 22 Jul 2026; a security integration with `ALLOWED_ROLES_LIST` restricted to the MCP role) or a programmatic access token sent as a bearer header, restricted to the least-privileged role and kept out of shared config files. If the account name contains underscores, use hyphens in the host name. Sessions through the managed MCP server are marked agent-active, so agent-aware policies and session scopes apply (lesson 33.30); background runs and async tools were added on 4 Nov 2026.

## Your own application: Streamlit and App Runtime

- **Streamlit in Snowflake** runs apps next to the data with the viewer's or owner's rights; 2026 added the container runtime (GA 9 Mar), development in Workspaces (GA 1 Jun), sharing with individual users and embedding in other portals (announced GA), restricted caller's rights (preview Feb), and automatic MCP exposure of an app's functions as agent tools (public preview).
- **App Runtime** (GA 1 Sep 2026) goes further: a full-stack web app (React, Next.js) deployed inside the account with SSO, RBAC and audit logging; serverless scale-to-zero compute and Workspaces development are in preview from 19 Nov 2026.
- The app calls the agent (lesson 33.17) or the Agent SDK (lesson 33.18) and holds only the conversation and the feedback buttons.

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
- ✓ An app built on App Runtime or Streamlit should call the agent rather than reimplement its rules.
:::

:::recap What to keep
- CoWork for people, CoCo for builders, MCP server for AI tools, Streamlit or App Runtime for your own app, Native Apps for customers, AI Gateway for model calls.
- MCP: agent-only servers for governed answers; separate, least-privileged SQL servers.
- OAuth over long-lived tokens; restrict roles at every door.
:::

## Exercises

1. Fix `everything_server` by splitting it into two servers, and rerun the review.
2. Write the security integration for the MCP server with `OAUTH_CLIENT_TYPE` and `ALLOWED_ROLES_LIST`.
3. Decide which door a supplier-portal chatbot should use, and justify it in three sentences.

:::checked Sources and further reading
- [Snowflake-managed MCP server](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp)
- Snowflake release notes 2026: Streamlit in Snowflake container runtime (9 Mar), App Runtime (1 Sep, 19 Nov), External OAuth and scopes for MCP servers (22 Jul), managed MCP server background runs (4 Nov)
:::
