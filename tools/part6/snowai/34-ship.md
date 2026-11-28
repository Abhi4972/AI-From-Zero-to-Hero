---
title: Building and Shipping: Streamlit in Snowflake, Snowflake CLI, Git and CI/CD for AI Objects
minutes: 60
group: Operating AI on Snowflake
lessons: a3039, a3215, a3208
---
:::goals What you will be able to do
- Keep every AI object (search services, semantic views, agents, MCP servers, tasks) as versioned SQL in Git
- Deploy them across development, test and production with Snowflake CLI, and know which changes force a rebuild
- Put a Streamlit in Snowflake front end on an agent, and gate releases on the evaluations from earlier lessons
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
Treat AI objects like code: definitions in Git, deployed by a pipeline, tested before promotion, never edited by hand in production.
:::

## The problem

Brightwell's agent specification lived only in Snowsight. Someone edited the orchestration instructions in production on a Friday; tool routing broke (lesson 33.17's v1 numbers came back); nobody could see what changed or roll back.

## The repository

```text
brightwell-ai/
  sql/
    01_roles_and_grants.sql
    10_stages_and_parsing.sql
    20_search_services.sql          -- CREATE OR REPLACE CORTEX SEARCH SERVICE ...
    30_semantic_views.sql           -- CREATE OR REPLACE SEMANTIC VIEW ...
    40_agents.sql                   -- CREATE OR REPLACE AGENT ... FROM SPECIFICATION $$ ... $$
    50_mcp_servers.sql
    60_tasks.sql
  eval/
    golden_tools.yaml               -- lesson 33.17: question -> expected tools
    golden_answers.csv              -- lesson 33.14 and 33.24
    golden_sql.yaml                 -- lesson 33.16: question -> trusted SQL
  app/streamlit_app.py
  snowflake.yml                     -- Snowflake CLI project definition
```

Parameterise database names (`{{env}}_SUPPORT`) so the same files deploy to each environment. Snowflake CLI (`snow sql -f ...`, `snow streamlit deploy`, `snow git ...`) runs them from a CI job, and a Git repository object in Snowflake can execute files straight from a branch.

## Know what a change costs

Some AI objects cannot be altered in place. A Cortex Search service's `EMBEDDING_MODEL` and `REFRESH_MODE` are fixed at creation, so changing them means `CREATE OR REPLACE`, a full re-index and a short gap unless you build the new service alongside and switch. A model monitor's source and model cannot be changed after creation either (lesson 32.14). Agents and semantic views are cheap to replace, but every replacement is a behaviour change that needs evaluation.

```python
REBUILD_IF_CHANGED = {
    "cortex_search_service": {"embedding_model", "refresh_mode", "search_column"},
    "model_monitor": {"model", "version", "source", "function"},
}
EVAL_IF_CHANGED = {
    "agent": ["tool routing golden set", "answer golden set"],
    "semantic_view": ["execution accuracy on golden SQL"],
    "cortex_search_service": ["retrieval recall@k"],
}
def plan(old, new):
    steps = []
    for name, spec in new.items():
        before = old.get(name)
        if before is None: steps.append(f"CREATE {name}"); continue
        changed = {k for k in spec if spec[k] != before.get(k)}
        if not changed: continue
        kind = spec["kind"]
        if changed & REBUILD_IF_CHANGED.get(kind, set()):
            steps.append(f"BUILD {name}_v2 beside {name}, backfill, evaluate, then switch consumers ({sorted(changed)})")
        else:
            steps.append(f"REPLACE {name} ({sorted(changed)})")
        steps += [f"  gate: {e}" for e in EVAL_IF_CHANGED.get(kind, [])]
    return steps

PROD = {"knowledge": {"kind": "cortex_search_service", "embedding_model": "snowflake-arctic-embed-m-v1.5", "target_lag": "1 hour", "search_column": "chunk"},
        "returns_assistant": {"kind": "agent", "instructions": "v1"},
        "sales_returns": {"kind": "semantic_view", "metrics": "v4"}}
BRANCH = {"knowledge": {"kind": "cortex_search_service", "embedding_model": "snowflake-arctic-embed-l-v2.0", "target_lag": "30 minutes", "search_column": "chunk"},
          "returns_assistant": {"kind": "agent", "instructions": "v2"},
          "sales_returns": {"kind": "semantic_view", "metrics": "v4"},
          "tickets": {"kind": "cortex_search_service", "embedding_model": "snowflake-arctic-embed-l-v2.0", "target_lag": "10 minutes", "search_column": "chunk"}}
for s in plan(PROD, BRANCH): print(s)
```

The plan turns a diff into a release: the embedding-model change becomes a side-by-side build with an evaluation and a switch, the agent change is a replace gated on routing and answer tests, and the unchanged semantic view is left alone.

## A thin front end

```pyshow
# app/streamlit_app.py: a thin chat front end. Agents APIs need the container runtime for Streamlit in Snowflake.
import streamlit as st
from agent_client import run_agent        # your wrapper around POST .../agents/RETURNS_ASSISTANT:run (lesson 33.17)

st.title("Brightwell returns assistant")
if q := st.chat_input("Ask about returns"):
    st.chat_message("user").write(q)
    answer, trace_id = run_agent(q, thread_id=st.session_state.get("thread_id"))
    st.chat_message("assistant").write(answer)
    if st.button("Not helpful"):
        send_feedback(trace_id, positive=False)     # feeds lesson 33.24's loop
```

Keep the app thin: the agent holds the logic, the app holds the conversation and the feedback buttons (which feed lesson 33.24's loop). For most internal users, CoWork (lesson 33.20) removes the need for a custom app at all.

:::check
Which statements are right?

- ✓ Changing a Cortex Search service's embedding model requires recreating the service.
- ✗ Editing an agent's instructions in production is safe because no data changes.
  Instructions change tool routing and answers; release them through tests.
- ✓ Parameterising database names lets the same SQL files deploy to each environment.
:::

:::recap What to keep
- Every AI object as SQL in Git; deploy with Snowflake CLI from CI.
- Know which changes rebuild (search embedding model, monitor source) and build side by side.
- Gate every behaviour change on the golden sets; keep front ends thin.
:::

## Exercises

1. Add a change to `target_lag` only. What does the plan do, and is that right?
2. Write the CI steps (as a list) that run the three golden-set checks against the test environment before production.
3. Decide whether Brightwell needs the Streamlit app or only CoWork, and list what would change your answer.

:::checked Sources and further reading
- [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/introduction/introduction)
- [CREATE CORTEX SEARCH SERVICE](https://docs.snowflake.com/en/sql-reference/sql/create-cortex-search): immutable settings
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents): limits, including Streamlit runtime
:::
