---
title: OpenAI's Agent Platform in 2026: AgentKit, Agent Builder, ChatKit, the Agents API, Hosted Computer Use and the Decisions API
minutes: 55
group: 
lessons: l0701, l0702
---
:::goals What you will be able to do
- Tell apart the pieces of OpenAI's agent platform: the Agents SDK, AgentKit, the Agents API and the Decisions API
- Explain what a managed agent session gives you (hosted harness, sandbox, compaction, subagents) and what you still own
- Design approvals correctly for hosted computer use, where approving a website is not approving an action
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about 55 minutes.
:::

:::plain The idea in one line
In 2026 the major vendors stopped selling only models and SDKs and started running the agent loop for you; the engineering question became which parts of the loop you hand over, and where your own checks must stay.
:::

## The problem

You built an agent with the OpenAI Agents SDK and run the loop yourself. A colleague suggests Agent Builder; another says to move to the Agents API so OpenAI hosts everything. They are different products for different jobs, and one of them changes who is responsible for approvals.

## The pieces

| Piece | What it is | Since |
|---|---|---|
| Agents SDK | Open-source library where you run the loop: agents, tools, handoffs, guardrails, sessions, tracing; sandbox agents were added in 2026 | 2025 |
| AgentKit | A product suite: **Agent Builder** (visual canvas for multi-agent workflows), **Connector Registry** (central management of data and tool connections), **ChatKit** (embeddable chat UI), and Evals additions (datasets, trace grading, automated prompt optimisation, third-party models) | DevDay, October 2025 |
| Agents API | Managed cloud agents on the Codex harness, hosted by OpenAI: you create a session with an agent configuration, an environment and a task | Public beta, 2026 |
| Decisions API | A small model picks one answer from a set you define, for classification, routing and next-action choice | Limited preview, autumn 2026 |
| Dots, ChatGPT Space | Persistent agents with ongoing responsibilities; a shared workspace for teams and agents | DevDay 2026 |

An Agents API session takes an `agent` (model, tools, `multi_agent` settings with a cap on concurrent subagents), an `environment` (an OpenAI-hosted sandbox, your own infrastructure, or a sandbox partner), optional vaults for secrets, and the task. Tools are MCP servers, functions and built-ins such as web search; **tool search** loads tool definitions only when needed, **programmatic tool calling** lets the agent call tools from code and filter results before they reach context, and context is **compacted** automatically near the limit. There is no fee beyond tokens and tools. Anthropic's Claude Managed Agents and Google's Agent Engine occupy the same position, so the comparison in this lesson applies to all three.

## Hosted computer use: origin approval is not action approval

With hosted computer use, the agent drives a browser that OpenAI runs. Your application approves each new website **origin** and handles sign-ins. According to OpenAI's guide, approving an origin does not guarantee a confirmation before each consequential action: once the site is approved, the browser may click buy, submit or delete there. If an action needs a person's yes, add your own action-level approval, restrict the agent to pages without such actions, or run a browser you control. After a disconnect, fetch the session's current required actions rather than replaying, or you may repeat a side effect.

Other SDKs gained comparable approval features in 2026: Google ADK's `require_confirmation` before a workflow node, Pydantic AI's `ApprovalReviewer` (a model approves low-risk calls first), and server-wide guardrails on MCP tools in the OpenAI Agents SDK.

## Locally: two approval layers

```python
APPROVED_ORIGINS = {"https://supplier.example"}
CONSEQUENTIAL = {"purchase", "submit_form", "delete", "send_message"}
action_approvals = {("https://supplier.example", "purchase", "PO-1182", 420.00)}   # what a person approved, exactly

def gate(step):
    origin, action = step["origin"], step["action"]
    if origin not in APPROVED_ORIGINS: return "PAUSE: ask the user to approve this origin"
    if action not in CONSEQUENTIAL: return "allow"
    key = (origin, action, step.get("ref"), step.get("amount"))
    return "allow (approved action)" if key in action_approvals else "PAUSE: consequential action needs its own approval"

steps = [{"origin": "https://supplier.example", "action": "read_page"},
         {"origin": "https://supplier.example", "action": "purchase", "ref": "PO-1182", "amount": 420.00},
         {"origin": "https://supplier.example", "action": "purchase", "ref": "PO-1182", "amount": 4200.00},
         {"origin": "https://supplier.example", "action": "delete", "ref": "address-2"},
         {"origin": "https://unknown.example", "action": "read_page"}]
for s in steps: print(f"{s['origin'][8:]:18} {s['action']:12} {str(s.get('amount', '')):8} -> {gate(s)}")
```

The third step is the one that origin approval alone would have let through: same site, same order, ten times the amount. Record what was approved precisely (which order, which amount) and compare before the action runs.

## Which to use

| Situation | Reasonable choice |
|---|---|
| You need full control of the loop, state and deployment | Agents SDK (or another framework), run by you |
| Long-running coding or research tasks, and you accept a managed harness | Agents API or another managed agent service |
| Business teams assembling workflows, with a chat UI | Agent Builder and ChatKit |
| A cheap, typed choice inside a pipeline | Decisions API, or a small model with a strict schema |

A typed decision is evidence for your policy code, not authority to act: the check on who may do what, and within which limits, stays in your code.

:::check
Which statements are right?

- ✓ In hosted computer use, approving an origin does not approve each consequential action on that site.
- ✗ AgentKit is the new name for the Agents SDK.
  AgentKit is a product suite (Agent Builder, Connector Registry, ChatKit, Evals); the SDK is the open-source library.
- ✓ A managed agent session still leaves you responsible for permissions, secrets and action approvals.
:::

:::recap What to keep
- SDK: you run the loop. AgentKit: build and embed. Agents API: OpenAI runs the loop. Decisions API: typed choices.
- Managed sessions bring sandboxes, tool search, compaction and subagents.
- Keep action-level approvals and limits in your own code.
:::

## Exercises

1. Extend `gate` so approvals expire after one use.
2. List what you would lose and gain by moving one of your agents from a self-run loop to a managed session.
3. Which decisions in your pipeline could be a typed choice instead of free text?

:::checked Sources and further reading
- [Introducing the Agents API](https://openai.com/index/introducing-the-agents-api/), OpenAI
- [OpenAI DevDay 2026](https://infoq.com/news/2026/10/openai-devday-2026), InfoQ
- [OpenAI DevDay: ChatGPT Apps, AgentKit and Codex](https://sdtimes.com/ai/openai-devday-chatgpt-apps-agentkit-and-ga-release-of-codex/), SD Times, October 2025
- [OpenAI Decisions API and computer-using agents](https://rohitai.com/blog/openai-decisions-api-agents-computer-use)
:::
