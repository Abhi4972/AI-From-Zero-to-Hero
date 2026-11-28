---
title: Cortex Agents: Specifications, Tools, Orchestration Instructions, Custom Tools and Threads
minutes: 75
group: Structured questions and agents
lessons: a3009, l0300, l0301
---
:::goals What you will be able to do
- Create an agent object with `CREATE AGENT ... FROM SPECIFICATION`, combining Cortex Analyst, Cortex Search and a custom tool
- Write orchestration and response instructions that make tool choice predictable
- Run the agent over REST with threads, and test tool routing with a golden set before release
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 75 minutes.
:::

:::plain The idea in one line
An agent is a configured object: a model, instructions, and a set of governed tools; most of the work is describing tools so the agent picks the right one, and testing that it does.
:::

## The problem

Brightwell's support agents ask mixed questions: "Can this customer return a used tent, and how many tent returns did we have last month?" One part needs policy text (Search), one needs numbers (Analyst), and some need an action-like lookup (the customer's order status, from a stored procedure). A Cortex Agent plans across them.

## The agent object

```sql
CREATE OR REPLACE AGENT support.agents.returns_assistant
  COMMENT = 'Answers returns questions for Brightwell support staff'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget:
      seconds: 60
      tokens: 32000
  instructions:
    response: "Answer in at most 5 sentences. Cite policy sources. Give numbers with the period they cover."
    orchestration: >
      Use PolicySearch for rules, eligibility and how-to questions.
      Use ReturnsAnalyst for counts, rates, revenue and trends.
      Use OrderStatus only when the user gives an order ID like BW-12345678.
      If a question needs both rules and numbers, call both and answer each part.
    sample_questions:
      - question: "Can a used tent be returned?"
      - question: "What was the tent return rate in October?"
  tools:
    - tool_spec:
        type: "cortex_search"
        name: "PolicySearch"
        description: "Brightwell return, warranty and shipping policies and product manuals. Not for numbers."
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "ReturnsAnalyst"
        description: "Sales, returns, return rates and revenue by product line, region, store and month."
    - tool_spec:
        type: "generic"
        name: "OrderStatus"
        description: "Looks up one order's status, delivery date and return eligibility by order ID."
        input_schema:
          type: object
          properties:
            order_id: {type: string, description: "Order ID, format BW- followed by 8 digits"}
          required: [order_id]
  tool_resources:
    PolicySearch:
      search_service: "support.search.knowledge"
      max_results: 5
    ReturnsAnalyst:
      semantic_view: "retail.semantic.sales_returns"
      execution_environment: {type: warehouse, warehouse: ai_wh}
    OrderStatus:                       # custom-tool keys: confirm against the spec Snowsight generates for your account
      type: procedure
      identifier: "support.tools.order_status"
      execution_environment: {type: warehouse, warehouse: ai_wh}
  $$;
```

Notes from the documentation: the specification can be up to 100,000 bytes; `orchestration.budget` caps time and tokens per request; creation succeeding does not prove the tools are valid, so test before deploying. Custom tools are stored procedures or UDFs; they must return a single value (a `RETURNS TABLE` procedure fails at run time), cannot take `OBJECT` parameters, and results are capped at 32 KB. The exact `tool_resources` keys for custom tools are best generated once from Snowsight's agent editor and then kept in version control (lesson 33.34), because the editor and docs evolve.

Access: callers need `SNOWFLAKE.CORTEX_USER` or `SNOWFLAKE.CORTEX_AGENT_USER`, privileges on the agent, and privileges on every object its tools touch. If a caller lacks access to one tool, the run can continue with the tools it can reach, which is governance working as intended.

## Running it

```pyshow
import requests, json
url = f"https://{ACCOUNT_URL}/api/v2/databases/SUPPORT/schemas/AGENTS/agents/RETURNS_ASSISTANT:run"
body = {"messages": [{"role": "user", "content": [{"type": "text", "text": "Can order BW-20481177 be returned? It's a used tent."}]}],
        "thread_id": thread_id, "parent_message_id": 0}
with requests.post(url, json=body, headers={"Authorization": f"Bearer {TOKEN}", "Accept": "text/event-stream"}, stream=True) as r:
    for line in r.iter_lines():
        if line.startswith(b"event:"): event = line[6:].strip().decode()
        elif line.startswith(b"data:") and event in ("response.text.delta", "response.tool_use", "response"):
            print(event, json.loads(line[5:])["text"] if event == "response.text.delta" else "")
```

The stream emits events such as `response.status`, `response.thinking.delta`, `response.tool_use`, `response.tool_result`, `response.text.delta`, `response.table`, `response.chart` and a final `response`; clients should ignore event types they do not know. Threads keep conversation state on the server. The REST API defaults to 1,000 requests per minute per account (burst 500), shared by all agents.

## Locally: test tool routing before release

The most common agent failure is the wrong tool, or a missing one, for part of a question. Record which tools the agent called on a golden question set (from the traces, lesson 33.24) and score them.

```python
GOLDEN = [   # question -> tools that should be called
    ("Can a used tent be returned?", {"PolicySearch"}),
    ("Tent return rate in October?", {"ReturnsAnalyst"}),
    ("Is order BW-20481177 eligible for return?", {"OrderStatus", "PolicySearch"}),
    ("Who pays shipping for damaged items, and how many damage returns in Q3?", {"PolicySearch", "ReturnsAnalyst"}),
    ("How do I reseal a tent seam?", {"PolicySearch"}),
    ("Revenue by region last month", {"ReturnsAnalyst"}),
]
TRACES = {   # tools actually called, from two versions of the orchestration instructions
    "v1 (no orchestration instructions)": [{"PolicySearch"}, {"ReturnsAnalyst", "PolicySearch"}, {"PolicySearch"},
                                           {"PolicySearch"}, {"PolicySearch"}, {"ReturnsAnalyst"}],
    "v2 (instructions above)":            [{"PolicySearch"}, {"ReturnsAnalyst"}, {"OrderStatus", "PolicySearch"},
                                           {"PolicySearch", "ReturnsAnalyst"}, {"PolicySearch"}, {"ReturnsAnalyst"}],
}
def score(called):
    exact = sum(c == g for c, (_, g) in zip(called, GOLDEN))
    missed = sum(len(g - c) for c, (_, g) in zip(called, GOLDEN))
    extra = sum(len(c - g) for c, (_, g) in zip(called, GOLDEN))
    return {"exact": f"{exact}/{len(GOLDEN)}", "missed_tool_calls": missed, "unneeded_tool_calls": extra}
for name, called in TRACES.items(): print(f"{name:36} {score(called)}")

def lint(spec_tools, resources, instructions):
    issues = [f"tool {t} has no tool_resources entry" for t in spec_tools if t not in resources]
    issues += [f"tool {t} never mentioned in orchestration instructions" for t in spec_tools if t not in instructions]
    return issues or ["spec looks consistent"]
print(lint(["PolicySearch", "ReturnsAnalyst", "OrderStatus"], ["PolicySearch", "ReturnsAnalyst"],
           "Use PolicySearch for rules. Use ReturnsAnalyst for numbers."))
```

Version 1 missed the order lookup and half of a two-part question, and made an unneeded Search call; explicit orchestration instructions fix all of it. Missed calls are worse than extra ones (an incomplete answer looks complete); extra calls cost time and tokens. The lint catches the configuration mistakes that `CREATE AGENT` accepts silently.

:::check
Which statements are right?

- ✓ A successful `CREATE AGENT` does not prove the tool specifications work; test the agent.
- ✗ Custom tools can be any stored procedure, including ones that return tables.
  They must return a single value; `RETURNS TABLE` procedures fail at run time.
- ✓ Tool descriptions and orchestration instructions are the main levers on tool choice.
:::

:::recap What to keep
- `CREATE AGENT ... FROM SPECIFICATION`: models, orchestration budget, instructions, tools, tool_resources.
- Run over REST with threads; handle streaming events defensively.
- Score tool routing on a golden set; lint the spec before release.
:::

## Exercises

1. Add a question that should call no tool ("Hello"). What should the agent do, and how would you score it?
2. Add a `max_results` change to the Search tool and describe how you would know whether it helped.
3. Write the stored procedure signature for `OrderStatus` that respects the custom-tool limits.

:::checked Sources and further reading
- [CREATE AGENT](https://docs.snowflake.com/en/sql-reference/sql/create-agent)
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Create and manage agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-manage)
- [Cortex Agents Run API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-run)
:::
