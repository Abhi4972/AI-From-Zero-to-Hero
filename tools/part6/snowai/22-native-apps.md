---
title: AI in Snowflake Native Apps: Shipping Cortex Agents and MCP Servers, Caller Grants and Restricted Caller's Rights
minutes: 50
group: Agent products: CoWork, CoCo, apps and the gateway
lessons: a3317, a3319
---
:::goals What you will be able to do
- Package a Cortex Agent and a managed MCP server inside a Snowflake Native App
- Explain how restricted caller's rights and `GRANT CALLER` decide what an app's agent can read in a consumer account
- Review an app's agent before installing it, as a consumer
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 50 minutes.
:::

:::plain The idea in one line
An app's agent runs in the consumer's account but sees nothing of the consumer's data until the consumer's admin says so, object by object.
:::

## The problem

A software vendor wants to sell Brightwell a "returns intelligence" app with its own agent. Brightwell's security team asks: what will the vendor's agent be able to read, and can it go beyond what the user asking the question can see?

## Agents and MCP servers in an app

Cortex Agents and MCP servers in Native Apps became generally available on 7 August 2026, code execution tools for app agents followed on 1 September, and Cortex AI usage appears in Native App usage history (October 2026). The provider creates the agent in the setup script (or at runtime) and exposes it through an application role.

```sql
-- provider: setup script
CREATE OR REPLACE AGENT core.returns_agent FROM SPECIFICATION $$ ... $$;   -- tool identifiers resolve at use time
GRANT USAGE ON AGENT core.returns_agent TO APPLICATION ROLE app_public;
CREATE MCP SERVER core.returns_mcp FROM SPECIFICATION $$ ... $$;          -- app-owned tools only; no SYSTEM_EXECUTE_SQL

-- consumer: after reviewing it with DESC AGENT
GRANT APPLICATION ROLE returns_app.app_public TO ROLE store_manager;
GRANT CALLER SELECT ON TABLE retail.core.returns TO APPLICATION returns_app;
SHOW CALLER GRANTS TO APPLICATION returns_app;
```

## The two-key rule

App agents run under **restricted caller's rights**. A tool call on a consumer object succeeds only if both keys turn:

1. the **user** asking has the privilege on the object, and
2. the consumer admin has issued a **caller grant** of that privilege to the app.

App-owned objects carry implicit caller grants. Chained restricted-caller tools combine their restrictions, so access only narrows. Two exceptions to know: a tool running with owner's rights switches to the owner's identity and the restriction does not apply inside it, and sandbox tools (`code_execution`, `code_toolset_all`) need caller grants to mount workspaces or read data. Owner's-rights agents are not supported in apps.

Event logs redact app-initiated agent content; event sharing defaults to `AI_METADATA`, and the consumer must approve `AI_CONTENT` before the provider sees prompts and answers.

## Locally: evaluate the two keys

```python
USER_PRIVS = {"store_manager": {("SELECT", "retail.core.returns"), ("SELECT", "retail.core.orders")},
              "analyst": {("SELECT", "retail.core.returns"), ("SELECT", "retail.core.customers")}}
CALLER_GRANTS = {("SELECT", "retail.core.returns"), ("SELECT", "retail.core.customers")}
APP_OWNED = {"returns_app.core.policies"}

def app_tool_can_read(user, obj, tool_rights="restricted_caller"):
    if obj in APP_OWNED: return True, "app-owned object"
    if tool_rights == "owner": return None, "owner's-rights tool: restriction does not apply, review the procedure"
    has_user = ("SELECT", obj) in USER_PRIVS.get(user, set())
    has_caller = ("SELECT", obj) in CALLER_GRANTS
    reason = "both keys" if has_user and has_caller else ("missing caller grant" if has_user else "user lacks privilege")
    return has_user and has_caller, reason

for user, obj in [("store_manager", "retail.core.returns"), ("store_manager", "retail.core.orders"),
                  ("store_manager", "retail.core.customers"), ("analyst", "retail.core.customers"),
                  ("analyst", "returns_app.core.policies")]:
    print(f"{user:14} {obj:28} -> {app_tool_can_read(user, obj)}")
print("owner's-rights tool:", app_tool_can_read("store_manager", "retail.core.customers", "owner"))
```

The store manager can read orders but the app cannot read them on her behalf (no caller grant); the analyst's access to customers passes through because Brightwell granted it. The last line is the one to look for when reviewing an app: any owner's-rights tool is outside this model and needs its own review.

:::check
Which statements are right?

- ✓ An app agent can read a consumer table only if the user has the privilege and the app has a caller grant.
- ✗ Providers see consumers' prompts and answers in event logs by default.
  App-initiated agent content is redacted; `AI_CONTENT` sharing needs the consumer's approval.
- ✓ Caller grants are reviewed with `SHOW CALLER GRANTS`.
:::

:::recap What to keep
- Agents and MCP servers ship in apps (GA August 2026); consumers grant application roles to their roles.
- Restricted caller's rights: user privilege and caller grant, both required.
- Review `DESC AGENT`, owner's-rights tools and event sharing before installing.
:::

## Exercises

1. Write the minimal caller grants for the returns app to answer "how many tents were returned last month?".
2. List three questions Brightwell's security review should ask any app that includes `code_toolset_all`.
3. Why can an app's MCP server not include `SYSTEM_EXECUTE_SQL`? What would go wrong if it could?

:::checked Sources and further reading
- [Use Cortex Agents and MCP servers in an app](https://docs.snowflake.com/en/developer-guide/native-apps/agents-mcp-servers)
- Snowflake release notes: Native Apps Cortex Agents and MCP servers (7 Aug 2026), code execution tools (1 Sep 2026)
:::
