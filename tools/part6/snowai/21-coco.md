---
title: Snowflake CoCo: the Coding Agent for Data, Its Surfaces, Skills, Cloud Agents, Automations and Admin Controls
minutes: 60
group: Agent products: CoWork, CoCo, apps and the gateway
lessons: a3318, a1719
---
:::goals What you will be able to do
- Explain where CoCo (formerly Cortex Code) runs and what each surface is for
- Use skills, plugins, agent profiles and memory to make CoCo work your team's way
- Put CoCo's admin controls in place: per-surface daily limits, quotas, session scopes, managed settings and usage reporting
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup and concepts). **Time**: about an hour.
:::

:::plain The idea in one line
CoCo is a coding agent that already knows your Snowflake account; that makes it fast and also means its limits must be set by the account, not by each user's good intentions.
:::

## The problem

Brightwell's data engineers used CoCo for a month with default settings. It was very productive. It also ran under engineers' broadest roles, nobody could say what it cost per team, and one engineer's long unattended session used more credits than the rest of the team combined.

## Surfaces

| Surface | What it is for | Status (2026) |
|---|---|---|
| CLI | Terminal agent beside local code and Git | GA 2 Feb |
| Snowsight, and CoCo mode | In-account agent; CoCo mode is the full-screen Cloud Agents workspace with shell, files, Git and live preview | Snowsight GA 9 Mar; Cloud Agents announced GA Nov |
| CoCo Desktop | Desktop app: agent window, split panes, artifacts, browser tools, plan mode | GA 21 Jul; v2.0 17 Nov, v2.1 23 Nov |
| VS Code extension | CoCo in the Snowflake extension | GA 27 Aug |
| Excel and Google Sheets | Governed AI in spreadsheets | Preview 3 Nov |
| Mobile, Slack, GitHub | Steer cloud sessions and approve tool calls by phone; ask in Slack; changes through pull requests | iOS GA; Slack and GitHub previews |
| Cortex Agent SDK, Coding Agent | CoCo's engine inside your own application (lesson 33.18) | GA |

Recent capabilities: **automations** that run on a schedule, event or webhook as their creator with an audit trail (GA 2 Nov 2026); **Auto mode**, where a classifier approves routine actions (preview 17 Nov 2026); **subagents**; **memory** scoped to a project (public preview); and **model tiers**: Auto-intelligent keeps every step on the most capable approved model, Auto-efficient routes simpler steps to cheaper approved models (public preview).

## Making CoCo work your way

- **Skills** package instructions and scripts for a task (Snowflake ships skills for data science and ML, interactive analytics, continuous and bulk loading, Tableau-to-Streamlit conversion and security work). **Plugins** bundle skills and tools. Sharing by link or publishing to the Snowsight catalog is GA (22 Oct 2026), with admin certification and version pinning; CoCo also suggests skills to create and share (November 2026).
- **Agent profiles** set a team's default model, skills, tools and context.
- **Project instructions**: like other coding agents, CoCo reads project instruction files in the repository, so conventions live with the code.
- **MCP connectors** bring other tools in; admins can manage them centrally through Cortex AI Gateway Tools (lesson 33.23).

## Admin controls

```sql
-- per-surface daily limits on estimated credits, rolling 24 hours; -1 (default) = unlimited, 0 = blocked
ALTER ACCOUNT SET CORTEX_CODE_CLI_DAILY_EST_CREDIT_LIMIT_PER_USER = 20;
ALTER ACCOUNT SET CORTEX_CODE_DESKTOP_DAILY_EST_CREDIT_LIMIT_PER_USER = 20;
ALTER ACCOUNT SET CORTEX_CODE_SNOWSIGHT_DAILY_EST_CREDIT_LIMIT_PER_USER = 10;
ALTER USER lead_engineer SET CORTEX_CODE_CLI_DAILY_EST_CREDIT_LIMIT_PER_USER = 40;   -- user overrides account
```

| Control | What it does |
|---|---|
| Access | `SNOWFLAKE.CORTEX_USER` (or `CORTEX_AGENT_USER`) plus a non-zero limit; `CORTEX_USER` is granted to PUBLIC by default (lesson 33.2) |
| Daily limits per surface | The three parameters above |
| Per-user quotas | Daily, weekly or monthly credit limits that block or run a procedure at the limit (lesson 33.32) |
| Budgets | Team or cost-centre allocation, evaluated periodically |
| Restricted Session Scope | A privilege ceiling for agent sessions, set by admins or narrowed by users with `/guardrails` (lesson 33.30) |
| Managed settings via MDM | Organisation policy pushed to every installation, including allowed models (preview 5 Oct 2026) |
| CoCo Admin in Snowsight | Central admin page (preview, server release 10.40) |
| Guardrails | Prompt-injection detection for CoCo (GA 20 Apr 2026) |
| Usage | `SNOWFLAKE_COCO_USAGE_HISTORY` in Account Usage and Organization Usage (GA 17 Aug 2026); the AI Governance page (lesson 33.31) |

## Locally: who would hit the limit

```python
import pandas as pd
usage = pd.DataFrame([   # estimated credits per user per surface over the last 24 hours
    ("asha", "CLI", 6.5), ("asha", "SNOWSIGHT", 2.0), ("ben", "CLI", 18.0), ("ben", "DESKTOP", 9.5),
    ("chen", "DESKTOP", 24.0), ("dev_bot", "CLI", 55.0), ("lead_engineer", "CLI", 31.0)],
    columns=["user", "surface", "credits_24h"])
ACCOUNT = {"CLI": 20, "DESKTOP": 20, "SNOWSIGHT": 10}
USER = {("lead_engineer", "CLI"): 40}

def limit(user, surface):
    v = USER.get((user, surface), ACCOUNT.get(surface, -1))
    return None if v == -1 else v

usage["limit"] = [limit(u, s) for u, s in zip(usage.user, usage.surface)]
usage["blocked"] = [(l is not None) and c >= l for c, l in zip(usage.credits_24h, usage["limit"])]
print(usage.to_string(index=False))
print("\nblocked:", usage[usage.blocked][["user", "surface"]].values.tolist())
```

Two findings: `chen` is blocked on Desktop only and can keep working in the CLI, because limits are per surface; and `dev_bot` is a service account running CoCo unattended, which belongs in a `SERVICE_AGENT` user with its own session scope and quota (lesson 33.30), not in a person-sized daily limit.

:::check
Which statements are right?

- ✓ CoCo daily limits are set per surface, so a user blocked on one surface can still use another.
- ✗ The default for the daily limit parameters blocks CoCo until an admin enables it.
  The default is -1, unlimited; 0 blocks.
- ✓ Shared skills can be certified and version-pinned by admins.
:::

:::recap What to keep
- Surfaces: CLI, Snowsight and Cloud Agents, Desktop, VS Code, spreadsheets, mobile, Slack, SDK.
- Skills, plugins, profiles, memory and project instructions shape behaviour; share and certify them centrally.
- Limits per surface, quotas, budgets, session scopes, MDM and `SNOWFLAKE_COCO_USAGE_HISTORY` before broad rollout.
:::

## Exercises

1. Set limits for three Brightwell groups (analysts, engineers, platform team) and justify each number.
2. Write a query that totals CoCo credits per tagged team for last month from the usage view.
3. Which Brightwell tasks should be skills shared to everyone, and which should stay personal?

:::checked Sources and further reading
- [Daily credit usage limits for CoCo](https://docs.snowflake.com/en/user-guide/cortex-code/credit-usage-limit) and [Cost controls for CoCo](https://docs.snowflake.com/en/user-guide/cortex-code/cost-controls)
- [Snowflake CoCo: agentic development on data without limits](https://www.snowflake.com/en/blog/snowflake-coco-cloud-agents-automations/), Snowflake blog, November 2026
- [Governed AI for every builder: enterprise controls in Snowflake CoCo](https://www.snowflake.com/en/blog/governed-ai-enterprise-controls-snowflake-coco), Snowflake blog
- Snowflake release notes 2026 (CoCo entries)
:::
