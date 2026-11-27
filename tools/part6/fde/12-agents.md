---
title: Agents on Claude: the Agent SDK, Step Budgets and Stop Reasons
minutes: 75
group: Building in the customer's environment
lessons: a1401, a1513, a1515
---
:::goals What you will be able to do
- Build an agent on the Claude Agent SDK with custom tools and an explicit permission policy
- Bound an agent with turn, cost and time budgets, and make it stop with a reason a person can read
- Test an agent's control loop offline with a scripted model before connecting the real one
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 75 minutes.
- **Runs**: the scripted agent loop runs here; the Agent SDK example is shown, not run.
:::

:::plain The idea in one line
An agent is a loop that picks a tool, runs it and looks again; in a customer deployment the loop's limits matter as much as its intelligence.
:::

## The problem

Harbor Mutual's intake agent reads an email, looks up the policy, creates a draft claim and proposes a document request. Most emails take four or five steps. Some never resolve: a policy number that does not exist, an email in a language the team does not handle, an attachment that will not open. Without limits, the agent loops, spends money and produces nothing; with good limits, it stops early and tells a handler exactly why.

## On the Agent SDK

The Claude Agent SDK gives you the same harness Claude Code uses: the loop, tool calling, permissions and sessions. You add tools (as an in-process MCP server) and a policy.

```pyshow
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, tool, create_sdk_mcp_server, AssistantMessage, ResultMessage, TextBlock
import adapter     # the validated, audited tool functions built earlier

@tool("get_policy", "Read-only policy lookup by number like HM-123456", {"policy_number": str})
async def get_policy(args):
    return {"content": [{"type": "text", "text": str(adapter.get_policy(args["policy_number"]))}]}

@tool("propose_customer_email", "Queue an email to the claimant for handler approval; never sends", {"claim_id": str, "body": str})
async def propose(args):
    return {"content": [{"type": "text", "text": str(adapter.propose_customer_email(args["claim_id"], args["body"]))}]}

claims = create_sdk_mcp_server(name="claims", tools=[get_policy, propose])

async def run(email_text):
    options = ClaudeAgentOptions(
        system_prompt="You process Harbor Mutual claim emails. Use the claims tools only. If you cannot finish, say why.",
        mcp_servers={"claims": claims},
        allowed_tools=["mcp__claims__get_policy", "mcp__claims__propose_customer_email"],
        max_turns=8,
    )
    async for message in query(prompt=email_text, options=options):
        if isinstance(message, ResultMessage):
            return message.subtype, message.result
```

`allowed_tools` pre-approves the listed tools; it does not, by itself, remove others, so pair it with a deny list or a restrictive permission mode for anything the agent must never touch.

## The loop and its limits, tested offline

Before spending tokens, test the control loop with a scripted "model" that returns the decisions you want to exercise: a normal run, a run that loops, and a run that hits a tool error.

```python
import time

def run_agent(script, tools, max_turns=6, max_cost=0.50, max_seconds=30, cost_per_turn=0.04):
    t0, spent, seen, trace = time.time(), 0.0, set(), []
    for turn, step in enumerate(script, 1):
        spent += cost_per_turn
        if turn > max_turns:                 return "stopped: turn budget", trace
        if spent > max_cost:                 return "stopped: cost budget", trace
        if time.time() - t0 > max_seconds:   return "stopped: time budget", trace
        if step["type"] == "final":          return "done: " + step["text"], trace
        key = (step["tool"], tuple(sorted(step["args"].items())))
        if key in seen:                      return f"stopped: repeated call {step['tool']}{step['args']}", trace
        seen.add(key)
        try:
            out = tools[step["tool"]](**step["args"])
            trace.append((step["tool"], step["args"], "ok"))
        except Exception as e:
            trace.append((step["tool"], step["args"], f"error: {e}"))
    return "stopped: model gave no final answer", trace

TOOLS = {"get_policy": lambda policy_number: {"HM-482913": "active"}.get(policy_number) or (_ for _ in ()).throw(KeyError("no such policy")),
         "create_draft": lambda policy_number: f"DR-{policy_number[-4:]}"}
normal = [{"type": "tool", "tool": "get_policy", "args": {"policy_number": "HM-482913"}},
          {"type": "tool", "tool": "create_draft", "args": {"policy_number": "HM-482913"}},
          {"type": "final", "text": "draft DR-2913 created; repair estimate requested"}]
looping = [{"type": "tool", "tool": "get_policy", "args": {"policy_number": "HM-000001"}}] * 3
for name, script in [("normal", normal), ("looping", looping)]:
    result, trace = run_agent(script, TOOLS)
    print(f"{name:8} {result}")
    for t in trace: print("        ", t)
```

The looping run stops at the second identical call, with a reason a handler can act on ("the policy number is wrong"), instead of burning the turn budget. Repeated identical calls are the most common loop in tool-using agents; detecting them is cheap.

## Stop reasons are part of the product

Every run should end in one of a small set of states, each with a next step: **done** (proposal queued), **needs a human** (missing or contradictory facts, with the question to ask), **refused by policy** (an action outside the agent line), **budget exhausted** (with what was done so far). The review queue shows these states; handlers learn to trust an agent that says clearly when it could not finish.

:::check
Which statements are right?

- ✓ Testing the loop with a scripted model finds control bugs without spending tokens.
- ✗ A higher turn limit always makes an agent more reliable.
  It mostly lets failing runs cost more; detect loops and stop with a reason instead.
- ✓ `allowed_tools` pre-approves tools; blocking others needs a deny rule or a restrictive mode.
:::

:::recap What to keep
- Agent SDK = Claude Code's harness for your own agents: tools as MCP, explicit policy.
- Budgets on turns, cost and time; detect repeated calls.
- A small, explicit set of stop states, each with a next step for a person.
:::

## Exercises

1. Add a script where the tool errors once and succeeds on a retry with a corrected argument. Should that count as a repeated call?
2. Make `run_agent` return the partial work (what was created) with every "stopped" result.
3. Write the review-queue text for each stop state, in words a claims handler would use.

:::checked Sources and further reading
- [Agent SDK reference for Python](https://code.claude.com/docs/en/agent-sdk/python), Claude documentation
- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), Anthropic engineering
:::
