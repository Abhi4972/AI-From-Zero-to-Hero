---
title: Connecting to Customer Systems: Tool Adapters, MCP Servers and Least Privilege
minutes: 80
group: Building in the customer's environment
lessons: a1305, a1307, a1315
---
:::goals What you will be able to do
- Design a tool adapter that validates inputs, enforces read-only access and writes an audit record
- Make write tools safe to retry with idempotency keys, and gate irreversible ones behind approval
- Expose the same adapter as an MCP server so Claude Code, Claude apps and your own agent can all use it
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 80 minutes.
- **Runs**: the adapter runs here against an in-memory policy store. The MCP server is shown, not run.
:::

:::plain The idea in one line
Never give a model raw access to a customer system: give it a few narrow tools that check their inputs, can only do what the agent line allows, and log every call.
:::

## The problem

The customer's systems were built for people and batch jobs, not for a model that may call them hundreds of times with arguments it inferred. A thin, opinionated adapter between the model and each system is where you enforce the agent line (lesson 31.6), turn vague failures into clear errors the model can recover from, and leave the audit trail the security team will ask for.

## The adapter

```python
import re, json, time, uuid

POLICIES = {"HM-482913": {"holder": "R. Okafor", "line": "motor", "status": "active", "excess": 250},
            "HM-110204": {"holder": "J. Lindqvist", "line": "home", "status": "lapsed", "excess": 500}}
AUDIT = []
ALLOWED_FIELDS = {"line", "status", "excess"}           # the model never sees the holder's name

class ToolError(Exception):
    """An error the model can read and act on."""

def audit(tool, args, outcome, actor="claims-agent"):
    AUDIT.append({"id": str(uuid.uuid4())[:8], "ts": round(time.time()), "actor": actor, "tool": tool,
                  "args": args, "outcome": outcome})

def get_policy(policy_number: str) -> dict:
    """Read-only lookup. Returns only the fields the claims agent needs."""
    if not re.fullmatch(r"HM-\d{6}", policy_number or ""):
        audit("get_policy", {"policy_number": policy_number}, "rejected: bad format")
        raise ToolError("policy_number must look like HM-123456; ask for it or route to a human")
    rec = POLICIES.get(policy_number)
    if rec is None:
        audit("get_policy", {"policy_number": policy_number}, "not found")
        raise ToolError(f"no policy {policy_number}; do not guess another number")
    out = {k: v for k, v in rec.items() if k in ALLOWED_FIELDS}
    audit("get_policy", {"policy_number": policy_number}, "ok")
    return out

for pn in ["HM-482913", "HM 48291", "HM-999999"]:
    try:
        print(pn, "->", get_policy(pn))
    except ToolError as e:
        print(pn, "-> ToolError:", e)
print(json.dumps(AUDIT[-1], indent=1))
```

Three habits in fifteen lines: validate before touching the system, return only the fields the task needs (data minimisation), and make error messages instructions the model can follow.

## Writes: idempotent, or not available

Models retry, networks drop, and the agent may be restarted mid-run. A write tool must give the same result if it is called twice with the same request. The idempotency key makes that explicit; approval-gated tools only *propose*, and a person commits.

```python
DRAFTS, PROPOSALS = {}, {}

def create_draft_claim(idempotency_key: str, policy_number: str, loss_date: str) -> dict:
    if idempotency_key in DRAFTS:                       # a retry: return the first result, do nothing new
        audit("create_draft_claim", {"key": idempotency_key}, "replayed")
        return DRAFTS[idempotency_key]
    get_policy(policy_number)                           # reuse the read tool's checks
    claim = {"claim_id": f"DR-{len(DRAFTS) + 1:04d}", "policy": policy_number, "loss_date": loss_date, "state": "draft"}
    DRAFTS[idempotency_key] = claim
    audit("create_draft_claim", {"key": idempotency_key, "policy": policy_number}, "created")
    return claim

def propose_customer_email(claim_id: str, body: str) -> dict:
    """Never sends. Queues a proposal that a handler approves in the claims system."""
    pid = f"P-{len(PROPOSALS) + 1:03d}"
    PROPOSALS[pid] = {"claim_id": claim_id, "body": body, "state": "awaiting approval"}
    audit("propose_customer_email", {"claim_id": claim_id}, "queued for approval")
    return {"proposal_id": pid, "state": "awaiting approval"}

a = create_draft_claim("email-7f3a", "HM-482913", "2026-11-02")
b = create_draft_claim("email-7f3a", "HM-482913", "2026-11-02")    # the agent retried
print(a == b, len(DRAFTS), "draft(s)")
print(propose_customer_email(a["claim_id"], "Please send the repair estimate."))
```

There is deliberately no `send_email`, `approve_claim` or `pay` tool. An action the agent may not take should not exist in its tool list; a prompt that says "never pay claims" is not a control.

## The same adapter as an MCP server

Once the adapter is right, an MCP server makes it available to every Claude surface the customer uses: Claude Code for the engineers, Claude apps through a connector, and your own agent. With the Python SDK's FastMCP, each function becomes a tool and its docstring and type hints become the description and schema.

```pyshow
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("harbor-claims")

@mcp.tool()
def get_policy(policy_number: str) -> dict:
    """Read-only policy lookup. Returns line, status and excess for a policy number like HM-123456."""
    return adapter.get_policy(policy_number)        # the same validated, audited function as above

@mcp.tool()
def propose_customer_email(claim_id: str, body: str) -> dict:
    """Queue an email to the claimant for handler approval. Never sends anything."""
    return adapter.propose_customer_email(claim_id, body)

if __name__ == "__main__":
    mcp.run()          # stdio by default; use streamable HTTP behind the customer's auth for shared deployment
```

For a shared server, the security questions are the ones from phase 13: who is calling (per-user identity, not one shared key), which tools each caller may see, and where the audit log goes.

:::check
Which statements are right?

- ✓ A write tool should return the same result when called twice with the same idempotency key.
- ✗ Telling the model in the prompt never to send emails is enough if the send tool exists.
  Controls belong in the tool list and the adapter; remove the tool or make it propose-only.
- ✓ Returning only the fields a task needs is data minimisation, and it also shortens the context.
:::

:::recap What to keep
- One narrow adapter per system: validate, minimise, audit, explain errors.
- Writes are idempotent; irreversible actions are propose-only or absent.
- Wrap the adapter in MCP to reuse it across Claude surfaces, with per-user identity.
:::

## Exercises

1. Add a `lapsed` check: `create_draft_claim` should refuse a lapsed policy with a ToolError that tells the model to route the claim to a human.
2. Write the approval side: a function a handler calls to approve or reject a proposal, which must record who approved it.
3. Give the audit log a hash chain (each record includes the hash of the previous one) so tampering is detectable. What does that still not protect against?

:::checked Sources and further reading
- [Model Context Protocol: Python SDK](https://github.com/modelcontextprotocol/python-sdk) (FastMCP)
- [Claude FDE learning path](https://anthropic-partners.skilljar.com/path/claude-fde): "Introduction to Model Context Protocol"
- [Forward Deployed Engineering Certification](https://productschool.com/courses/forward-deployed-engineering-certification), Product School: an access boundary with irreversible actions kept off the tool list
:::
