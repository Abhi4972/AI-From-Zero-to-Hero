---
title: Access, Model RBAC, Cross-Region Inference and Spend Controls
minutes: 60
group: Foundations: the stack, access and data
lessons: a1725, a1726
---
:::goals What you will be able to do
- Grant exactly the privileges a role needs to call AI functions, specific models and agents
- Decide the cross-region inference setting from data-residency requirements, not by default
- Put budgets and per-user quotas in place before the first large job
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about an hour.
:::

:::plain The idea in one line
Before anyone calls a model, decide who may call which model, where inference may run, and how much they may spend, and write all three down as grants and settings.
:::

## The problem

Brightwell's first AI pilot ran as ACCOUNTADMIN "to save time". It used the largest model for everything, inference silently ran in another region, and the month's AI bill surprised finance. All three are settings, and all three should be decided on day one.

## Layer 1: may this role use AI functions at all?

Calling Cortex AI Functions needs two things: the account-level `USE AI FUNCTIONS` privilege (or a per-function `USE AI FUNCTION <name>` privilege) and one of two database roles. `SNOWFLAKE.CORTEX_USER` covers the AI functions and is also needed for Search, Analyst and Agents. `SNOWFLAKE.AI_FUNCTIONS_USER` is narrower: scalar AI functions only, so not `AI_AGG` or `AI_SUMMARIZE_AGG`, and not Search, Analyst, Agents or fine-tuning. Agents need `SNOWFLAKE.CORTEX_USER` or `SNOWFLAKE.CORTEX_AGENT_USER`, plus privileges on the agent and on every object its tools use.

Mind the defaults: `USE AI FUNCTIONS` and `SNOWFLAKE.CORTEX_USER` are granted to `PUBLIC` out of the box, so every role can call AI functions until you revoke them. A governed account revokes both and grants them to named roles.

```sql
USE ROLE ACCOUNTADMIN;
REVOKE USE AI FUNCTIONS ON ACCOUNT FROM ROLE PUBLIC;                -- remove the default access
REVOKE DATABASE ROLE SNOWFLAKE.CORTEX_USER FROM ROLE PUBLIC;
CREATE ROLE IF NOT EXISTS brightwell_ai_dev;
GRANT USE AI FUNCTIONS ON ACCOUNT TO ROLE brightwell_ai_dev;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE brightwell_ai_dev;
CREATE ROLE IF NOT EXISTS brightwell_tagging;                       -- a pipeline role that only classifies text
GRANT USE AI FUNCTION AI_CLASSIFY ON ACCOUNT TO ROLE brightwell_tagging;
GRANT DATABASE ROLE SNOWFLAKE.AI_FUNCTIONS_USER TO ROLE brightwell_tagging;
GRANT USAGE ON WAREHOUSE ai_wh TO ROLE brightwell_ai_dev;      -- MEDIUM or smaller is enough for AI functions (see the cost lesson)
```

## Layer 2: which models?

Model access is now role-based. Each Cortex model has an object in `SNOWFLAKE.MODELS` and an application role `CORTEX-MODEL-ROLE-<MODEL>`; `CORTEX-MODEL-ROLE-ALL` covers every current and future model. The older account parameter `CORTEX_MODELS_ALLOWLIST` is being deprecated: from August 2026 it can only be set to `'None'`, and Snowflake recommends moving to RBAC. By default, a bootstrap grant gives all models to `PUBLIC`; a careful account revokes it and grants models deliberately.

```sql
CALL SNOWFLAKE.MODELS.CORTEX_BASE_MODELS_REFRESH();                       -- refresh model objects and roles (also runs daily)
SHOW APPLICATION ROLES LIKE 'CORTEX-MODEL%' IN APPLICATION SNOWFLAKE;
CALL SNOWFLAKE.LOCAL.REVOKE_FROM_PUBLIC_APPLICATION_ROLE('APP_ROLE', 'CORTEX-MODEL-ROLE-ALL');   -- a plain REVOKE does not remove it
GRANT APPLICATION ROLE SNOWFLAKE."CORTEX-MODEL-ROLE-LLAMA3.1-70B" TO ROLE brightwell_ai_dev;
ALTER ACCOUNT SET CORTEX_MODELS_ALLOWLIST = 'None';                      -- RBAC only
-- verify as the role itself, without secondary roles
USE ROLE brightwell_ai_dev; USE SECONDARY ROLES NONE;
SELECT AI_COMPLETE('SNOWFLAKE.MODELS."LLAMA3.1-70B"', 'Say hello');
```

ACCOUNTADMIN always has access, so test grants as the real role. Changes reach the Cortex REST API and AI Gateway within about five minutes.

## Layer 3: where may inference run?

Some models are not hosted in every region. `CORTEX_ENABLED_CROSS_REGION` (set only by ACCOUNTADMIN, at account level) decides whether a request may be processed elsewhere. Values: `DISABLED`; a region group such as `AWS_EU`, `AWS_US`, `AZURE_EU`; a cloud such as `AWS_GLOBAL`; or `ANY_REGION`. Stored data stays in the account's region; the prompt and response travel encrypted and are not persisted in the processing region, and there is no egress charge. New organisations created after 9 March 2026 default to `ANY_REGION`, and other accounts inherit a same-cloud geography, so **set it explicitly** if you have residency rules.

```sql
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_EU';     -- Brightwell: EU customer data must stay in EU processing
SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT;
```

## Layer 4: how much may they spend?

From the AI cost governance docs: **budgets** (monthly limits for the account or a group of objects, with notifications and actions; resource budgets for tagged agents, CoWork and Search), **shared resource budgets** for AI features by tagged users, and **per-user quotas**, the only AI control with built-in enforcement, covering AI Functions, Cortex Agents, CoCo, AI Gateway and CoWork. Budget actions can lag by hours; quotas act within minutes.

## A local model of the access check

The decision Snowflake makes on each call can be written as a small function. Modelling it is a good way to review a grant design before applying it.

```python
GRANTS = {   # role -> set of grants (privileges, database roles, model roles)
    "brightwell_ai_dev": {"USE AI FUNCTIONS", "SNOWFLAKE.CORTEX_USER", "CORTEX-MODEL-ROLE-LLAMA3.1-70B", "CORTEX-MODEL-ROLE-CLAUDE-SONNET-4-5"},
    "analyst":           {"USE AI FUNCTIONS", "SNOWFLAKE.AI_FUNCTIONS_USER"},
    "store_manager":     {"SNOWFLAKE.CORTEX_AGENT_USER", "USAGE ON AGENT returns_agent"},
}
MODEL_AVAILABLE_IN = {"llama3.1-70b": {"AWS_EU", "AWS_US"}, "claude-sonnet-4-5": {"AWS_US"}}
ACCOUNT = {"region_group": "AWS_EU", "cross_region": "AWS_EU", "public_has_all_models": False}

AGGREGATES = {"AI_AGG", "AI_SUMMARIZE_AGG"}

def can_call_function(role, model, function="AI_COMPLETE"):
    g = GRANTS.get(role, set())
    if not ({"USE AI FUNCTIONS", f"USE AI FUNCTION {function}"} & g): return False, f"missing USE AI FUNCTIONS (or USE AI FUNCTION {function})"
    if "SNOWFLAKE.CORTEX_USER" not in g:
        if "SNOWFLAKE.AI_FUNCTIONS_USER" not in g: return False, "missing CORTEX_USER or AI_FUNCTIONS_USER"
        if function in AGGREGATES: return False, f"AI_FUNCTIONS_USER does not cover {function}"
    model_role = f"CORTEX-MODEL-ROLE-{model.upper()}"
    if not ({model_role, "CORTEX-MODEL-ROLE-ALL"} & g or ACCOUNT["public_has_all_models"]):
        return False, f"no model access ({model_role})"
    regions = MODEL_AVAILABLE_IN.get(model, set())
    allowed = {ACCOUNT["region_group"]} | ({ACCOUNT["cross_region"]} if ACCOUNT["cross_region"] != "DISABLED" else set())
    if not regions & allowed: return False, f"{model} not available in {sorted(allowed)}"
    return True, "ok"

GRANTS["analyst"].add("CORTEX-MODEL-ROLE-LLAMA3.1-70B")
for role, model, fn in [("brightwell_ai_dev", "llama3.1-70b", "AI_COMPLETE"), ("brightwell_ai_dev", "claude-sonnet-4-5", "AI_COMPLETE"),
                        ("analyst", "llama3.1-70b", "AI_COMPLETE"), ("analyst", "llama3.1-70b", "AI_AGG"),
                        ("store_manager", "llama3.1-70b", "AI_COMPLETE")]:
    print(f"{role:18} {fn:12} {model:18} -> {can_call_function(role, model, fn)}")
```

The analyst can classify and complete but not aggregate, because `AI_FUNCTIONS_USER` excludes the aggregate functions. The store manager cannot call AI functions directly at all, by design: they reach AI only through the agent they were granted. The second line is the residency rule doing its job: the model exists, the role could be granted it, but the account does not allow processing in the US. The answer is a different model, not a looser setting, unless the data owner agrees. (The model availability table here is invented for the exercise; check real availability with `SHOW CORTEX BASE MODELS`.)

:::check
Which statements are right?

- ✓ Testing grants as ACCOUNTADMIN proves nothing, because ACCOUNTADMIN always has model access.
- ✗ `CORTEX_MODELS_ALLOWLIST` is the recommended way to control model access in late 2026.
  It is being deprecated in favour of model RBAC through application roles.
- ✓ Per-user quotas are the AI cost control with built-in enforcement.
:::

:::recap What to keep
- Function access: `USE AI FUNCTIONS` (or per function) plus `CORTEX_USER` or the narrower `AI_FUNCTIONS_USER`; revoke the PUBLIC defaults.
- Model access: application roles per model; revoke the PUBLIC bootstrap grant.
- Set `CORTEX_ENABLED_CROSS_REGION` explicitly; put budgets and per-user quotas in place first.
:::

## Exercises

1. Add a role `data_scientist` that may use every model but only within `AWS_EU`, and test it.
2. Set `public_has_all_models` to True. Which checks stop mattering, and why is that risky?
3. Write the grant script for a store manager who may chat with one agent and nothing else.

:::checked Sources and further reading
- [Model access control](https://docs.snowflake.com/en/user-guide/snowflake-cortex/governance-and-availability/model-access-control)
- [Cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference)
- [AI cost management and governance](https://docs.snowflake.com/en/user-guide/snowflake-cortex/governance-and-availability/ai-cost-management-and-governance)
- [Privileges and model access for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-privileges-and-access)
:::
