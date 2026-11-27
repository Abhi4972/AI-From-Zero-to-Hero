---
title: Choosing the Claude Entry Point, Model and Features for a Use Case
minutes: 60
group: The role and the engagement
lessons: a1109, a1114, a1322
---
:::goals What you will be able to do
- Choose between Claude apps and Enterprise, Claude Code, the Claude API and the Agent SDK for a given use case
- Pick a model tier and effort level from the task's needs, not habit
- Decide which platform features (tools, caching, batch, files, citations, MCP, Skills) a design needs
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (platform decisions). **Time**: about an hour.
:::

:::plain The idea in one line
Four decisions set the ceiling on quality before you write a prompt: where people meet Claude, which model, which features, and what goes into its context.
:::

## The problem

Teams often start with "let's call the API" and later discover the users live in Slack, the data sits behind a connector that already exists, or a chat product with a shared project would have solved half the problem on day one. Choosing the entry point first, then the model, then features, then context, saves rebuilding.

## Decision 1: the entry point

| Entry point | Who uses it | Good for | You build |
|---|---|---|---|
| Claude apps and Claude Enterprise (projects, connectors, skills) | Knowledge workers | Assisted work where a person stays in the loop; fastest time to value | Configuration, connectors, skills, training |
| Claude Code | Engineers, and automation in CI | Software work in repositories; scripted, verified changes | Repository memory, permissions, hooks, skills |
| Claude API (Developer Platform) | Your application | A step inside an existing system or product; full control of prompts, tools, data | The application around the model |
| Claude Agent SDK | Your application | Long-running agents with Claude Code's harness: tools, permissions, subagents, sessions | The agent's tools, policies and host |

A useful rule: **start at the highest-level entry point that meets the requirement**, and move down only when you need control it cannot give. A claims handler drafting replies may be fully served by a shared project with the right connectors; automatic intake of 3,000 emails a day into a claims system needs the API or the Agent SDK.

## Decision 2: the model and effort

Current models, from the Claude documentation (November 2026): Claude Haiku 5.5 is the fastest and cheapest, Claude Sonnet 5.5 is fast with strong quality, Claude Opus 5.5 is built for long-running agentic and knowledge work, and Claude Fable 5.2 is the most capable and most expensive. All four have a 1M-token context window and up to 128K output tokens. Thinking is adaptive; you steer depth with the effort parameter rather than a token budget.

The habit to build: **pick by measured quality on your eval set, then by cost and latency**, not by brand. Route easy, high-volume steps (classifying an email) to a small model and keep the strongest model for the steps where errors are expensive.

## Decision 3: the features

```python
def features_for(use_case):
    need = []
    if use_case["acts_on_systems"]:              need.append("tool use (and MCP servers for reusable connectors)")
    if use_case["shared_long_prefix"]:           need.append("prompt caching for the shared instructions and documents")
    if not use_case["needs_answer_now"]:         need.append("Message Batches API (half price, results within 24 hours)")
    if use_case["answers_must_cite_documents"]:  need.append("citations, with documents passed as content blocks")
    if use_case["documents_are_files"]:          need.append("Files API or PDF support for the source documents")
    if use_case["repeatable_procedure"]:         need.append("an Agent Skill that packages the procedure")
    if use_case["output_feeds_a_system"]:        need.append("structured outputs against a JSON schema")
    return need

harbor_intake = dict(acts_on_systems=True, shared_long_prefix=True, needs_answer_now=False,
                     answers_must_cite_documents=True, documents_are_files=True,
                     repeatable_procedure=True, output_feeds_a_system=True)
for f in features_for(harbor_intake):
    print("-", f)
```

Overnight claim intake needs almost every feature, and batch pricing halves its model cost because no one is waiting for the answer.

## Decision 4: the context

What the model sees decides most of what it can do. For each request, list what goes in: instructions, the customer's policies, the documents for this case, tool results, examples of good output. Then ask what must never go in (another customer's data, secrets, fields the user may not see). Lesson 31.10 covers retrieval and permissions in detail.

:::check
Which statements are right?

- ✓ Start at the highest-level entry point that meets the requirement and move down only for control you need.
- ✗ Always use the most capable model so quality is never the problem.
  Choose by measured quality on your evals, then cost and latency; route easy, high-volume steps to smaller models.
- ✓ Work that does not need an answer immediately is a candidate for the Batches API.
:::

:::recap What to keep
- Entry point, model, features, context: decide them in that order.
- Pick models by your eval results, then price and speed.
- Caching, batching and routing are design decisions, not afterthoughts.
:::

## Exercises

1. Run `features_for` for a live phone-support assistant (answers now, no documents to cite). Which features drop out, and which new requirement (latency) appears that the function does not model?
2. For Harbor Mutual, write one sentence each for the four decisions.
3. Name a use case where Claude Enterprise with connectors beats a custom API build, and one where it does not.

:::checked Sources and further reading
- [Claude Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview) (model IDs, context, comparison table)
- [Claude Code permissions](https://code.claude.com/docs/en/permissions) and [hooks](https://code.claude.com/docs/en/hooks)
- [Agent SDK for Python](https://code.claude.com/docs/en/agent-sdk/python)
:::
