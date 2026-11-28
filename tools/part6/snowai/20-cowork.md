---
title: Snowflake CoWork: Agents for Every Knowledge Worker, Profiles, Artifacts, Deep Research, Automations and Governance
minutes: 60
group: Agent products: CoWork, CoCo, apps and the gateway
lessons: a3317, a3319
---
:::goals What you will be able to do
- Set up CoWork (formerly Snowflake Intelligence) and publish agents to the right people
- Explain each CoWork capability and its status in late 2026, and which ones change what users can do with data
- Govern CoWork: who sees which agents, what automations may do, what it costs, and where usage is recorded
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup and concepts). **Time**: about an hour.
:::

:::plain The idea in one line
CoWork is the place people meet your agents; the agent still decides what data it can reach, but CoWork adds memory, files, schedules and sharing, and each of those needs a governance decision.
:::

## The problem

Brightwell built a good returns agent (lesson 33.17). Store managers still email analysts, because they do not know the agent exists, cannot save an answer, and cannot get a Monday summary without asking every week.

## Setup

CoWork was called Snowflake Intelligence until Summit 2026; the account object kept its name. An ACCOUNTADMIN creates it once, grants an admin role, and publishes agents to roles.

```sql
USE ROLE ACCOUNTADMIN;
CREATE SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;
GRANT USAGE ON SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT TO ROLE cowork_admin;
GRANT USAGE ON AGENT support.agents.returns_assistant TO ROLE store_manager;
```

Users reach CoWork in Snowsight, the iOS app (GA 13 July 2026), Slack, Microsoft Excel and Google Sheets (with CoCo, preview November 2026).

## What CoWork adds to an agent

Statuses from Snowflake's release notes and announcements, as of late November 2026:

| Capability | What it does | Status |
|---|---|---|
| Artifacts | Save and share answers, charts and conversations; viewers see them under their own permissions | GA 17 Jun 2026 |
| Deep Research | Multi-step analysis over structured and unstructured data; can also research the web | GA 7 Jul 2026; web 30 Oct 2026 |
| Analytical search | Narrow thousands of documents with Cortex Search, then count and compare with AI functions and SQL; shows its plan first | Public preview 30 Jun 2026 |
| User memory | Keeps facts and preferences a user shares; users can review and delete them | GA |
| User skills | Save a multistep task from a chat and rerun it by slash command | Preview 18 Aug 2026; announced GA Nov 2026 |
| Automations | Scheduled work as Snowflake tasks, with the same permissions as a live question; action automations list allowed operations | Public preview 6 Aug, GA 11 Sep 2026 |
| Code execution, document generation | Sandbox analysis; PDF, PPTX, DOCX and HTML outputs | Document generation GA 14 Oct 2026 |
| HTML reports, geospatial maps | Narrative reports; maps in answers | Preview Nov 2026 |
| MCP connectors | Organisation-approved connectors (for example Gmail, Drive) for context and actions within the user's permissions | GA |
| Profiles | Admins choose which agents, skills, connectors and instructions each group sees; never widens data access | Announced Nov 2026, limited access |
| Dashboards in CoWork | Chat with CoCo-built dashboards shared by role; row and masking policies still apply | Public preview |
| Cortex AI Guardrails | Prompt-injection and jailbreak detection for CoWork | GA 14 May 2026 (lesson 33.29) |
| Cortex Sense | Builds business context from metadata and usage, ranks it below governed semantic views | Private preview (mid 2026) |
| Snowflake Bots | Goal-owning agents that plan work and report back | Private preview announced |

## Governing CoWork

- **Data**: CoWork never widens access. Answers run under the user's role, and row access and masking policies apply. The agent's tools set the ceiling (lessons 33.17 and 33.29).
- **Reach**: publish agents to roles; use Profiles, where available, to keep each team's list short and relevant.
- **Actions**: automations and connectors that act (send, write) are the risky parts. Approve each action automation like a scheduled job: an owner, the operations it may perform and an end date.
- **Memory and skills** persist user content. Include them in your data-retention and deletion process.
- **Cost**: resource budgets for CoWork (March 2026), per-user quotas, and usage in `SNOWFLAKE.ACCOUNT_USAGE.SNOWFLAKE_INTELLIGENCE_USAGE_HISTORY` (GA 25 Feb 2026). CoWork requests are rate-limited separately from the Agents REST API.

## Locally: an automation review

```python
AUTOMATIONS = [
    {"name": "Monday returns summary", "owner": "ops_lead", "schedule": "weekly", "actions": [], "data": ["returns_view"], "expires": "2027-03-31"},
    {"name": "Auto-refund small claims", "owner": "ops_lead", "schedule": "hourly", "actions": ["issue_refund"], "data": ["orders", "payments"], "expires": None},
    {"name": "Email store managers", "owner": None, "schedule": "daily", "actions": ["send_email"], "data": ["returns_view"], "expires": "2027-01-31"},
]
IRREVERSIBLE = {"issue_refund", "delete_record", "send_email"}

def review(a):
    issues = []
    if not a["owner"]: issues.append("no owner")
    if not a["expires"]: issues.append("no end date")
    risky = IRREVERSIBLE & set(a["actions"])
    if risky: issues.append(f"irreversible actions {sorted(risky)}: needs a person to approve each action")
    if a["schedule"] == "hourly" and a["actions"]: issues.append("acts every hour: check volume limits and quotas")
    return issues or ["approve"]

for a in AUTOMATIONS: print(f"{a['name']:26} -> {review(a)}")
```

Read-only summaries are routine. Anything that sends, pays or deletes needs an owner, an end date and an approval step, because an automation runs unattended with the creator's permissions.

:::check
Which statements are right?

- ✓ CoWork answers run under the user's own role, so masking and row policies still apply.
- ✗ A CoWork Profile can give a team access to data its roles cannot read.
  Profiles choose which agents and tools a group sees; they never widen data access.
- ✓ Automations run with the same permissions as a live question from their creator.
:::

:::recap What to keep
- One object, agents published to roles; surfaces in Snowsight, mobile, Slack, spreadsheets.
- Artifacts, Deep Research, memory, skills, automations, connectors: each persists or acts, so each needs a rule.
- Budgets, quotas and `SNOWFLAKE_INTELLIGENCE_USAGE_HISTORY` for cost and usage.
:::

## Exercises

1. Write the grant script that gives store managers only the returns agent and finance only the margin agent.
2. Add a rule to `review` that flags automations reading tables tagged as personal data.
3. Decide how long Brightwell keeps CoWork memory entries, and how a user's deletion request reaches them.

:::checked Sources and further reading
- [Getting started with Snowflake CoWork](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/getting-started)
- [Snowflake CoWork: from governed insight to proactive work](https://www.snowflake.com/en/blog/snowflake-cowork-profiles-automations-dashboards/), Snowflake blog, November 2026
- [Introducing Cortex Sense](https://www.snowflake.com/en/blog/enterprise-ai-agents-grounded-context/), Snowflake blog
- Snowflake release notes 2026 (CoWork entries from February to November)
:::
