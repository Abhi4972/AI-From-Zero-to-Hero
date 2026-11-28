---
title: Semantic Views and Cortex Analyst: Governed Text-to-SQL, Verified Queries and Execution Accuracy
minutes: 75
group: Structured questions and agents
lessons: a3004, a3005, a1110
---
:::goals What you will be able to do
- Define a semantic view with tables, relationships, facts, dimensions, metrics, synonyms and verified queries
- Ask Cortex Analyst questions over it through the REST API, and read its SQL, confidence and suggestions
- Measure text-to-SQL quality by execution accuracy on a golden question set, locally and in Snowflake
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 75 minutes.
:::

:::plain The idea in one line
A semantic view tells the model what your tables mean, in business words; Analyst turns questions into SQL against it, and you judge it by whether the SQL returns the right numbers.
:::

## The problem

Brightwell's store managers ask "what were returns by region last month?" and "which product line has the worst return rate?" The data is in `orders`, `order_lines`, `returns`, `products` and `stores`. A model that sees only column names guesses: is a return rate returns over orders, or over units? Is "last month" calendar or fiscal? The semantic view answers those questions once, for every user.

## The semantic view

```sql
CREATE OR REPLACE SEMANTIC VIEW retail.semantic.sales_returns
  TABLES (
    orders  AS retail.core.orders  PRIMARY KEY (order_id)  WITH SYNONYMS ('sales', 'purchases') COMMENT = 'One row per customer order',
    lines   AS retail.core.order_lines PRIMARY KEY (line_id) COMMENT = 'Items within an order',
    rets    AS retail.core.returns PRIMARY KEY (return_id) WITH SYNONYMS ('refunds') COMMENT = 'One row per returned line',
    stores  AS retail.core.stores  PRIMARY KEY (store_id)  COMMENT = 'Stores and their regions',
    products AS retail.core.products PRIMARY KEY (sku)     COMMENT = 'Product catalogue'
  )
  RELATIONSHIPS (
    lines_to_orders   AS lines (order_id) REFERENCES orders,
    orders_to_stores  AS orders (store_id) REFERENCES stores,
    lines_to_products AS lines (sku) REFERENCES products,
    rets_to_lines     AS rets (line_id) REFERENCES lines
  )
  FACTS (
    lines.line_revenue AS quantity * unit_price,
    rets.refund_amount AS refund_amount
  )
  DIMENSIONS (
    stores.region AS region WITH SYNONYMS = ('area', 'territory'),
    products.product_line AS product_line WITH SYNONYMS = ('category'),
    orders.order_month AS DATE_TRUNC('month', order_date)
  )
  METRICS (
    lines.revenue AS SUM(lines.line_revenue) COMMENT = 'Gross revenue before returns',
    lines.units_sold AS SUM(lines.quantity),
    rets.units_returned AS COUNT(rets.return_id),
    lines.return_rate AS DIV0(rets.units_returned, lines.units_sold) COMMENT = 'Returned units divided by units sold'
  )
  COMMENT = 'Brightwell sales and returns'
  AI_SQL_GENERATION 'Months are calendar months. Return rate always means returned units over units sold.'
  AI_VERIFIED_QUERIES (
    returns_by_region AS (
      QUESTION 'How many units were returned by region last month?'
      SQL 'SELECT * FROM SEMANTIC_VIEW(retail.semantic.sales_returns DIMENSIONS (stores.region) METRICS (rets.units_returned)) ...'
    )
  );

-- query it directly, no AI involved
SELECT * FROM SEMANTIC_VIEW(retail.semantic.sales_returns DIMENSIONS (products.product_line) METRICS (lines.return_rate));
```

Clause order matters (facts before dimensions before metrics), at least one dimension or metric is required, and comments and synonyms are not decoration: they are what Analyst reads. The verified query above is abbreviated; write the full SQL in yours. Semantic views are also queryable by BI tools, which keeps human and AI definitions the same.

Semantic views gained a lot in 2026. Generally available: standard SQL clauses over semantic views (March), entity-level filters (May), SQL queries as logical tables and variables (June), `DEFINE SEMANTIC VIEW` in DCM Projects and **Semantic Studio**, an AI-assisted editor in Workspaces (30 September), and **materializations** that precompute metrics (11 November). In preview: `CREATE OR ALTER SEMANTIC VIEW`, relationship paths, range joins, many-to-many relationships, level-of-detail expressions, Tableau export, and **Semantic View Autopilot**, which builds and refines views from query history, Tableau, Power BI and Horizon connectors. Object tags on semantic views let the governance lesson (33.31) find the ones agents use.

## Asking Analyst

```pyshow
import requests
resp = requests.post(f"https://{ACCOUNT_URL}/api/v2/cortex/analyst/message",
    headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    json={"messages": [{"role": "user", "content": [{"type": "text", "text": "Which product line had the worst return rate in October?"}]}],
          "semantic_view": "RETAIL.SEMANTIC.SALES_RETURNS"}).json()
for item in resp["message"]["content"]:
    if item["type"] == "sql":
        print(item["statement"]); print("verified query used:", (item.get("confidence") or {}).get("verified_query_used"))
    elif item["type"] in ("suggestion", "suggestions"):
        print("ambiguous; suggestions:", item)
```

The response contains `text` (Analyst's interpretation), `sql` (the statement, with a `confidence` object naming any verified query it used) or `suggestions` when the question is ambiguous. On 28 August 2026 Snowflake recommended transitioning from calling Cortex Analyst directly to Cortex Agents, which call Analyst as a tool and add orchestration, evaluation and agent identity (lessons 33.17 and 33.30). The semantic view is the same either way, so the modelling work in this lesson carries over unchanged.

## Locally: execution accuracy on a mini warehouse

Text-to-SQL is judged by running the generated SQL and comparing results with a trusted query, not by comparing SQL text.

```python
import sqlite3, random
random.seed(4)
db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE stores(store_id INT, region TEXT);
CREATE TABLE products(sku TEXT, product_line TEXT);
CREATE TABLE orders(order_id INT, store_id INT, order_date TEXT);
CREATE TABLE order_lines(line_id INT, order_id INT, sku TEXT, quantity INT, unit_price REAL);
CREATE TABLE returns(return_id INT, line_id INT, refund_amount REAL);""")
db.executemany("INSERT INTO stores VALUES (?,?)", [(1, "North"), (2, "South"), (3, "West")])
db.executemany("INSERT INTO products VALUES (?,?)", [("TH-2P", "tents"), ("SJ-M", "jackets"), ("HB-9", "boots")])
lid = rid = 0
for oid in range(1, 401):
    db.execute("INSERT INTO orders VALUES (?,?,?)", (oid, random.choice([1, 2, 3]), f"2026-{random.choice([9, 10])}-{random.randint(1, 28):02d}"))
    for _ in range(random.randint(1, 3)):
        lid += 1; sku = random.choice(["TH-2P", "SJ-M", "HB-9"]); q = random.randint(1, 2)
        db.execute("INSERT INTO order_lines VALUES (?,?,?,?,?)", (lid, oid, sku, q, {"TH-2P": 320, "SJ-M": 180, "HB-9": 140}[sku]))
        if random.random() < {"TH-2P": .12, "SJ-M": .06, "HB-9": .18}[sku]:
            rid += 1; db.execute("INSERT INTO returns VALUES (?,?,?)", (rid, lid, 100.0))

GOLD = {
 "return rate by product line in October": """
   SELECT p.product_line, ROUND(1.0 * COUNT(r.return_id) / SUM(l.quantity), 4) FROM order_lines l
   JOIN orders o USING(order_id) JOIN products p USING(sku) LEFT JOIN returns r USING(line_id)
   WHERE o.order_date LIKE '2026-10-%' GROUP BY 1 ORDER BY 1""",
 "units returned by region": """
   SELECT s.region, COUNT(*) FROM returns r JOIN order_lines l USING(line_id) JOIN orders o USING(order_id)
   JOIN stores s USING(store_id) GROUP BY 1 ORDER BY 1""",
}
GENERATED = {   # what two configurations produced: without a semantic layer, and with the semantic view's definitions
 "no semantic layer": {
   "return rate by product line in October": """
     SELECT p.product_line, ROUND(1.0 * COUNT(r.return_id) / COUNT(DISTINCT l.order_id), 4) FROM order_lines l
     JOIN orders o USING(order_id) JOIN products p USING(sku) LEFT JOIN returns r USING(line_id)
     WHERE o.order_date LIKE '2026-10-%' GROUP BY 1 ORDER BY 1""",
   "units returned by region": """
     SELECT s.region, SUM(l.quantity) FROM returns r JOIN order_lines l USING(line_id) JOIN orders o USING(order_id)
     JOIN stores s USING(store_id) GROUP BY 1 ORDER BY 1"""},
 "semantic view": {
   "return rate by product line in October": GOLD["return rate by product line in October"].replace("ROUND(1.0 *", "ROUND(1.0*"),
   "units returned by region": GOLD["units returned by region"]},
}
def run(sql): return db.execute(sql).fetchall()
for config, answers in GENERATED.items():
    ok = [run(answers[q]) == run(GOLD[q]) for q in GOLD]
    print(f"{config:18} execution accuracy {sum(ok)}/{len(ok)}")
print("\ngold:", run(GOLD["return rate by product line in October"]))
print("no semantic layer:", run(GENERATED["no semantic layer"]["return rate by product line in October"]))
```

Without the semantic layer, the generated SQL is syntactically fine and plausible, but it defines return rate per order and counts returned units by quantity: two business-definition errors, both invisible without an execution check. The semantic view's metric definitions and the verified query remove the ambiguity. In Snowflake, run the same comparison: a table of golden questions with trusted SQL, Analyst's SQL for each, both executed, results compared.

:::check
Which statements are right?

- ✓ Text-to-SQL should be evaluated by comparing query results, not SQL text.
- ✗ A semantic view only renames columns.
  It defines relationships, facts, metrics, synonyms and instructions that Analyst and BI tools use.
- ✓ When a question is ambiguous, Analyst can return suggestions instead of SQL.
:::

:::recap What to keep
- Semantic view: tables, relationships, facts, dimensions, metrics, synonyms, instructions, verified queries.
- Analyst REST returns text, SQL with confidence, or suggestions.
- Judge by execution accuracy on golden questions; fix definitions, not prompts.
:::

## Exercises

1. Add a golden question "revenue by region in September" and a plausible wrong generated SQL. Does the check catch it?
2. Add a verified query for the return-rate question and explain why it helps beyond that exact question.
3. List three synonyms Brightwell staff would use that are missing from the semantic view.

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Getting started with semantic views](https://www.snowflake.com/en/developers/guides/getting-started-with-semantic-views/) (Snowflake guide)
- [Semantic view description quality: a rubric and a linter](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/description-quality) (Cortex AI Cookbook)
- [Mixed-grain tables and verified queries](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/mixed-grain-and-verified-queries) (Cortex AI Cookbook)
- [Refine a semantic view from agent logs](https://docs.snowflake.com/en/developer-guide/cortex-ai-cookbook/refinement-loop-from-agent-logs) (Cortex AI Cookbook)

:::checked Sources and further reading
- [CREATE SEMANTIC VIEW](https://docs.snowflake.com/en/sql-reference/sql/create-semantic-view)
- [Cortex Analyst REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/rest-api)
- [Best practices for modeling semantic views](https://docs.snowflake.com/en/user-guide/views-semantic/best-practices-modeling)
- [Cortex Analyst Verified Query Repository](https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-analyst/verified-query-repository)
- Yu et al., "Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task", EMNLP 2018: execution-based evaluation
:::
