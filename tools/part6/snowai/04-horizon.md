---
title: Horizon Catalog for AI: Classification, Tags, Lineage, Access History and Horizon Context
minutes: 65
group: Foundations: the stack, access and data
lessons: a3213, a1726
---
:::goals What you will be able to do
- Find and tag sensitive data automatically with classification profiles, and protect it with tag-based masking before any AI touches it
- Trace where AI inputs come from and who read what, with lineage and access history
- Explain Horizon Context, Business Ontology and Cortex Sense (2026): the governed business meaning that CoCo, agents and BI tools read, and where semantic views fit
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (setup with code). **Time**: about 65 minutes.
:::

:::plain The idea in one line
AI is only as safe and as accurate as the catalog under it: know which columns are sensitive, protect them by tag, trace every input, and publish business definitions once for every AI and BI consumer.
:::

## The problem

Brightwell's agents will read tickets, orders and customer tables. Nobody has a list of which columns hold personal data, masking is applied table by table when someone remembers, and "net revenue" means three different things in three dashboards. Each of these becomes an AI problem: a model sees an email it should not, or answers with the wrong revenue.

## Classification and tag-based masking

Sensitive data classification (Enterprise Edition and above) assigns each column a semantic category (for example email or phone) and a privacy category (`IDENTIFIER`, `QUASI_IDENTIFIER`, `SENSITIVE`), recorded in the system tags `SNOWFLAKE.CORE.SEMANTIC_CATEGORY` and `SNOWFLAKE.CORE.PRIVACY_CATEGORY`. A **classification profile** saves the settings; associating it with a database classifies every table and view in it, and **Autopilot** (public preview from 26 Oct 2026) decides when to reclassify. An AI mode (public preview from 17 Aug 2026) uses a model to find more categories, at token cost. 2026 also brought semi-structured data support, EU categories, medical and health classifiers, metadata-based recommendations, and Sensitive Data Access and Entitlement reports (GA 20 Oct 2026) that show who can read and who did read sensitive columns.

The payoff is **tag-based masking**: attach a masking policy to your own tag, map that tag to the system categories, and any newly classified email column is masked automatically, including the copies that land in AI pipelines.

```sql
CREATE TAG IF NOT EXISTS governance.tags.pii_level ALLOWED_VALUES 'direct', 'indirect';
CREATE OR REPLACE MASKING POLICY governance.policies.mask_direct_pii AS (v STRING) RETURNS STRING ->
  CASE WHEN IS_ROLE_IN_SESSION('PII_READER') THEN v ELSE '***' END;
ALTER TAG governance.tags.pii_level SET MASKING POLICY governance.policies.mask_direct_pii;
-- the classification profile maps IDENTIFIER columns to pii_level = 'direct' (set in Trust Center or SQL),
-- so classification applies the tag and the tag applies the mask
```

Monitor what is covered with `SYSTEM$SHOW_SENSITIVE_DATA_MONITORED_ENTITIES('DATABASE')`, review results in Trust Center, and track classification credits in `METERING_DAILY_HISTORY` with `SERVICE_TYPE = 'SENSITIVE_DATA_CLASSIFICATION'`.

## Lineage and access history

- **Lineage**: `SNOWFLAKE.CORE.GET_LINEAGE` and Snowsight's lineage graph show which tables feed which; for ML, the lineage graph links source tables, feature views, datasets, models and services (lesson 33.26).
- **Access history** (`SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY`) records which columns each query read and wrote, including queries run by AI tools on a user's behalf. With **agent identity** (lesson 33.30), actions an agent takes on a user's behalf carry the agent's identity, so the audit can tell the person from the agent acting for them.

```sql
-- which roles read customer emails last week, and through which queries
SELECT ah.query_start_time, ah.user_name, q.role_name, obj.value:objectName::STRING AS table_name, col.value:columnName::STRING AS column_name
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah
JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY q ON q.query_id = ah.query_id,
     LATERAL FLATTEN(ah.base_objects_accessed) obj, LATERAL FLATTEN(obj.value:columns) col
WHERE ah.query_start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  AND col.value:columnName::STRING = 'CUSTOMER_EMAIL';
```

## Horizon Context: meaning, not only metadata

Announced at Summit 2026, Horizon Context turns catalog metadata into governed business meaning that AI and BI share: definitions, relationships and calculations. Its parts, with their stage in Snowflake's release notes and announcements as of November 2026:

| Part | What it does | Stage (Nov 2026) |
|---|---|---|
| Semantic views | The definitions: facts, dimensions, metrics, synonyms (lesson 33.16) | GA; newer clauses in preview |
| Semantic Studio | AI-assisted editor for semantic views in Workspaces, with Git and CoCo | Preview 26 Aug, GA 30 Sep 2026 |
| Semantic View Autopilot | Builds and refines semantic views from query history, Tableau and Power BI | Power BI ingestion GA 18 Aug; import from Horizon connectors preview 20 Nov |
| Horizon Context | Collects, enriches and activates metadata through connectors (Tableau, Power BI, dbt, SQL Server, PostgreSQL), with AI-generated descriptions and popularity signals | Preview 12 Oct 2026 |
| Business Ontology | Approved, owned definitions of business concepts and metrics, linked to tables and views, with a steward approval workflow | Announced Nov 2026 (Expedition); public preview "soon" |
| Cortex Sense | Infers business context from metadata and usage (never data rows), ranks governed semantic views above inferred definitions, asks a builder to resolve conflicts | Private preview (mid 2026) |
| Open Semantic Interchange (OSI) | An open specification for exchanging semantic definitions between tools | Specification published |

The design rule that follows: put business definitions in semantic views, under version control, and let every consumer (Analyst, agents, CoCo, CoWork, BI tools) read the same ones.

## Locally: a governance coverage report

```python
import pandas as pd
columns = pd.DataFrame([   # what a classification result and the tag catalog look like, for Brightwell's AI-facing tables
    ("RETAIL.CORE.CUSTOMERS", "EMAIL", "EMAIL", "IDENTIFIER", "direct", True),
    ("RETAIL.CORE.CUSTOMERS", "PHONE", "PHONE_NUMBER", "IDENTIFIER", None, False),
    ("RETAIL.CORE.CUSTOMERS", "POSTCODE", "POSTAL_CODE", "QUASI_IDENTIFIER", "indirect", False),
    ("RETAIL.CORE.CUSTOMERS", "BIRTH_YEAR", "YEAR_OF_BIRTH", "QUASI_IDENTIFIER", None, False),
    ("SUPPORT.RAW.TICKETS", "BODY", None, None, None, False),
    ("SUPPORT.RAW.TICKETS", "CUSTOMER_EMAIL", "EMAIL", "IDENTIFIER", "direct", True),
    ("DOCS.RAG.CHUNKS", "CHUNK", None, None, None, False),
], columns=["table", "column", "semantic_category", "privacy_category", "pii_tag", "masked"])
AI_INPUTS = {"SUPPORT.RAW.TICKETS.BODY", "DOCS.RAG.CHUNKS.CHUNK", "RETAIL.CORE.CUSTOMERS.POSTCODE"}

def coverage(cols):
    findings = []
    cols = cols.astype(object).where(cols.notna(), None)          # treat missing values as None
    for _, c in cols.iterrows():
        name = f"{c['table']}.{c['column']}"
        if c.privacy_category == "IDENTIFIER" and not c.masked: findings.append(("HIGH", name, "identifier not masked"))
        if c.privacy_category and not c.pii_tag: findings.append(("MEDIUM", name, "classified but no policy tag"))
        if name in AI_INPUTS and c.semantic_category is None:
            findings.append(("REVIEW", name, "free text feeding AI: classifiers see no category; redact or sample-check it"))
    return pd.DataFrame(findings, columns=["severity", "column", "finding"])

print(coverage(columns).to_string(index=False))
```

The free-text columns are the important finding. Classification labels a column by what it mostly contains, so a ticket body full of names and phone numbers can show no category at all. For AI inputs, combine classification with `AI_REDACT` in the pipeline (lesson 33.6) and periodic sampling.

:::check
Which statements are right?

- ✓ Tag-based masking lets newly classified columns be masked automatically.
- ✗ If classification finds no sensitive category in a column, its text is safe to send to a model.
  Free-text columns can contain personal data that column-level classification does not label.
- ✓ Horizon Context aims to give AI agents and BI tools the same governed business definitions.
:::

:::recap What to keep
- Classification profiles plus system tags plus tag-based masking: protection that follows the data.
- Lineage and access history answer "where did this come from" and "who read it"; Agent Identity separates agents from people.
- Business meaning lives in semantic views (and, as it matures, Business Ontology), shared by every AI and BI consumer through Horizon Context.
:::

## Exercises

1. Add a `NOTES` column on orders that sometimes contains phone numbers. Which control catches it?
2. Write the access-history query that lists every column an agent's service role read yesterday.
3. Pick three Brightwell metrics that must be defined once in a semantic view, and say which dashboards disagree on them today.

:::checked Sources and further reading
- [Introduction to sensitive data classification](https://docs.snowflake.com/en/user-guide/classify-intro)
- [ML Lineage](https://docs.snowflake.com/en/developer-guide/snowflake-ml/ml-lineage) and [GET_LINEAGE](https://docs.snowflake.com/en/sql-reference/functions/get_lineage-snowflake-core)
- [Snowflake Horizon Context: the governed context layer for AI, BI and apps](https://www.snowflake.com/content/snowflake-site/global/en/blog/horizon-context-governed-context), Snowflake blog, June 2026
- [Snowflake launches Business Ontology](https://www.infoworld.com/article/4243932/snowflake-launches-business-ontology-to-boost-ai-agent-reliability.html), InfoWorld, November 2026
- [Snowflake advances trusted AI with Horizon Catalog](https://www.snowflake.com/en/news/press-releases/snowflake-advances-trusted-ai-with-snowflake-horizon-catalog-centralizing-governance-context-and-security-across-the-enterprise/), press release, June 2026
:::
