---
title: The FDE Engagement Lifecycle, from First Call to Handover
minutes: 50
group: The role and the engagement
lessons: a1453, a1454
---
:::goals What you will be able to do
- Name the stages of an FDE engagement and the exit test for each
- Plan an engagement backwards from the handover date
- Spot the four places engagements usually stall
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (method). **Time**: about 50 minutes.
:::

:::plain The idea in one line
An engagement is a series of gates; each gate has a question, an artefact that answers it, and a person who signs it off.
:::

## The problem

Engagements rarely fail at the model. They fail because a stage was skipped: nobody measured today's baseline, so the pilot cannot prove anything; security saw the design in week ten instead of week two; the people who do the work were never asked. A lifecycle with explicit gates makes those skips visible while they are still cheap to fix.

## The stages and their exit tests

| Stage | Exit test (you may move on when...) | Signed off by |
|---|---|---|
| Discover | You can state the problem in the customer's words, with a number attached | Business sponsor |
| Qualify | The use case scores above your bar on value, feasibility, data, risk and adoption | Sponsor and your own lead |
| Map and scope | The workflow is mapped from observation, and acceptance criteria are written as evals | Sponsor and process owner |
| Prototype | A thin slice runs end to end on real (or realistic) data with traces | You, then the process owner |
| Trust | Security review passed, eval suite green, cost per transaction known | Security, data owner |
| Pilot | A named group used it for a fixed period; results compared with the baseline | Sponsor |
| Production and adoption | Usage is steady without you pushing it; incidents have an owner | Process owner, IT operations |
| Handover | The customer's team runs, changes and switches it off without you | System owner |

Two stages are often merged by accident and should not be: **prototype** answers "can it work?", **pilot** answers "does it work here, for these people?". A prototype can use synthetic data and one enthusiastic user; a pilot cannot.

## Plan backwards from the handover

Customers ask "when will it be live?". The honest answer is a plan that starts at the handover date and works back, with buffers where uncertainty is highest. The script lays out a 12-week plan for Harbor Mutual and shows which gates sit on the critical path.

```python
from datetime import date, timedelta

handover = date(2027, 3, 26)
# stage, working weeks, can it overlap the previous stage?
stages = [("Discover", 1, False), ("Qualify", 0.5, True), ("Map and scope", 1.5, False),
          ("Prototype", 2, False), ("Trust (security, evals, cost)", 2, True),
          ("Pilot", 3, False), ("Production and adoption", 1.5, False), ("Handover", 0.5, False)]

end = handover
plan = []
for name, weeks, overlaps in reversed(stages):
    start = end - timedelta(weeks=weeks)
    plan.append((name, start, end, overlaps))
    if not overlaps:
        end = start
for name, s, e, ov in reversed(plan):
    print(f"{name:32} {s:%d %b} -> {e:%d %b}{'   (runs alongside)' if ov else ''}")
print("first meeting no later than", min(p[1] for p in plan).strftime("%d %b %Y"))
```

"Trust" runs alongside the prototype on purpose: security review takes calendar time, not effort, so it should start the week the design exists.

## Where engagements stall

:::warn Four common stalls
- **No baseline.** Nobody measured the current cycle time or error rate, so the pilot readout is opinion against opinion. Measure in discovery, before anything changes.
- **Late security.** The security team sees the design after it is built and asks for changes that unwind it. Show them the trust boundary in week two.
- **Pilot without users.** The pilot group is the project team. Pick people who do the work daily and have no stake in the project's success.
- **Hidden owner.** Nobody on the customer side owns the system after launch, so the FDE never leaves. Name the owner at scoping time and make them sign the handover.
:::

:::check
Which statements are right?

- ✓ A pilot needs real users doing real work for a fixed period; a prototype does not.
- ✗ Security review should come after the pilot, once the design is final.
  It takes calendar time and can force design changes, so it starts as soon as the design exists.
- ✓ Each stage has an exit test and a named person who signs it off.
:::

:::recap What to keep
- Stages are gates: question, artefact, signer.
- Plan back from the handover date; run security in parallel with building.
- Measure the baseline before anything changes.
:::

## Exercises

1. Change the plan so the pilot is four weeks and the handover date cannot move. Which stage absorbs the week, and is that safe?
2. For each stage, write the one-sentence exit test for Harbor Mutual specifically (for example, "Qualify: fit score at least 3.5 of 5 and an ROI over 12 months").
3. List who at a typical insurer would sign each gate. Which person is most likely to be missing from the first meeting?

:::checked Sources and further reading
- [Claude Frontier Academy](https://claude.com/programs/frontier-academy): the intensive runs a simulated deployment from first request through security review to handover
- [Forward deployed engineers](https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers), The Pragmatic Engineer: OpenAI's scoping, validation and delivery phases
- [The definitive guide to forward deployed engineering](https://nextplayso.substack.com/p/the-definitive-guide-to-forward-deployed), Next Play
:::
