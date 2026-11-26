"""Phases 24-27: application, agent and MCP projects from patchy631/ai-engineering-hub (MIT) and
Shubhamsaboo/awesome-llm-apps (Apache-2.0). They call hosted models with the reader's own API keys, so each page
shows the design, the code and how to run it; nothing is run here."""
import pathlib, re, json, collections
import conv
from ext import EXT, WORK, clean_md, fence, credit, lesson_ref

SOURCES = [("patchy631_ai-engineering-hub", "patchy631/ai-engineering-hub", "MIT", "main", ("assets", "courses")),
           ("Shubhamsaboo_awesome-llm-apps", "Shubhamsaboo/awesome-llm-apps", "Apache-2.0", "main", ("docs",))]
CODE_EXT = (".py", ".ts", ".tsx", ".js", ".ipynb", ".sql")
NOISE = re.compile(r"newsletter|contribut|licen[cs]e|stay updated|star history|support|connect with|follow|acknowledg|author|sponsor|"
                   r"watch demo|demo video|video|screenshot|table of contents|join|community|feedback|credits|disclaimer|hire|faq", re.I)
SETUP = re.compile(r"install|setup|set up|usage|run|getting started|quick ?start|how to use|prerequisite|configuration|environment", re.I)
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]+")

STACK = [  # (label, kind, regex over imports / requirements)
    ("Streamlit", "ui", r"\bstreamlit\b"), ("Gradio", "ui", r"\bgradio\b"), ("FastAPI", "ui", r"\bfastapi\b"), ("Chainlit", "ui", r"\bchainlit\b"),
    ("Next.js", "ui", r"\bnext\b(?=[\"'/])"), ("Flask", "ui", r"\bflask\b"),
    ("CrewAI", "fw", r"\bcrewai\b"), ("LangGraph", "fw", r"\blanggraph\b"), ("LangChain", "fw", r"\blangchain\b"), ("LlamaIndex", "fw", r"\bllama_index\b|\bllama-index\b"),
    ("Agno", "fw", r"\bagno\b|\bphi\.agent\b|\bphidata\b"), ("AutoGen / AG2", "fw", r"\bautogen\b|\bag2\b"), ("OpenAI Agents SDK", "fw", r"\bagents\b import|from agents import"),
    ("Google ADK", "fw", r"google\.adk"), ("Pydantic AI", "fw", r"pydantic_ai"), ("smolagents", "fw", r"\bsmolagents\b"), ("DSPy", "fw", r"\bdspy\b"),
    ("Haystack", "fw", r"\bhaystack\b"), ("Strands", "fw", r"\bstrands\b"), ("Claude Agent SDK", "fw", r"claude_agent_sdk"), ("MCP", "fw", r"\bmcp\b|fastmcp"),
    ("OpenAI", "llm", r"\bopenai\b"), ("Anthropic Claude", "llm", r"\banthropic\b"), ("Google Gemini", "llm", r"google\.generativeai|google\.genai|\bgemini\b"),
    ("Ollama (local)", "llm", r"\bollama\b"), ("Groq", "llm", r"\bgroq\b"), ("Mistral", "llm", r"\bmistralai\b"), ("Cohere", "llm", r"\bcohere\b"),
    ("DeepSeek", "llm", r"deepseek"), ("Together AI", "llm", r"\btogether\b"), ("Hugging Face", "llm", r"\btransformers\b|huggingface_hub"),
    ("Qdrant", "db", r"\bqdrant"), ("Chroma", "db", r"\bchromadb\b|\bchroma\b"), ("Pinecone", "db", r"\bpinecone\b"), ("Milvus", "db", r"\bmilvus\b|pymilvus"),
    ("LanceDB", "db", r"\blancedb\b"), ("FAISS", "db", r"\bfaiss\b"), ("Weaviate", "db", r"\bweaviate\b"), ("pgvector", "db", r"pgvector"), ("Neo4j", "db", r"\bneo4j\b"),
    ("Firecrawl", "tool", r"firecrawl"), ("Tavily", "tool", r"\btavily\b"), ("Serper", "tool", r"\bserper\b"), ("Exa", "tool", r"\bexa_py\b|\bexa\b"),
    ("DuckDuckGo search", "tool", r"duckduckgo"), ("Browser automation", "tool", r"playwright|browser_use|selenium"), ("yfinance", "tool", r"yfinance"),
    ("ElevenLabs", "tool", r"elevenlabs"), ("AssemblyAI", "tool", r"assemblyai"), ("Whisper", "tool", r"whisper"), ("Composio", "tool", r"composio"),
]
TOPICS = [  # (group, phase, regex over path + title + readme start, related lessons)
    ("MCP servers and clients", 27, r"\bmcp\b|model context protocol", ["a1306", "a1307", "a1308"]),
    ("Multi-agent teams", 27, r"multi[_ -]?agent|agent[_ ]teams?|crew\b|swarm|a2a|acp\b|agent2agent", ["a1601", "a1605", "a1415"]),
    ("Voice agents", 26, r"voice|speech|audio|podcast|tts\b|transcri", ["a0612", "a1422"]),
    ("RAG and search", 24, r"\brag\b|_rag|rag_|-rag|rag-|retriev|vector|embedding|chat[_ -]with|graphrag|hybrid[_ ]search|knowledge[_ ]graph", ["a1106", "a1107", "a0523"]),
    ("Game and simulation agents", 26, r"game|chess|tic[_ ]tac|pygame", ["a1401"]),
    ("Agents with tools", 26, r"agent|agentic|autonomous|browser|research|assistant", ["a1401", "a1406", "a1412"]),
    ("Fine-tuning and model training", 25, r"fine[_ -]?tun|finetun|lora|grpo|reasoning[_ -]model|train", ["a1108", "a1006"]),
    ("Multimodal and vision", 25, r"vision|image|ocr|video|multimodal|latex|avatar|visual", ["a1205", "a1222"]),
    ("Evaluation and observability", 25, r"eval|observab|monitor|compar|benchmark|judge", ["a1110", "a1424"]),
    ("LLM applications", 25, r".", ["a1113", "a1101"]),
]
SPLIT_AGENT = {"Agents with tools": 26}

def _title(readme, d):
    m = re.search(r"^#\s+(.+)$", readme, re.M)
    t = m.group(1) if m else d.name.replace("_", " ").replace("-", " ")
    t = EMOJI.sub("", re.sub(r"<[^>]+>|\[!\[.*?\]\(.*?\)\]\(.*?\)|!\[.*?\]\(.*?\)|\*\*|`", "", t)).strip(" -:#")
    t = re.sub(r"\s+", " ", t)
    if not t or len(t) < 4: t = d.name.replace("_", " ").replace("-", " ").title()
    return t[0].upper() + t[1:]

def _sections(readme):
    body = re.sub(r"^#\s+.+\n", "", readme.replace("\r\n", "\n").lstrip("\ufeff"), count=1, flags=re.M)
    parts = re.split(r"^(#{2,3})\s+(.+)$", body, flags=re.M)
    intro, secs = parts[0], []
    for i in range(1, len(parts), 3):
        secs.append((EMOJI.sub("", parts[i + 1]).strip(" #:"), parts[i + 2]))
    return intro, secs

def _clean(t, base):
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", "", t)              # badges and linked pictures
    t = re.sub(r"<(p|div|a|img|picture|source|br|h\d|center|details|summary|video)[^>]*>|</(p|div|a|picture|h\d|center|details|summary|video)>", "", t)
    t = clean_md(t, base)
    t = EMOJI.sub("", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t

def _keys(d):
    keys = set()
    for f in list(d.rglob(".env*")) + [f for f in d.rglob("*") if f.suffix in CODE_EXT and f.is_file()][:40]:
        try: s = f.read_text(errors="ignore")
        except Exception: continue
        keys |= set(re.findall(r"\b([A-Z][A-Z0-9_]*(?:API_KEY|_TOKEN|_SECRET|ACCOUNT|_KEY))\b", s))
    return sorted(k for k in keys if not k.startswith(("YOUR_", "MY_")) and len(k) < 40)[:8]

def _stack(d, text):
    found = collections.OrderedDict()
    for label, kind, rx in STACK:
        if re.search(rx, text, re.I): found.setdefault(kind, []).append(label)
    return found

def _files(d):
    fs = [f for f in d.rglob("*") if f.is_file() and f.suffix in CODE_EXT and not any(p in ("node_modules", "tests", "test", ".next", "dist", "build", "__pycache__") or p.startswith(".") for p in f.relative_to(d).parts)]
    def rank(f):
        n = f.name.lower()
        pri = 0 if n in ("app.py", "main.py", "agent.py", "server.py", "streamlit_app.py", "run.py") else 1 if f.suffix == ".py" else 2 if f.suffix in (".ts", ".tsx") else 3
        return (pri, len(f.relative_to(d).parts), -f.stat().st_size if f.suffix != ".ipynb" else 0, str(f))
    return sorted(fs, key=rank)

def _nb_code(f):
    try: nb = json.loads(f.read_text())
    except Exception: return ""
    return "\n\n".join("".join(c.get("source", "")) for c in nb.get("cells", []) if c.get("cell_type") == "code")

LANG = {".py": "pyshow", ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".ipynb": "pyshow", ".sql": "sql"}
def _code_md(d, files, maxf=6, maxl=260):
    out, total = [], 0
    for f in files[:maxf]:
        txt = _nb_code(f) if f.suffix == ".ipynb" else f.read_text(errors="replace")
        lines = txt.rstrip().split("\n")
        if not txt.strip() or (len(lines) < 3 and f.name == "__init__.py"): continue
        cut = len(lines) > maxl
        body = "\n".join(lines[:maxl]) + (f"\n# … {len(lines) - maxl} more lines in the repository" if cut else "")
        rel = f.relative_to(d)
        out.append(f"??? code | `{rel}` ({len(lines)} lines{', code cells' if f.suffix == '.ipynb' else ''})\n" + fence(LANG[f.suffix], body) + "\n???")
        total += 1
    more = len(files) - total
    return "\n\n".join(out) + (f"\n\nThe project has {more} more code file{'s' if more != 1 else ''} in the repository." if more > 0 else "")

def _setup(secs, base):
    blocks = []
    for h, b in secs:
        if SETUP.search(h) and not NOISE.search(h):
            t = _clean(b, base)
            if t: blocks.append(f"**{h}**\n\n{t}")
    return "\n\n".join(blocks)[:4000]

def unit_dirs(root, skip):
    root = pathlib.Path(root); out = []
    for r in sorted(root.rglob("README.md")):
        d = r.parent
        rel = d.relative_to(root).parts
        if d == root or any(p in skip or p.startswith(".") for p in rel): continue
        if not any(f.suffix in CODE_EXT for f in d.rglob("*") if "node_modules" not in f.parts): continue
        out.append(d)
    return [d for d in out if not any(o != d and o in d.parents for o in out)]

def classify(d, title, readme):
    s = (str(d) + " " + title + " " + readme[:600]).lower()
    for g, ph, rx, rel in TOPICS:
        if re.search(rx, s): return g, ph, rel
    return TOPICS[-1][0], TOPICS[-1][1], TOPICS[-1][3]

EXER = {
    "RAG and search": ["Write ten questions whose answers you know are in your documents, run them, and count how many answers cite the right passage.",
                       "Change the chunk size (halve it, then double it) and rerun the same ten questions. Which setting answers more of them?",
                       "Add a reranking step (a cross-encoder or the model itself scoring passages) before generation and compare answers."],
    "Agents with tools": ["Add a limit on the number of tool calls per run and make the agent say so when it hits the limit.",
                          "Log every tool call with its arguments and result, then read one full run. Where does the agent waste steps?",
                          "Give the agent a tool that fails half the time. Does it retry, give up, or invent a result?"],
    "Multi-agent teams": ["Run the same task with one agent doing all roles. Compare cost, time and quality with the team.",
                          "Add a reviewer agent whose only job is to reject weak output, and count how often it does.",
                          "Trace which agent produced each part of the final answer. Is any agent's work unused?"],
    "MCP servers and clients": ["Connect the server to a second MCP client (Claude Desktop, an IDE or the MCP Inspector) and list its tools.",
                                "Add input validation to one tool and return a clear error the model can recover from.",
                                "Decide which tools should need human approval, and add that check."],
    "Voice agents": ["Measure the delay from the end of speech to the start of the reply. Which step takes longest?",
                     "Handle the user interrupting while the assistant is speaking.", "Swap the speech-to-text model for a local one and compare accuracy on five clips."],
    "Fine-tuning and model training": ["Hold out 10% of the data and compare the base and tuned model on it with the same prompt.",
                                       "Halve the number of training steps. How much quality do you lose?", "Write down what the tuned model does worse than the base model."],
}
GEN_EX = ["Replace the hosted model with a local one through Ollama and note what changes in quality and speed.",
          "Add error handling for a failed or rate-limited API call so the app explains the problem instead of crashing.",
          "Write five test inputs with the output you expect, run them, and record which ones pass."]

def build_one(src_dir, repo, lic, branch, d):
    readme = (d / "README.md").read_text(errors="replace")
    rel = d.relative_to(src_dir)
    base = f"https://github.com/{repo}/blob/{branch}/{rel.as_posix()}/"
    title = _title(readme, d)
    intro, secs = _sections(readme)
    files = _files(d)
    alltext = " ".join((f.read_text(errors="ignore")[:20000] if f.suffix != ".ipynb" else _nb_code(f)[:20000]) for f in files[:12])
    for req in ("requirements.txt", "pyproject.toml", "package.json"):
        if (d / req).exists(): alltext += " " + (d / req).read_text(errors="ignore")
    stack = _stack(d, alltext)
    keys = _keys(d)
    group, pno, related = classify(rel, title, readme)
    intro_t = _clean(intro, base)
    feat = [(h, _clean(b, base)) for h, b in secs if not NOISE.search(h) and not SETUP.search(h)]
    feat = [(h, b) for h, b in feat if b and len(b) > 30][:4]
    first = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", re.sub(r"[*_`#>]|\[([^\]]*)\]\([^)]*\)", r"\1", intro_t)).strip())[0] if intro_t else ""
    plain = first if 30 < len(first) < 300 else f"{title}: a project built with {', '.join(sum(stack.values(), [])[:4]) or 'Python'}."
    kinds = {"ui": "Interface", "fw": "Framework", "llm": "Models", "db": "Data store", "tool": "Tools and services"}
    stack_md = "\n".join(f"| {kinds[k]} | {', '.join(v)} |" for k, v in stack.items())
    L = [":::goals What you will be able to do\n" + "\n".join("- " + g for g in [
            f"Explain how {title} is put together" + (f": {', '.join(sum(stack.values(), [])[:5])}" if stack else ""),
            "Follow one request through the main code path", "Run it on your machine with your own API keys"]) + "\n:::"]
    langs = sorted({ {'.py': 'Python', '.ipynb': 'Python', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.sql': 'SQL'}[f.suffix] for f in files})
    L.append(":::prereq Before you start\n" + "\n".join([
        "- **Needs**: " + "; ".join(lesson_ref(i) for i in related),
        f"- **Type**: Project ({group}). **Runs**: on your machine with your own API keys; it is not run here, so there is no recorded output on this page.",
        f"- **Code in**: {', '.join(langs) or 'Python'}." + (f" **Keys or accounts**: {', '.join('`' + k + '`' for k in keys)}." if keys else ""),
        "- **Source**: " + credit(repo, lic, base.replace('/blob/', '/tree/').rstrip('/'))]) + "\n:::")
    L.append(":::plain The idea in one line\n" + plain + "\n:::")
    what = [intro_t] if intro_t else []
    for h, b in feat: what.append(f"**{h}**\n\n{b[:1800]}")
    L.append("## What it does\n\n" + ("\n\n".join(what)[:6000] or plain))
    if stack_md: L.append("## How it is built\n\n| Part | What this project uses |\n|---|---|\n" + stack_md)
    cm = _code_md(d, files)
    if cm: L.append("## Read the code\n\nStart with the first file: it is the entry point. The others are the pieces it calls.\n\n" + cm)
    setup = _setup(secs, base)
    clone = fence("bash", f"git clone --depth 1 --filter=blob:none --sparse https://github.com/{repo}\ncd {repo.split('/')[1]}\ngit sparse-checkout set {rel.as_posix()}\ncd {rel.as_posix()}")
    L.append("## Run it on your machine\n\n" + clone + ("\n\n" + setup if setup else "\n\nInstall the dependencies (`pip install -r requirements.txt` if the folder has one), put your keys in a `.env` file, then start the entry point shown above."))
    ex = EXER.get(group, GEN_EX)
    L.append("## Exercises\n\n" + "\n".join(f"{i}. {e}" for i, e in enumerate(ex, 1)))
    L.append(":::checked Sources and further reading\n" + f"- [{title}]({base.replace('/blob/', '/tree/').rstrip('/')}) in {repo}, {lic} licence\n:::")
    return dict(title=title, group=group, pno=pno, src="\n\n".join(L), stack=stack, keys=keys, dir=d, rel=rel.as_posix(), repo=repo)

_ALL = None
def all_units():
    global _ALL
    if _ALL is not None: return _ALL
    out, seen = [], collections.Counter()
    for folder, repo, lic, branch, skip in SOURCES:
        root = EXT / folder
        for d in unit_dirs(root, skip):
            try: u = build_one(root, repo, lic, branch, d)
            except Exception as e:
                print("skip", d, e); continue
            out.append(u)
    for u in out: seen[u["title"].lower()] += 1
    for u in out:
        if seen[u["title"].lower()] > 1: u["title"] += f" ({u['repo'].split('/')[0]})"
    _ALL = out; return out

def lessons(pno, store):
    units = sorted([u for u in all_units() if u["pno"] == pno], key=lambda u: (u["group"], u["title"].lower()))
    out = []
    for n, u in enumerate(units, 1):
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        body = conv.body_fixer(u["dir"], f"{pno}.{n}", lstore)(u["src"])
        out.append({"title": u["title"], "minutes": 60, "type": "Project", "num": f"{pno}.{n}", "src": body, "key": f"ext/apps/{u['repo']}/{u['rel']}",
                    "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(u["dir"]), "phase": f"ext/apps", "group": u["group"],
                    "norun": True, "stack": u["stack"]})
    return out
