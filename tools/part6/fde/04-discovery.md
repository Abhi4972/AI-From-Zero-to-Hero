---
title: Customer Discovery: Stakeholders, Shadowing and the Problem Worth Paying For
minutes: 60
group: Discovery and scoping
lessons: a1447, a1448
---
:::goals What you will be able to do
- Map sponsor, users, owner, security and IT for an engagement, with what each one needs to say yes
- Run a discovery conversation that ends in a measurable problem statement
- Turn interview notes into ranked pain points with evidence counts
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (customer-facing practice). **Time**: about an hour.
:::

:::plain The idea in one line
Find out who pays, who uses, who owns and who can say no, then watch the work before you believe the description of it.
:::

## The problem

The person who asks for an AI project is rarely the person who does the work, and neither of them is the person who can block it. Harbor Mutual's claims director wants "faster claims"; the handlers want fewer copy-paste steps; IT wants nothing new to support; security wants no customer data leaving approved systems. A plan that satisfies only the director will stall at the other three.

## The stakeholder map

| Role | At Harbor Mutual | What they need to say yes | Typical question |
|---|---|---|---|
| Sponsor (pays, sets the goal) | Claims director | A number that moves (cycle time, cost per claim) | "What will it save?" |
| Users (do the work) | Claims handlers | Less tedious work, no new risk to them | "Will this make my day harder?" |
| Process owner (owns the system after launch) | Claims operations lead | Something they can run and change | "Who fixes it at 2 a.m.?" |
| Gatekeepers | Security, privacy, legal, IT | Evidence the risks are controlled | "Where does the data go?" |
| Your side | Account team, product | A repeatable win | "Can we reuse this?" |

Discovery is complete when each row has a name, and you know what each person needs to say yes.

## Questions that open the problem

Ask about the work, not the AI: *Walk me through the last claim you processed. What did you open first? What did you copy where? What took longest? What went wrong last week? How do you know a claim is done? What does a mistake cost?* Then ask for the number: *how many a day, how long each, how many come back for rework?*

Then **shadow**. FDE teams put it as "become users before you become builders": an hour beside a handler shows steps no one mentions in meetings, such as asking a colleague in chat who owns a policy, or re-keying a date because two systems use different formats.

## From notes to ranked pain points

After five or six conversations you have pages of notes. Tagging each pain with who said it, and counting distinct people rather than mentions, keeps one loud voice from setting the agenda.

```python
from collections import defaultdict

notes = [  # (person, role, pain tag, minutes lost per claim if they gave one)
    ("Ana", "handler", "re-keying policy data", 6), ("Ben", "handler", "re-keying policy data", 5),
    ("Ana", "handler", "re-keying policy data", None),           # same person, same pain: counts once
    ("Chen", "handler", "chasing missing documents", 12), ("Dev", "handler", "chasing missing documents", 9),
    ("Eve", "ops lead", "no visibility of backlog", None), ("Dev", "handler", "photo damage triage", 4),
    ("Fay", "director", "cycle time too long", None), ("Ben", "handler", "chasing missing documents", 10),
]
people, minutes = defaultdict(set), defaultdict(list)
for who, role, pain, mins in notes:
    people[pain].add(who)
    if mins: minutes[pain].append(mins)
rows = sorted(people, key=lambda p: (-len(people[p]), -sum(minutes[p]) / max(1, len(minutes[p]))))
for p in rows:
    avg = sum(minutes[p]) / len(minutes[p]) if minutes[p] else None
    print(f"{p:28} people={len(people[p])}  avg minutes lost={avg if avg is None else round(avg, 1)}")
```

"Chasing missing documents" has three independent voices and the largest time cost: that, not the director's general wish, is the first problem to scope.

## The problem statement

End discovery with one paragraph the sponsor agrees to in writing: *Claims handlers spend about 10 minutes per claim chasing missing documents and 5 re-keying policy data, across roughly 400 claims a day. We will reduce handler time per claim by at least 8 minutes without raising the error rate, measured over a four-week pilot against a two-week baseline.*

:::check
Which statements are right?

- ✓ Counting distinct people per pain stops one loud voice from setting priorities.
- ✗ The sponsor's description of the work is enough to design the system.
  Shadowing finds steps nobody mentions; the description is a hypothesis.
- ✓ Discovery should end with a measurable problem statement the sponsor agrees to.
:::

:::recap What to keep
- Name sponsor, users, owner and gatekeepers, and what each needs to say yes.
- Ask about the last real case, then watch the work.
- End with a problem statement that has a number and a baseline.
:::

## Exercises

1. Add a "severity" field to the notes (minor, blocks the claim) and change the ranking to weight blocking pains double. Does the order change?
2. Write five discovery questions for the security team at Harbor Mutual.
3. Rewrite the problem statement for a different sponsor goal: reducing claims leakage (overpayment) instead of time.

:::checked Sources and further reading
- [The definitive guide to forward deployed engineering](https://nextplayso.substack.com/p/the-definitive-guide-to-forward-deployed), Next Play: "become users before they become builders"
- [Forward deployed engineers](https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers), The Pragmatic Engineer: onsite scoping at OpenAI
:::
