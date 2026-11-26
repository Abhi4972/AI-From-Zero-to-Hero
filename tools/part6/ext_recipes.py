"""Phases 28-29: recipes from anthropics/claude-cookbooks (MIT). Notebooks with their authors' recorded output; not run here."""
import json, re, pathlib
import conv
from ext import EXT, clean_md, fence, credit, lesson_ref

R = EXT / "anthropics_claude-cookbooks"
GH = "https://github.com/anthropics/claude-cookbooks/blob/main/"
GROUP = {"tool_use": "Tool use", "capabilities": "Capabilities", "misc": "Prompting, evals and production", "multimodal": "Vision and multimodal",
         "patterns": "Agent patterns", "extended_thinking": "Extended thinking", "skills": "Agent Skills", "third_party": "Integrations with other tools",
         "observability": "Observability and cost", "cost_optimization": "Observability and cost", "latency_optimization": "Observability and cost",
         "evals": "Prompting, evals and production", "tool_evaluation": "Tool use", "coding": "Prompting, evals and production",
         "finetuning": "Prompting, evals and production", "claude_agent_sdk": "Claude Agent SDK", "managed_agents": "Managed agents",
         "fable_5_fallback_billing": "Prompting, evals and production"}
RELATED = {"Tool use": ["a1109", "a1302"], "Capabilities": ["a1101", "a1106"], "Prompting, evals and production": ["a1101", "a1110"],
           "Vision and multimodal": ["a1205", "a1222"], "Agent patterns": ["a1412", "a1428"], "Extended thinking": ["a1102", "l2703"],
           "Agent Skills": ["a1322", "a1324"], "Integrations with other tools": ["a1106", "a1114"], "Observability and cost": ["a1111", "a1424"],
           "Claude Agent SDK": ["l0710", "a1417"], "Managed agents": ["a1418", "a1429"]}
EXER = ["Run the notebook with your own key and compare your output with the recorded one. Note anything that changed and why it might have.",
        "Change one input (the prompt, a tool description or a parameter such as `max_tokens`) and predict the effect before you rerun the cell.",
        "Turn the core idea into a small script of your own that you could reuse in a project, with error handling for API failures."]

def notebooks(phase):
    out = []
    for f in sorted(R.rglob("*.ipynb")):
        rel = f.relative_to(R)
        top = rel.parts[0]
        if top in ("tests", "scripts", "anthropic_cookbook") or any(p.startswith(".") for p in rel.parts): continue
        agent = top in ("claude_agent_sdk", "managed_agents")
        if (phase == 29) != agent: continue
        out.append(f)
    return out

def _outputs(outs):
    txt = []
    for o in outs or []:
        if o.get("output_type") == "stream": txt.append("".join(o.get("text", "")))
        elif o.get("output_type") in ("execute_result", "display_data"):
            d = o.get("data", {})
            if "text/plain" in d and "image/png" not in d and "text/html" not in d: txt.append("".join(d["text/plain"]))
            elif "text/markdown" in d: txt.append("".join(d["text/markdown"]))
    t = "\n".join(x.rstrip() for x in txt if x.strip())
    t = re.sub(r"\x1b\[[0-9;]*m", "", t)
    lines = t.split("\n")
    if len(lines) > 30: lines = lines[:26] + [f"… ({len(lines) - 26} more lines)"]
    return "\n".join(l[:220] for l in lines).strip()

def page(f):
    nb = json.loads(f.read_text())
    rel = f.relative_to(R).as_posix()
    group = GROUP.get(rel.split("/")[0], "Prompting, evals and production")
    cells = nb.get("cells", [])
    title = None
    for c in cells:
        if c["cell_type"] == "markdown":
            m = re.search(r"^#\s+(.+)$", "".join(c["source"]), re.M)
            if m: title = re.sub(r"[*`]|\[([^\]]*)\]\([^)]*\)", r"\1", m.group(1)).strip(); break
    title = title or f.stem.replace("_", " ").replace("-", " ").strip().capitalize()
    title = re.sub(r"^(Cookbook|Recipe):\s*", "", title)
    base = GH + rel.rsplit("/", 1)[0] + "/"
    body, first_text, ncode = [], "", 0
    for c in cells:
        s = "".join(c.get("source", "")).strip()
        if not s: continue
        if c["cell_type"] == "markdown":
            s2 = re.sub(r"^#\s+.+$", "", s, count=1, flags=re.M) if title and s.lstrip().startswith("# ") else s
            t = clean_md(s2, base)
            if t:
                body.append(t)
                if not first_text and len(t) > 60 and not t.startswith(("**", "|", "-", "```")): first_text = t
        elif c["cell_type"] == "code":
            code = "\n".join(l for l in s.split("\n") if not re.match(r"\s*[%!]", l)).strip()
            if not code: continue
            ncode += 1
            body.append(fence("pyshow", code))
            out = _outputs(c.get("outputs"))
            if out: body.append("*Output recorded by the notebook's authors:*\n\n" + fence("text", out))
    text = "\n\n".join(body)
    if len(text) > 60000: text = text[:60000].rsplit("\n\n", 1)[0] + f"\n\n*The notebook continues in [the original]({GH + rel}).*"
    # keep code fences balanced after a cut
    if text.count("```") % 2: text += "\n```"
    plain = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", re.sub(r"[*_`]|\[([^\]]*)\]\([^)]*\)", r"\1", first_text)))[0] if first_text else f"A recipe for {title.lower()} with the Claude API."
    L = [":::prereq Before you start\n" + "\n".join([
        "- **Needs**: " + "; ".join(lesson_ref(i) for i in RELATED[group]),
        f"- **Type**: Recipe ({group}). **Runs**: in Jupyter with your own `ANTHROPIC_API_KEY`; outputs below were recorded by the notebook's authors, not run here.",
        "- **Source**: " + credit("anthropics/claude-cookbooks", "MIT", GH + rel)]) + "\n:::",
        ":::plain The idea in one line\n" + plain[:400] + "\n:::",
        "## The recipe\n\n" + text,
        "## Run it on your machine\n\n" + fence("bash", f"git clone --depth 1 https://github.com/anthropics/claude-cookbooks\ncd claude-cookbooks\npip install anthropic jupyterlab\nexport ANTHROPIC_API_KEY=...   # your key\njupyter lab {rel}"),
        "## Exercises\n\n" + "\n".join(f"{i}. {e}" for i, e in enumerate(EXER, 1)),
        f":::checked Sources and further reading\n- [{rel}]({GH + rel}) in anthropics/claude-cookbooks, MIT licence\n- [Claude API documentation](https://docs.claude.com)\n:::"]
    return title, group, "\n\n".join(L), max(20, min(90, 10 + ncode * 3))

def lessons(pno, store):
    items = []
    for f in notebooks(pno):
        try: items.append((f,) + page(f))
        except Exception as e: print("skip", f, e)
    items.sort(key=lambda x: (x[2], x[1].lower()))
    seen = {}
    out = []
    for n, (f, title, group, src, mins) in enumerate(items, 1):
        k = title.lower(); seen[k] = seen.get(k, 0) + 1
        if seen[k] > 1: title += f" ({f.stem})"
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        body = conv.body_fixer(f.parent, f"{pno}.{n}", lstore)(src)
        out.append({"title": title, "minutes": mins, "type": "Recipe", "num": f"{pno}.{n}", "src": body, "key": f"ext/recipes/{f.relative_to(R).as_posix()}",
                    "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(f.parent), "phase": "ext/recipes", "group": group, "norun": True})
    return out
