"""Phase 30: samples from Snowflake-Labs/sf-samples (Apache-2.0). They need a Snowflake account; nothing is run here."""
import re
import conv
import ext_apps as A
from ext import EXT, lesson_ref

ROOT = EXT / "Snowflake-Labs_sf-samples"
GROUPS = [("Cortex AI: agents, search, analyst and LLM functions", r"cortex|llm|agent|rag|search|analyst|genai|aisql|nemo|openai|pdf|multimodal|incident", ["l1308", "a1106"]),
          ("Machine learning with Snowpark", r"\bml\b|ml_|ml-|machine learning|forecast|model|ray|autogluon|kumo|rdkit|sagemaker|churn|recommend", ["a0219", "a0213"]),
          ("Apps: Streamlit and native apps", r"streamlit|native[_ -]app|app\b|tasty", ["l1308", "a1729"]),
          ("Data engineering, Iceberg and governance", r".", ["a0221", "a0009"])]
A.SETUP = re.compile(r"install|setup|set up|usage|run|getting started|quick ?start|how to use|prerequisite|configuration|environment|deploy|step", re.I)

def lessons(pno, store):
    units = []
    for d in A.unit_dirs(ROOT / "samples", ()):
        try: u = A.build_one(ROOT, "Snowflake-Labs/sf-samples", "Apache-2.0", "main", d)
        except Exception as e: print("skip", d, e); continue
        s = (u["rel"] + " " + u["title"]).lower()
        for g, rx, rel in GROUPS:
            if re.search(rx, s):
                u["group"] = g
                u["src"] = re.sub(r"- \*\*Needs\*\*: .*", "- **Needs**: " + "; ".join(lesson_ref(i) for i in rel), u["src"], count=1)
                u["src"] = re.sub(r"- \*\*Type\*\*: Project \([^)]*\)", f"- **Type**: Sample ({g.split(':')[0]})", u["src"], count=1)
                u["src"] = u["src"].replace("with your own API keys", "with your own Snowflake account")
                break
        units.append(u)
    seen = {}
    for u in units:
        k = u["title"].lower(); seen[k] = seen.get(k, 0) + 1
    units.sort(key=lambda u: ([g for g, _, _ in GROUPS].index(u["group"]), u["title"].lower()))
    out = []
    for n, u in enumerate(units, 1):
        t = u["title"] + (f" ({u['rel'].split('/')[-1]})" if seen[u["title"].lower()] > 1 else "")
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        body = conv.body_fixer(u["dir"], f"{pno}.{n}", lstore)(u["src"])
        out.append({"title": t, "minutes": 45, "type": "Sample", "num": f"{pno}.{n}", "src": body, "key": f"ext/snowflake/{u['rel']}",
                    "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(u["dir"]), "phase": "ext/snowflake", "group": u["group"],
                    "norun": True, "stack": u["stack"]})
    return out
