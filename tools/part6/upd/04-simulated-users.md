---
title: Evaluating Agents with Simulated Users: τ²-bench Ideas, State-Based Scoring and the pass^k Reliability Metric
minutes: 60
group: 
lessons: l1212, a1419
---
:::goals What you will be able to do
- Build a multi-turn agent evaluation with a constrained user simulator instead of single-turn test cases
- Score by the final state of the environment rather than by judging the conversation
- Report reliability with pass^k, the chance that all k attempts at a task succeed
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about an hour.
:::

:::plain The idea in one line
A support agent is only good if it gets the customer to the right outcome every time, across a real conversation with a person who forgets details and does part of the work; test it that way, with a simulated person and a check on what actually changed.
:::

## The problem

Your returns agent passes 95% of single-question tests. In production, customers give the order number in the third message, change their mind, and have to do steps themselves (reset a router, find a receipt). The agent that looked strong fails one conversation in four, and the same request sometimes works and sometimes does not.

## Three ideas from τ-bench and τ²-bench

**A simulated user, constrained by the environment.** Sierra's τ-bench pairs the agent with a model playing the customer, who has a goal and facts and reveals them gradually. τ²-bench ties the simulator to the environment's real state so it cannot invent settings or contradict what its device shows; an audit of the earlier domains found simulators ending conversations early or dropping constraints, and those were fixed. A simulator you do not constrain becomes a second source of error.

**Dual control.** In τ²-bench's telecom domain both sides act: the agent changes backend settings, the user toggles things on their phone. Across the models tested, success fell by up to 25 points when the agent had to guide a user instead of doing every step itself. Giving clear instructions and checking that a step was done are skills single-turn tests never measure.

**Score the end state.** Tasks are composed from small verifiable actions, so success is a comparison between the final database or device state and the expected one, with no judge model needed.

**pass^k.** Run each task k times. pass^k is the share of tasks where all k runs succeed. An agent with 80% average success that is inconsistent has a much lower pass^4, which is what a customer contacting you four times experiences.

## Locally: a simulated-user evaluation with pass^k

```python
import random
ORDERS = {"A17": {"item": "tent", "days_since_delivery": 12, "used": False, "status": "delivered"},
          "B02": {"item": "stove", "days_since_delivery": 45, "used": False, "status": "delivered"},
          "C33": {"item": "boots", "days_since_delivery": 5, "used": True, "status": "delivered"}}
def expected_status(o):                                   # the policy: unused within 30 days is refundable
    return "refund_issued" if (not o["used"] and o["days_since_delivery"] <= 30) else "delivered"

class SimUser:
    """Reveals facts only when asked, sometimes vaguely; constrained to the true order record."""
    def __init__(self, order_id, rng): self.id, self.o, self.rng = order_id, ORDERS[order_id], rng
    def answer(self, question):
        if question == "order_id": return self.id if self.rng.random() > 0.15 else None      # sometimes cannot find it at first
        if question == "used": return self.o["used"]
        return None

def agent(user, db, rng, careful):
    oid = user.answer("order_id")
    if oid is None:
        if not careful: return                             # gives up after one try
        oid = user.answer("order_id") or user.answer("order_id")
        if oid is None: return
    o = db[oid]
    used = user.answer("used") if (careful or rng.random() > 0.3) else False    # the careless agent sometimes skips the question
    if not used and o["days_since_delivery"] <= 30: o["status"] = "refund_issued"

def evaluate(careful, k=4, seed=0):
    rng, per_task = random.Random(seed), []
    for oid in ORDERS:
        runs = []
        for _ in range(k):
            db = {i: dict(v) for i, v in ORDERS.items()}
            agent(SimUser(oid, rng), db, rng, careful)
            runs.append(db[oid]["status"] == expected_status(ORDERS[oid]))     # state-based check
        per_task.append(runs)
    avg = sum(map(sum, per_task)) / (len(per_task) * k)
    passk = sum(all(r) for r in per_task) / len(per_task)
    return avg, passk

for name, careful in [("careless agent", False), ("careful agent", True)]:
    res = [evaluate(careful, seed=s) for s in range(200)]
    print(f"{name:15} average success {sum(a for a, _ in res) / 200:.2f}   pass^4 {sum(p for _, p in res) / 200:.2f}")
```

Average success makes the careless agent look acceptable; pass^4 shows that few tasks succeed on every attempt. The careful agent asks again when the customer cannot find the order number and always checks whether the item was used, and both numbers rise. Report both, and set release gates on pass^k for tasks where one failure in four is unacceptable.

## Building your own

1. Write tasks as a starting state, a user goal with facts, and an expected end state.
2. Constrain the simulator: it may only state facts in the task and observe the environment; log when it deviates and discard those runs.
3. Check the simulator against real transcripts before trusting it.
4. Run each task several times; report average success and pass^k; read the failed conversations, not only the numbers.

:::check
Which statements are right?

- ✓ pass^k is the share of tasks on which all k attempts succeed, so it punishes inconsistency.
- ✗ A simulated user needs no checking because it is only there to generate messages.
  An unconstrained simulator invents facts or ends early, which looks like agent failure.
- ✓ Scoring by final environment state avoids relying on a judge model.
:::

:::recap What to keep
- Multi-turn tasks with a constrained simulated user; dual control where the user does steps.
- State-based scoring from composable, verifiable actions.
- Average success plus pass^k; gates on pass^k for high-stakes tasks.
:::

## Exercises

1. Make the simulated user change their mind once in ten conversations. Which agent copes?
2. Add a dual-control step (the user must read a code from the device) and score it.
3. Choose k for your own agent and justify it from how often one customer contacts you.

:::checked Sources and further reading
- [τ²-bench: evaluating conversational agents in a dual-control environment](https://arxiv.org/abs/2506.07982)
- [Benchmarking agents in collaborative real-world scenarios](https://sierra.ai/blog/benchmarking-agents-in-collaborative-real-world-scenarios), Sierra
- Yao et al., "τ-bench: a benchmark for tool-agent-user interaction in real-world domains", 2024
:::
