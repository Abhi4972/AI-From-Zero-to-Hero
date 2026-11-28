---
title: Agent Identity and Containment: SERVICE_AGENT Users, Restricted Session Scope, Token Exchange, Agent-Aware Policies, Data Movement Policies and Multi-Party Approval
minutes: 75
group: Operating AI on Snowflake
lessons: a3329, a3302
---
:::goals What you will be able to do
- Tell delegated agents from autonomous ones, and give autonomous agents their own `SERVICE_AGENT` identity
- Cap what any agent session can do with a Restricted Session Scope, at account, user, session and token level
- Write masking and row policies that treat agents differently from people, limit how much tagged data agents can pull with data movement policies, and protect critical admin changes with Multi-Party Approval
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about 75 minutes.
:::

:::plain The idea in one line
An agent acting for a person inherits everything that person can do; Snowflake now lets you recognise agent sessions, give them a lower ceiling than the person, and show them less data, without changing anyone's roles.
:::

## The problem

A Brightwell finance analyst connected an external coding agent with her own credentials. Her role can read every customer's payment history and run `GRANT`s on the finance schema. The agent could do the same, and the audit log would show only her name.

## Delegated and autonomous agents

| Mode | Whose identity | How Snowflake knows it is an agent |
|---|---|---|
| Delegated | The user's session, marked agent-active | Snowflake-native agents (Cortex Agents, CoCo, CoWork) and the managed MCP server automatically; OAuth integrations with `IS_AGENTIC = TRUE`; OAuth token exchange with actor type `agent` |
| Autonomous | Its own `SERVICE_AGENT` user (GA 23 Jul 2026): non-interactive authentication like `SERVICE` users, workload identity federation including SPIFFE | Every session of that user is agent-active |

```sql
CREATE USER returns_bot TYPE = SERVICE_AGENT DEFAULT_ROLE = returns_bot_role
  COMMENT = 'Autonomous returns triage agent. Owner: support platform.';
-- in any policy or query: is an agent active in this session?
SELECT SYS_CONTEXT('SNOWFLAKE$CURRENT', 'IS_AGENT_ACTIVATED')::BOOLEAN;
```

Audit: `QUERY_HISTORY.agent_type` (`CORTEX_AGENT`, `CORTEX_LITE_AGENT`, `EXTERNAL_AGENT`, NULL for none; July 2026) and `ACCESS_HISTORY.agents_info` (the agent chain, nearest first; August 2026) separate the person from the agent acting for them.

## Restricted Session Scope: a ceiling for agent sessions

A Restricted Session Scope (RSS; GA 3 Sep 2026) is a privilege ceiling that applies only while an agent is active. It intersects with the user's privileges and never grants anything. Privilege groups: data read, data write, object discovery, compute usage, program usage, grant management, object management, full management. Predefined scopes: `SNOWFLAKE$DATA_READ`, `SNOWFLAKE$DATA_READ_WITH_AI`, `SNOWFLAKE$DATA_READ_PROGRAM_USAGE`.

```sql
CREATE RESTRICTED SESSION SCOPE governance.policies.agent_scope AS $$
privilege_scopes:
  allowed_privileges:
    - privileges: [data read, object discovery, program usage]
      account: [all]
    - privileges: [data write]
      databases: [AGENT_SANDBOX]
role_scopes:
  blocked_roles: [ACCOUNTADMIN, SYSADMIN, SECURITYADMIN]
  allow_role_switching: false
$$;
CREATE SESSION POLICY governance.policies.agent_session_policy
  AGENT_RESTRICTED_SESSION_SCOPE = 'governance.policies.agent_scope';
ALTER ACCOUNT SET SESSION POLICY governance.policies.agent_session_policy;                -- everyone's agent sessions
ALTER USER finance_lead SET SESSION POLICY governance.policies.finance_agent_policy;       -- overrides, not merged
```

Levels: an account policy; a user policy that **replaces** it for that user; a user's own narrowing in CoCo (`/guardrails`, or "Restrict this session"; GA 14 Sep 2026); and a scope bound to an exchanged token. When several apply, Snowflake enforces their intersection, and once active in a session the scope cannot be changed or escalated. Check it with `SYS_CONTEXT('SNOWFLAKE$SESSION', 'ACTIVE_RESTRICTED_SESSION_SCOPES')`.

## Showing agents less data

```sql
CREATE OR REPLACE MASKING POLICY governance.policies.email_agent_mask AS (v STRING) RETURNS STRING ->
  CASE WHEN SYS_CONTEXT('SNOWFLAKE$CURRENT', 'IS_AGENT_ACTIVATED')::BOOLEAN THEN '***'   -- agents never see emails
       WHEN IS_ROLE_IN_SESSION('ANALYST') THEN v
       ELSE '***' END;

-- data movement policies (Enterprise Edition; GA 19 Aug 2026): cap rows per operation type on tagged data
CREATE OR REPLACE DATA MOVEMENT RULE governance.policies.pii_agent_guard
  TYPE = 'AGENT_ACCESS'
  MAX_ROWS AS () RETURNS INTEGER -> (0);                 -- 0 blocks; NULL means no limit; n caps rows
CREATE OR REPLACE DATA MOVEMENT POLICY governance.policies.pii_dmp
  ENFORCE_RULES = (governance.policies.pii_agent_guard);
ALTER TAG governance.tags.pii_level SET DATA MOVEMENT POLICY governance.policies.pii_dmp;
```

Data movement rule types: `COPY_INTO_EXTERNAL_STAGE`, `COPY_INTO_INTERNAL_STAGE`, `SNOWSIGHT_UI`, `AGENT_ACCESS`, `UI_DOWNLOAD`, `PROGRAMMATIC_FETCH`. Policies attach through tags (or the account as a baseline), the most specific policy wins per object, and the strictest `MAX_ROWS` across touched columns applies. `ALERT_RULES` allow and alert instead of blocking.

## Multi-Party Approval for the controls themselves

Agent controls are only as strong as the admin who could switch them off. **Multi-Party Approval** (Business Critical Edition; GA 4 Aug 2026) requires named approvers for critical operations, including privileged role grants, MFA changes, session, network and authentication policy changes, OAuth and SCIM integrations, data retention, and `MODIFY_CORTEX_GUARDRAILS`. A blocked statement returns a request ID; the requester justifies, approvers vote (one rejection ends it), and the same SQL is replayed within the window. Requests are recorded in `MULTI_PARTY_APPROVAL_REQUESTS`. Statements in tasks and procedures cannot go through the flow.

## Locally: compute an agent's effective privileges

```python
USER_GRANTS = {"finance_lead": {("data read", "FINANCE"), ("data write", "FINANCE"), ("grant management", "FINANCE"),
                                ("data read", "RETAIL"), ("data write", "AGENT_SANDBOX")}}
ACCOUNT_RSS = {("data read", "*"), ("object discovery", "*"), ("program usage", "*"), ("data write", "AGENT_SANDBOX")}
USER_RSS = {"finance_lead": {("data read", "FINANCE"), ("data read", "RETAIL"), ("data write", "AGENT_SANDBOX")}}
TOKEN_RSS = {("data read", "RETAIL")}              # scope bound to an exchanged token for one app

def allowed(scope, priv, db):
    return (priv, db) in scope or (priv, "*") in scope

def effective(user, agent_active, token_scope=None):
    grants = USER_GRANTS[user]
    if not agent_active: return sorted(grants)
    ceiling = USER_RSS.get(user, ACCOUNT_RSS)        # a user-level policy replaces the account one
    out = {g for g in grants if allowed(ceiling, *g)}
    if token_scope is not None: out = {g for g in out if allowed(token_scope, *g)}
    return sorted(out)

print("human session     :", effective("finance_lead", False))
print("agent session     :", effective("finance_lead", True))
print("agent via token   :", effective("finance_lead", True, TOKEN_RSS))
```

The person keeps every grant; her agent loses `data write` and `grant management` on finance; the app holding the exchanged token can only read retail data. No role changed. The same arithmetic is why a scope must be designed per user group: a user-level policy replaces the account policy rather than adding to it.

:::check
Which statements are right?

- ✓ A Restricted Session Scope can only remove privileges, never add them.
- ✗ A user-level session policy's scope is merged with the account-level scope.
  It overrides the account-level policy for that user.
- ✓ `SYS_CONTEXT('SNOWFLAKE$CURRENT', 'IS_AGENT_ACTIVATED')` lets a masking policy hide data from agents only.
:::

:::recap What to keep
- Delegated agents are marked agent-active; autonomous agents get `SERVICE_AGENT` users; audit with `agent_type` and `agents_info`.
- RSS: a ceiling at account, user, session and token level; intersections; no escalation in-session.
- Agent-aware masking, data movement policies on tags, and Multi-Party Approval over the controls.
:::

## Exercises

1. Write an RSS for CoCo users that allows reads everywhere except the `HR` database and writes only to `AGENT_SANDBOX`.
2. Change the data movement rule to allow agents up to 500 rows of tagged data and alert above 100.
3. Which Brightwell operations should need Multi-Party Approval, and who are the approvers?

:::checked Sources and further reading
- [Agent identity](https://docs.snowflake.com/en/user-guide/agent-identity) and [Restricted Session Scope for agents](https://docs.snowflake.com/user-guide/restricted-session-scope)
- [CREATE RESTRICTED SESSION SCOPE](https://docs.snowflake.com/sql-reference/sql/create-restricted-session-scope)
- [Control what AI agents can do in your Snowflake sessions](https://www.snowflake.com/en/blog/engineering/control-what-ai-agents-can-do-in-your-snowflake-sessions/), Snowflake engineering blog
- [Data movement policies](https://docs.snowflake.com/en/user-guide/data-movement-policies) and [Multi-party Approval](https://docs.snowflake.com/en/user-guide/multi-party-approval)
:::
