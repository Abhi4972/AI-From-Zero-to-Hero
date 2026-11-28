---
title: Commerce and Personal-Agent Protocols: UCP, ACP, AP2, x402, Poppy, A2UI and the IETF Agent Protocol Work
minutes: 60
group: 
lessons: l0804, a1319
---
:::goals What you will be able to do
- Place each late-2026 agent protocol in the stack: tools, agent-to-agent, user interface, commerce, payments, and personal agent to business
- Read a UCP manifest and a checkout session, and explain what an AP2 mandate proves
- Decide which protocols a business needs to publish so that customers' agents can use it safely
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (concepts with code). **Time**: about an hour.
:::

:::plain The idea in one line
MCP connects an agent to tools and A2A connects agents to each other; in 2026 a third layer appeared for the moment an agent acts for a person at someone else's business: who is this agent, what did its user allow, and how does it pay.
:::

## The problem

A customer's personal agent arrives at your shop's website to reorder running shoes. Your site was built for people with browsers. You need to know which agent this is, on whose behalf it acts, what the customer authorised it to do, how it can build a cart without scraping your pages, and how it can pay with proof the customer agreed. No single protocol answers all five questions.

## The map in November 2026

| Layer | Protocol | What it standardises | Steward and status |
|---|---|---|---|
| Tools and data | MCP | Agent to tools, resources and prompts | Agentic AI Foundation (Linux Foundation); spec 2026-07-28, stateless |
| Agent to agent | A2A | Discovery (agent cards) and task delegation between agents | Agentic AI Foundation since August 2026; v1.0 March 2026, v1.1 release candidate |
| Agent to user interface | AG-UI, A2UI, MCP Apps | Streaming agent events to an app; declarative UI the host renders; UI from MCP tools | Community and vendor projects |
| Coding agent to editor | Agent Client Protocol | Coding agents inside editors | Community |
| Commerce | Universal Commerce Protocol (UCP) | Catalog search, cart, checkout and orders | Google and Shopify with retailers; shopping live, lodging and food in draft |
| Commerce | Agentic Commerce Protocol | Checkout in chat assistants | OpenAI and Stripe |
| Payments | AP2 | Signed mandates proving what the user approved; v0.2 adds "human not present" payments | Donated by Google to the FIDO Alliance, April 2026 |
| Payments | x402 | Machine payments on HTTP status 402 | Community |
| Personal agent to business | Poppy (Personal Agent Protocol) | Agent identity, customer consent and permissions before any transaction | Sierra with Meta; 1.0 on 13 November 2026 |
| Web content for agents | NLWeb, llms.txt | Natural-language and machine-readable entry points to a site | Community |
| Base layer (in progress) | IETF agentproto working group | A common dialog-management protocol and reference architecture under application protocols | Chartered in 2026; no protocol yet |

Two names collide: "ACP" means the Agent Client Protocol for editors and the Agentic Commerce Protocol for checkout. Always write the full name.

## UCP in one page

A business publishes a JSON manifest at `/.well-known/ucp`. It lists services (for example `dev.ucp.shopping`), capabilities (`dev.ucp.shopping.checkout`, with `discount` and `fulfillment` declared as extensions of it) and payment handlers. Each capability can be bound to REST, MCP or A2A. The agent creates a checkout session with `POST /checkout-sessions`, updates it with `PUT /checkout-sessions/{id}`, and completes it when the status is `ready_for_complete`. Requests carry a `UCP-Agent` header, a request signature and an idempotency key.

AP2 covers the part UCP does not: proof. A **mandate** is a signed statement of what the user approved (the intent, the cart, the payment), so the merchant and the payment network can verify that the agent did not exceed it. Poppy sits before both: the agent identifies itself with OAuth, and the customer's grants say what it may do at this business and can be changed later. Sierra describes the split as UCP for shopping, Poppy for identity and permissions ahead of it.

The IETF group's charter is deliberately narrow: identifiers and lifecycle for agent dialogs across hops and trust boundaries, over existing transports. It excludes agent reasoning, user interfaces and audit formats, and it does not replace MCP or A2A.

## Locally: check an agent's purchase against its mandate

```python
import hashlib, hmac, json

MANIFEST = {"ucp": {"version": "2026-01", "services": {"dev.ucp.shopping": {"endpoint": "https://shop.example/ucp"}},
            "capabilities": [{"name": "dev.ucp.shopping.checkout"}, {"name": "dev.ucp.shopping.discount", "extends": "dev.ucp.shopping.checkout"}]},
            "payment": {"handlers": [{"id": "mock_payment_handler"}]}}

def supports(manifest, capability):
    return any(c["name"] == capability for c in manifest["ucp"]["capabilities"])

USER_KEY = b"user-device-key"          # stands in for the user's signing key; real mandates use public-key signatures
def sign(obj): return hmac.new(USER_KEY, json.dumps(obj, sort_keys=True).encode(), hashlib.sha256).hexdigest()

mandate = {"agent": "muse-assistant", "merchant": "shop.example", "max_total": 150.00, "currency": "EUR",
           "allowed_categories": ["footwear"], "human_present": False, "expires": "2026-12-01"}
signed = {"mandate": mandate, "signature": sign(mandate)}

def authorise(signed, cart, today="2026-11-28"):
    m = signed["mandate"]
    if not hmac.compare_digest(signed["signature"], sign(m)): return "REJECT: mandate signature invalid"
    if today > m["expires"]: return "REJECT: mandate expired"
    if cart["merchant"] != m["merchant"]: return "REJECT: wrong merchant"
    if any(i["category"] not in m["allowed_categories"] for i in cart["items"]): return "REJECT: item outside the mandate"
    total = sum(i["price"] * i["qty"] for i in cart["items"])
    if total > m["max_total"]: return f"REJECT: total {total:.2f} exceeds {m['max_total']:.2f}"
    return f"OK: {total:.2f} {m['currency']} within mandate"

print("checkout supported:", supports(MANIFEST, "dev.ucp.shopping.checkout"), "| fulfillment extension:", supports(MANIFEST, "dev.ucp.shopping.fulfillment"))
shoes = {"sku": "RUN-42", "category": "footwear", "price": 119.0, "qty": 1}
watch = {"sku": "GPS-1", "category": "electronics", "price": 29.0, "qty": 1}
print(authorise(signed, {"merchant": "shop.example", "items": [shoes]}))
print(authorise(signed, {"merchant": "shop.example", "items": [shoes, watch]}))
print(authorise(signed, {"merchant": "shop.example", "items": [dict(shoes, qty=2)]}))
tampered = {"mandate": dict(mandate, max_total=1500.0), "signature": signed["signature"]}
print(authorise(tampered, {"merchant": "shop.example", "items": [dict(shoes, qty=2)]}))
```

The merchant never has to trust the agent's own description of what it may do: the limits come from a statement the user signed, and a changed limit breaks the signature. That is the idea behind mandates; real AP2 uses verifiable credentials and public keys rather than a shared secret.

## What a business should publish

| If you want | Publish | And decide |
|---|---|---|
| Agents to buy from you | A UCP manifest and checkout capability | Which payment handlers; idempotency on every write |
| Proof for disputes | AP2 mandate verification | What you require when no human is present |
| Customers' personal agents to act for them | Poppy (or OAuth scopes of your own) | Which actions always need the customer's confirmation |
| Agents to use your services beyond shopping | An MCP server, and an A2A agent card if you run an agent | Least-privilege scopes; non-human identities for agents, separate from users |

Treat agent traffic as a new kind of client. Give agents their own (non-human) identities and scopes, log the mandate with every order, and keep the human confirmation step for irreversible actions.

:::check
Which statements are right?

- ✓ UCP standardises catalog, cart and checkout; AP2 standardises proof of what the user approved.
- ✗ The IETF agentproto working group is replacing MCP and A2A with one protocol.
  Its charter covers dialog management under application protocols and says it does not replace them.
- ✓ A changed spending limit in a signed mandate is detectable because the signature no longer matches.
:::

:::recap What to keep
- Three layers beyond MCP and A2A: commerce (UCP, Agentic Commerce Protocol), payments (AP2, x402), personal agent to business (Poppy).
- Manifests at well-known paths, idempotent sessions, signed mandates.
- Publish only what you can govern; agents get their own identities and scopes.
:::

## Exercises

1. Add a per-day spending cap to the mandate and enforce it across several carts.
2. Which of your organisation's customer journeys could a personal agent complete today, and which protocol is missing?
3. Write the confirmation rule for "human not present" payments at your shop.

:::checked Sources and further reading
- [Under the hood: Universal Commerce Protocol](https://developers.googleblog.com/en/under-the-hood-universal-commerce-protocol-ucp/), Google Developers Blog
- [Agent Payments Protocol and the FIDO Alliance](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/), Google, April 2026
- [Releasing Poppy](https://sierra.ai/blog/releasing-poppy), Sierra, November 2026
- [IETF agentproto working group charter](https://www.ietf.org/ietf-ftp/charter/charter-ietf-agentproto-00-04.txt)
- [A simple map of AI agent protocols, November 2026](https://dev.to/gde/mcp-a2a-ucp-ap2-confused-a-simple-map-of-ai-agent-protocols-november-2026-3ph)
:::
