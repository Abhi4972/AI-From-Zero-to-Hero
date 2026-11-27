---
title: The Forward Deployed Engineer: What the Job Is and Why It Exists
minutes: 45
group: The role and the engagement
lessons: a1447, a1453
---
:::goals What you will be able to do
- Say what a forward deployed engineer (FDE) owns that a solutions engineer, consultant or product engineer does not
- Describe the shape of an FDE engagement on Claude, from first customer conversation to handover
- Map Anthropic's official Claude FDE path and Frontier Academy onto the lessons of this phase
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (role and practice). **Time**: about 45 minutes.
- **Runs**: the small scripts below run here; nothing needs an API key.
:::

:::plain The idea in one line
A forward deployed engineer sits with a customer, writes the code that puts a model into their real work, and stays until the people doing that work rely on it.
:::

## The problem

A model that scores well in a demo is not yet a deployment. Between the demo and value sit the customer's messy data, their access rules, their security team, the people whose jobs change, and a long tail of edge cases nobody wrote down. Product teams cannot see that tail from headquarters, and advisers who only recommend cannot close it. The forward deployed engineer exists to close it: an engineer who is measured on whether the customer's outcome actually moves, not on whether a feature shipped.

The term comes from Palantir, which sent engineers to work on site with government and enterprise customers in the 2000s. AI labs revived it because deploying language models has the same shape: the model is general, the value is specific, and the specific part is engineering work inside someone else's systems. In October 2026 Anthropic launched Claude Frontier Academy, with a $100 million commitment to train 10,000 such engineers by the end of 2027.

## What the job is, and what it is not

| Role | Writes production code in the customer's environment | Owns the business outcome | Typical horizon |
|---|---|---|---|
| Forward deployed engineer | Yes, daily | Yes | Weeks to months per use case, often longer per customer |
| Solutions engineer or architect | Rarely; demos and reference designs | Shares it with sales | Pre-sale to launch |
| Consultant | Sometimes, usually advisory | Recommends; the customer owns it | Fixed engagement |
| Product engineer | In the vendor's own product | Owns product metrics, not one customer's | Ongoing |
| ML engineer | Models and pipelines | Owns model quality | Ongoing |

Three things set the FDE apart. First, **they build inside the customer's environment**, with the customer's identity system, data and tooling, not against anonymised samples. Second, **they own the outcome**: OpenAI's FDE teams describe success as a system in production that keeps its eval scores; Palantir talks about impact on the customer's goal; Ramp ties FDE work to customer outcomes and revenue. Third, **they feed the field back into the product**: what one customer needed often becomes a feature for every customer.

## The shape of an engagement

Every lesson in this phase is a stage of one engagement. The running case throughout is **Harbor Mutual**, a fictional mid-sized insurer whose claims team spends hours turning emails, PDFs and photos into claim records. You will produce one artefact per stage, and together they form a deployment dossier.

| Stage | Question it answers | Artefact you produce | Lessons |
|---|---|---|---|
| Discover | Who needs what, and who decides? | Stakeholder map and problem statement | 31.4 |
| Qualify | Is this worth doing, and is it doable? | Fit score and ROI case | 31.5 |
| Map | What really happens today? | Workflow map with keep / cut / human / AI per step | 31.6 |
| Scope | What exactly will we deliver, and how will we know? | Scope and acceptance criteria | 31.7 |
| Build | Does a thin slice work on real data? | Thin slice with traces | 31.8 to 31.12 |
| Trust | Will security, legal and the evals sign off? | Eval suite, trust boundary, cost model | 31.13 to 31.15 |
| Pilot and adopt | Do people use it, and is it better? | Pilot readout and adoption plan | 31.16, 31.17 |
| Hand over | Can the customer run it without you? | Handover pack | 31.18 |
| Feed back | What should the product learn? | Field note | 31.19 |

The capstone (31.20) runs the whole cycle again on a case you have not seen, under time pressure, the way an intensive's graded practical does.

## A first habit: always be scoping

FDE teams repeat one rule: a few more questions usually save days of building. The script below is a toy, but it makes the habit concrete. It takes a customer's request and lists the questions that must be answered before any code is written.

```python
REQUEST = "We want an AI agent that handles all incoming claims emails."

CHECKS = {
    "who":     ("Who reads these emails today, and who will own the system after launch?", ["team", "owner", "who"]),
    "volume":  ("How many emails a day, and how many are claims rather than other mail?", ["per day", "volume", "how many"]),
    "done":    ("What does 'handled' mean: drafted, filed, paid, or answered?", ["draft", "file", "pay", "answer"]),
    "data":    ("Which systems hold the policy and claim records, and can we read them?", ["system", "database", "crm", "record"]),
    "risk":    ("Which actions must a person approve, and what is never automated?", ["approve", "approval", "human"]),
    "measure": ("What number tells us it worked, and what is it today?", ["baseline", "minutes", "hours", "metric"]),
}

def open_questions(request):
    text = request.lower()
    return [q for key, (q, hints) in CHECKS.items() if not any(h in text for h in hints)]

for q in open_questions(REQUEST):
    print("-", q)
```

Six open questions from one sentence. The word "all" is the biggest risk in the request: the right first scope is almost never all of anything.

:::check
Which statements are right?

- ✓ An FDE writes production code inside the customer's environment and is measured on the customer's outcome.
- ✗ An FDE's job ends when the demo works.
  The job ends when the customer runs the system without you and the outcome metric has moved.
- ✓ Turning one customer's custom build into a reusable feature is part of the role.
:::

## The official Claude FDE path, and where it lives in this phase

Anthropic offers a Claude FDE learning path of nine courses on its partner learning site, and the Frontier Academy residency for nominated engineers. This phase was written for this course; it follows the same ground and points to the official courses so you can take them alongside.

| Official course (Anthropic) | What it covers | Where this phase covers it |
|---|---|---|
| AI Fluency for Builders | Owning a problem from start to shipped solution with AI | 31.1, 31.2, 31.4 |
| Claude Platform & Model Foundations | Entry point, features, model and context: the decisions that set the quality ceiling | 31.3 |
| Claude Platform 101 | Building on the API | 31.8, 31.10 |
| Claude Code 101 and Claude Code in Action | Daily use and long, steered, verified sessions | 31.11 |
| Introduction to Model Context Protocol | MCP servers and clients in Python | 31.9 |
| Introduction to Agent Skills | Building and sharing Skills | 31.11 |
| Delivery Methodology | Qualifying use cases, pilots, baselines, adoption, champions, failure modes | 31.5, 31.16, 31.17 |
| Driving Enterprise Adoption of Claude | A three-phase framework from setup to sustained adoption | 31.17, 31.18 |

The Frontier Deployed Engineer Residency has three stages: a four-day in-person intensive in which residents build a Claude system for a simulated enterprise, from the customer's first request through security review to handover, then take a graded practical on a new scenario (passing earns the Claude Resident Engineer badge); a 12-week residency leading a real deployment at their own organisation; and a final practical for the Claude Frontier Deployed Engineer badge. Entry is by nomination through an organisation's Anthropic account team or partner manager.

:::recap What to keep
- The FDE owns the outcome, builds in the customer's environment, and feeds the field back to the product.
- An engagement is a chain of stages, each with an artefact; the dossier is how you hand over.
- Scope before you build; "all" is a warning word.
:::

## Exercises

1. Add two checks to `CHECKS` that a security team would ask about (data residency, retention) and rerun the script on the Harbor Mutual request.
2. Pick a role you have held. Fill in a row of the comparison table for it. Which column would change if you became an FDE tomorrow?
3. Write the one-paragraph problem statement you would want after the first Harbor Mutual meeting: who, what today, what better looks like, and how you will measure it.

:::checked Sources and further reading
- [Anthropic invests $100 million to train 10,000 engineers](https://www.anthropic.com/news/claude-frontier-academy) (Claude Frontier Academy announcement, October 2026)
- [Claude Frontier Academy](https://claude.com/programs/frontier-academy): the residency, its stages and badges
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde) on Anthropic's partner learning site
- [Forward deployed engineers](https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers), The Pragmatic Engineer: how OpenAI, Palantir and Ramp run the role
:::
