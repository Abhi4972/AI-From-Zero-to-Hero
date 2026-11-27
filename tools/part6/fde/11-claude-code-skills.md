---
title: Claude Code and Agent Skills for Delivery: Repo Memory, Permissions, Hooks and Packaged Procedures
minutes: 75
group: Building in the customer's environment
lessons: a1433, a1434, a1322
---
:::goals What you will be able to do
- Set up Claude Code in a customer repository with project memory, permission rules and a blocking hook
- Run Claude Code non-interactively in CI with a narrow permission set
- Package a repeatable delivery procedure as an Agent Skill and check it before sharing
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (tooling). **Time**: about 75 minutes.
- **Runs**: the Skill checker and the permission simulator run here; Claude Code itself runs on your machine.
:::

:::plain The idea in one line
Make the coding agent safe and useful in someone else's repository: tell it how the repo works, limit what it may run, block the dangerous things in code, and package the procedures you repeat.
:::

## The problem

An FDE often works in a customer's codebase, under their rules, and hands it back. Claude Code speeds that up a great deal, but only if it knows the repository's conventions, cannot run what the customer forbids, and leaves work the customer's engineers can review. Those are configuration, not luck.

## Project memory: CLAUDE.md

A `CLAUDE.md` at the repository root is read at the start of every session. Keep it short and factual: how to build and test, the conventions reviewers enforce, and what not to touch.

```text
# Harbor claims integration

Build: make build        Test: make test (must pass before any commit)
Python 3.12, ruff + mypy strict. Tests live next to code as test_*.py.
Never edit migrations/ or anything under vendor/.
The policy API client is generated: change api/spec.yaml, then run make gen.
Customer data never leaves this repo; fixtures in tests/fixtures are synthetic.
```

## Permissions and a blocking hook

Permission rules in `.claude/settings.json` (shared through the repo) say what may run without asking, what always asks, and what is denied. Deny rules are checked first, then ask, then allow; the first match wins.

```text
{
  "permissions": {
    "allow": ["Bash(make test)", "Bash(make build)", "Bash(git diff *)", "Bash(git status)"],
    "ask":   ["Bash(git push *)"],
    "deny":  ["Read(./.env)", "Read(./secrets/**)", "Bash(curl *)", "Bash(psql *)"]
  },
  "hooks": {
    "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/no-prod.sh"}]}]
  }
}
```

A `PreToolUse` hook runs before the tool; exiting with code 2 blocks the call and returns the hook's stderr to Claude as the reason. Use hooks for rules too specific for permission patterns, such as "no command may mention the production database host". Organisation-wide rules go in managed settings, which users cannot override.

The simulator below applies the deny → ask → allow order to a few commands, so you can test a rule set before you hand it to a team.

```python
from fnmatch import fnmatch

RULES = {"deny": ["Read(./.env)", "Bash(curl *)", "Bash(psql *)"],
         "ask": ["Bash(git push *)"],
         "allow": ["Bash(make test)", "Bash(git diff *)", "Bash(git status)"]}

def decide(call):
    for verdict in ("deny", "ask", "allow"):
        if any(fnmatch(call, r) for r in RULES[verdict]): return verdict
    return "ask (no rule: default prompts)"

for c in ["Bash(make test)", "Bash(git push origin main)", "Bash(curl https://example.com)", "Read(./.env)", "Bash(rm -rf build)"]:
    print(f"{c:36} -> {decide(c)}")
```

`rm -rf build` matches no rule and falls back to asking. In a headless CI run nobody is there to answer, so the call is refused: exactly the behaviour you want for anything you did not allow on purpose.

## Headless runs in CI

`claude -p "<task>"` runs one task non-interactively, which makes it usable in a pipeline, for example to draft a fix for a failing test and open a pull request for human review. Give CI runs the narrowest allow list and a fixed turn budget, and never a permission mode that skips checks.

## Packaging a procedure as a Skill

A Skill is a folder with a `SKILL.md` (a short YAML header with `name` and `description`, then instructions) plus any scripts or references it needs. Claude loads only the description until the Skill is relevant, so the description must say when to use it. Before sharing a Skill across a customer's teams, check it:

```python
import re

SKILL = """---
name: harbor-claim-field-check
description: Use when reviewing extracted claim fields for Harbor Mutual before they are written to the claims system.
---
# Checking extracted claim fields
1. Run scripts/validate_fields.py on the JSON record.
2. If policy_number fails the HM-123456 pattern, route the claim to a handler; never guess.
3. Dates must be ISO (YYYY-MM-DD); convert dd/mm/yyyy only when the day is above 12.
"""

def check_skill(text, files_present):
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not m: return ["missing YAML header"]
    head = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    problems = []
    name, desc = head.get("name", "").strip(), head.get("description", "").strip()
    if not re.fullmatch(r"[a-z0-9-]{1,64}", name): problems.append("name: lowercase letters, digits and hyphens, at most 64")
    if not desc.lower().startswith("use when"): problems.append("description should say when to use the skill")
    for ref in re.findall(r"scripts/[\w./-]+", m.group(2)):
        if ref not in files_present: problems.append(f"referenced file missing: {ref}")
    return problems or ["ok"]

print(check_skill(SKILL, files_present={"SKILL.md"}))
print(check_skill(SKILL, files_present={"SKILL.md", "scripts/validate_fields.py"}))
```

:::check
Which statements are right?

- ✓ Deny rules are checked before ask and allow rules, so an allow rule cannot carve an exception out of a deny.
- ✗ A rule in CLAUDE.md saying "never read .env" is as strong as a deny rule.
  CLAUDE.md is guidance the model reads; permission rules and hooks are enforced by the harness.
- ✓ A Skill's description decides when it is loaded, so it should say when to use it.
:::

:::recap What to keep
- CLAUDE.md for facts, permissions for limits, hooks for specific blocks, managed settings for policy.
- In CI: headless, narrow allow list, turn budget, human review of the result.
- Package repeated procedures as Skills; check them before sharing.
:::

## Exercises

1. Add a rule set for a read-only "explain this repo" session and test it with the simulator.
2. Write the `no-prod.sh` hook: read the tool input from stdin as JSON, and exit 2 with a reason if the command contains the production host name.
3. Turn the Harbor field-check procedure into a full Skill folder with the validation script and a short reference file of field formats.

:::checked Sources and further reading
- [Configure permissions](https://code.claude.com/docs/en/permissions), Claude Code documentation
- [Hooks reference](https://code.claude.com/docs/en/hooks), Claude Code documentation
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Claude Code 101", "Claude Code in Action" and "Introduction to Agent Skills"
:::
