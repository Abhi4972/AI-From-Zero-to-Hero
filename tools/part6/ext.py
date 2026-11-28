"""ext.py: lessons for phases 22+ built from other open-licence repositories (see ext_*.py for each source).

Each source module exposes lessons(pno, store) -> list of lesson dicts in the shape build_p6.py uses:
  {id, num, title, minutes, type, group, src (lesson markdown with the course's directives), blocks, dir, key, nb?, norun?}
Python fences in src become runnable blocks through conv.body_fixer, exactly as in the other phases.
"""
import json, re, pathlib, shutil
import conv

EXT = pathlib.Path("/home/claude/ext")
WORK = pathlib.Path("/home/claude/aifs/extsrc")

PHASES = {
    22: ("ext/ml", "Machine Learning Projects",
         "Classic machine learning end to end on real datasets: regression, classification, clustering, NLP, time-series forecasting and reinforcement learning, each run here with its real output."),
    23: ("ext/scratch", "Build-from-Scratch Projects",
         "The reference implementations people cite: an autograd engine, a BPE tokenizer, a character-level GPT and the pieces of an LLM, built and run small enough for a laptop."),
    24: ("ext/rag", "RAG and Search Projects",
         "Retrieval-augmented generation in practice: chat with documents, hybrid and graph retrieval, corrective and agentic RAG, on hosted and local models. Each page shows the design, the code and how to run it with your own API keys."),
    25: ("ext/llmapps", "LLM Application Projects",
         "Apps built on language models: multimodal and vision, content generation, evaluation and fine-tuning. Each page shows the design, the code and how to run it with your own API keys."),
    26: ("ext/agents", "AI Agent Projects",
         "Single agents that use tools: research, browsing, finance, voice and games, in today's agent frameworks. Each page shows the design, the code and how to run it with your own API keys."),
    27: ("ext/multiagent", "Multi-Agent and MCP Projects",
         "Teams of agents and Model Context Protocol servers and clients. Each page shows the design, the code and how to run it with your own API keys."),
    28: ("ext/recipes", "Claude API Recipes",
         "Short, focused recipes for the Claude API: tool use, structured output, extended thinking, vision, prompt caching, evals, cost and latency, and integrations. They need an Anthropic API key."),
    29: ("ext/agentsdk", "Claude Agent SDK and Managed Agents Recipes",
         "Building agents on Claude's own harness: the Agent SDK for research, operations and security agents, and managed agents for long-running, supervised work. They need an Anthropic API key."),
    30: ("ext/snowflake", "Snowflake AI and Data Samples",
         "Cortex AI, Snowpark ML, Streamlit in Snowflake, Iceberg and data engineering samples. They need a Snowflake account."),
    31: ("ext/fde", "Forward Deployed Engineering with Claude",
         "An intensive on the forward deployed engineer's job: discovery, scoping, building on Claude inside a customer's systems, security review, evals, rollout, adoption and handover, ending with a simulated deployment and a graded practical."),
    32: ("ext/ops", "MLOps and LLMOps in Production",
         "Running models as systems: reproducibility, experiment tracking, the model registry, data validation, point-in-time features, pipelines, CI/CD, serving, safe releases, monitoring, retraining and governance, then Snowflake-native MLOps and the LLMOps practices for prompts, eval data, monitoring and model upgrades."),
}
PART = "Project Library"

def nb_cells(path):
    nb = json.loads(pathlib.Path(path).read_text())
    out = []
    for c in nb["cells"]:
        s = "".join(c.get("source", "")).rstrip()
        if not s.strip(): continue
        out.append((c["cell_type"], s, c.get("outputs", [])))
    return out

def clean_md(s, base_url=""):
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)                      # pictures from the source notebook
    s = re.sub(r"<img[^>]*>", "", s)
    s = re.sub(r"^#{1,6}\s*(.+?)[\s#]*$", lambda m: "\n**" + m.group(1).strip().strip("*") + "**\n", s, flags=re.M)   # headings inside a step become bold lead-ins
    s = re.sub(r"(?<![\\$])\$(?=\d)", "&#36;", s)                      # prices, not maths
    s = re.sub(r"\[([^\]]+)\]\(#(?!(?:a\d{4}|l\d{4}|cs-|ph-)\b)[^)]*\)", r"\1", s)  # links to headings of the source notebook
    s = re.sub(r"\s*\{#[\w-]+\}", "", s)
    if base_url:
        s = re.sub(r"\]\((?!https?:|#|mailto:)([^)]+)\)", lambda m: "](" + base_url + m.group(1) + ")", s)
    return s.strip()

def clean_code(s, fixes=()):
    s = "\n".join(l for l in s.split("\n") if not re.match(r"\s*(%|!|pip install)", l))
    for a, b in fixes: s = re.sub(a, b, s, flags=re.M)
    return s.strip()

def credit(repo, lic, url, note=""):
    return (f"Adapted from [{repo}](https://github.com/{repo}) ({lic} licence){note}. "
            f"[The original]({url}) is the reference if anything here differs.")

def fence(lang, code):
    return f"```{lang}\n{code.rstrip()}\n```"

def copy_tree(src, dst):
    dst.mkdir(parents=True, exist_ok=True)
    for p in src.iterdir():
        t = dst / p.name
        if p.is_dir():
            if not t.exists(): shutil.copytree(p, t)
        elif not t.exists():
            shutil.copy2(p, t)

_COURSE = None
def lesson_ref(i):
    """'[Lesson 2.3 · Linear Regression: ...](#a0202)' from the site's current course data."""
    global _COURSE
    if _COURSE is None:
        c = json.loads(pathlib.Path("/home/claude/ai-from-zero-to-hero/data/course.json").read_text())
        _COURSE = {l["id"]: (l["num"], l["title"]) for p in c for ch in p["chapters"] for l in ch["lessons"]}
    n, t = _COURSE.get(i, ("", i))
    return f"[Lesson {n} · {t}](#{i})"
