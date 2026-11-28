"""build_p6.py: add phases 17-19 of AI Engineering from Scratch to the AI from Scratch site as Part 6, in the same lesson
format as phases 0-16 (this is build_vol.py, retargeted to write the site's own sources instead of a volume page).

Writes, in the site folder:
  lessons/a17xx.html, a18xx.html, a19xx.html   one per source lesson (header, prose, footer; build.py rewrites the footer)
  lessons/cs-*.html                             cheat sheets whose lessons are all new here
  data/course.json                              Part 6 added (or replaced)
  data/zxt.json                                 per-section takeaways from the voice overlays
  engine/figs.js                                the interactive figure modules these lessons use, appended once
  figs/, repo-assets/                           plots drawn by lesson code, images from the source repo
Then run tools/diagrams.py and tools/build.py in the site.

Usage: python3 build_p6.py [phase ...]      (default: 17 18 19)"""
import sys, os, re, json, html, hashlib, pathlib, subprocess, shutil, concurrent.futures as cf
import markdown
sys.path.insert(0, "/home/claude/aifs")
import conv, interviews, extras, conv_px

REPO = pathlib.Path("/home/claude/upstream")
SITE = pathlib.Path("/home/claude/ai-from-zero-to-hero")
CACHE = pathlib.Path("/home/claude/aifs/cache"); CACHE.mkdir(exist_ok=True)
VOICE = pathlib.Path("/home/claude/aifs/voice"); VOICE.mkdir(exist_ok=True)
PY = "/home/claude/venv/bin/python"
KATEX = "/home/claude/kx/node_modules/katex"
PART = "Serving, Safety & Capstones"
PHASES = {
    17: ("17-infrastructure-and-production", "Infrastructure & Production",
         "Running models for real users: serving engines, GPUs and autoscaling, caching and routing, observability, releases, reliability, security, compliance and cost."),
    18: ("18-ethics-safety-alignment", "Ethics, Safety & Alignment",
         "Why aligned behaviour is hard to get and to check: reward hacking, deception, control, red teaming, jailbreaks, fairness, privacy, watermarking and regulation."),
    19: ("19-capstone-projects", "Capstone Projects",
         "Put it all together: full projects, from a coding agent and a production RAG system to a GPT, a training stack and a safety gate built step by step."),
}
PHASES.update({
    20: ("projects", "Hands-On Projects",
         "Small, complete tools built one tested step at a time: search, evaluation, agents, gateways, sandboxes and more, in Python, TypeScript, Go and Rust."),
    21: ("interviews/scenarios", "Interview Case Files",
         "Real measured incidents to debug the way an interview round asks you to: read the evidence one listing at a time, find the cause, then design the fix."),
})
PART_OF = {17: PART, 18: PART, 19: PART, 20: "Projects and Case Files", 21: "Projects and Case Files"}
import ext, importlib
for _p, _v in ext.PHASES.items(): PHASES[_p] = _v; PART_OF[_p] = ext.PART
PART_OF[31] = "Forward Deployed Engineering"
PART_OF[32] = "MLOps and LLMOps"
PART_OF[33] = "AI on Snowflake"
EXT_MOD = {22: "ext_ml", 23: "ext_scratch", 24: "ext_apps", 25: "ext_apps", 26: "ext_apps", 27: "ext_apps", 28: "ext_recipes", 29: "ext_recipes", 30: "ext_snow", 31: "ext_fde", 32: "ext_ops", 33: "ext_snowai", 34: "ext_upd"}
LEVEL_NAMES = {1: "Starter", 2: "Builder", 3: "Engineer", 4: "Systems", 5: "Frontier"}
DEMOS = json.loads((pathlib.Path("/home/claude/aifs/px/demos.json")).read_text()) if pathlib.Path("/home/claude/aifs/px/demos.json").exists() else {}
ONLY = [int(x) for x in sys.argv[1:]] or [17, 18, 19]
LABELS = {"goals": "Lesson goals", "run": "What you should see", "terms": "Terms you'll hear", "prereq": "Before you start",
          "plain": "In plain words first", "checked": "Sources and further reading", "warn": "Watch out", "tip": "Tip",
          "worked": "Worked example", "predict": "Predict before you run", "broken": "Break it on purpose",
          "debugx": "Debugging exercise", "modify": "Make it your own", "read": "Reading this output", "check": "Check your mental model",
          "deeper": "Go deeper (optional)", "math": "The same idea as a formula", "recap": "Recap", "connect": "How this connects",
          "why": "Why this came about", "visual": "See it drawn", "prod": "In production", "practice": "Industry practice"}
QLVL = {"tests": "Checks", "code": "Code", "sol": "Solution", "explain": "Explain the mechanism", "debug": "Debug a failure", "defend": "Defend a design",
        "tradeoff": "Weigh a trade-off", "coderead": "Read the code", "estimate": "Estimate it", "takehome": "Take-home"}

def md(t): return markdown.markdown(t, extensions=["fenced_code", "tables", "sane_lists", "attr_list"])
def inline(t): return re.sub(r"^<p>(.*)</p>$", r"\1", md(t).strip(), flags=re.S)

# ---------------------------------------------------------------- gather and convert
store = {"mermaid": {}, "math": {}, "figcfg": {}}
lessons, chapters = [], []
def _demo(pid):                         # the reference demo's output: run here, or the source's own recording if it fails here
    d = DEMOS.get(pid)
    if d and d.get("code") == 0: return d
    rec = REPO / "projects" / pid / "media" / "output.json"
    if rec.exists():
        r = (json.loads(rec.read_text()).get("records") or [{}])[0]
        if r.get("exitCode") == 0:
            out = re.sub(r"/(?:var/folders|private/var/folders|tmp)/\S*?/(tmp\w+)", r"<tmp>", r.get("output", ""))
            return {"code": 0, "out": out, "recorded": True}
    return None
for pno, (ph, title, desc) in PHASES.items():
    if pno not in ONLY and pno >= 20: continue
    ch = {"id": f"ph-{pno}", "code": f"{pno}", "title": title, "desc": desc, "lessons": [], "pno": pno}
    if pno >= 22:
        for c in importlib.import_module(EXT_MOD[pno]).lessons(pno, store):
            lessons.append(c); ch["lessons"].append(c)
        chapters.append(ch); continue
    if pno == 20:
        projs = [json.loads(f.read_text()) for f in sorted((REPO / "projects").glob("*/project.json"))]
        projs = sorted((j for j in projs if j.get("status") == "ready"), key=lambda j: (j.get("level", 9), j["title"].lower()))
        for n, j in enumerate(projs, 1):
            lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
            c = conv_px.convert_project(REPO / "projects" / j["id"], f"{pno}.{n}", lstore, _demo(j["id"]))
            c.update(id=f"a{pno:02d}{n:02d}", blocks=lstore["blocks"], dir=str(REPO / "projects" / j["id"]), phase=ph,
                     group=f"Level {j.get('level')} · {LEVEL_NAMES.get(j.get('level'), '')}")
            lessons.append(c); ch["lessons"].append(c)
        chapters.append(ch); continue
    if pno == 21:
        loop = (REPO / "interviews" / "loops" / "inference-engineer.md").read_text()
        lb = re.sub(r"^---\n.*?\n---\n", "", loop, flags=re.S)
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        fx = conv.body_fixer(REPO / "interviews" / "loops", f"{pno}.1", lstore)
        c = {"title": "Inference engineer loop", "minutes": 20, "type": "Guide", "num": f"{pno}.1", "slug": "loop",
             "src": "## How a loop is put together\n\n" + fx(lb.strip()), "key": "interviews/loops/inference-engineer"}
        c.update(id=f"a{pno:02d}01", blocks=lstore["blocks"], dir=str(REPO / "interviews" / "loops"), phase=ph)
        lessons.append(c); ch["lessons"].append(c)
        scen = []
        for sd in sorted((REPO / "interviews" / "scenarios").iterdir()):
            if not (sd / "README.md").exists(): continue
            mt, _ = conv_px._front((sd / "README.md").read_text())
            scen.append((int(mt.get("level", 2) or 2), int(mt.get("minutes", 20) or 20), mt.get("title", sd.name).lower(), sd))
        for n, (lv, _, _, sd) in enumerate(sorted(scen), 2):
            lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
            c = conv_px.convert_scenario(sd, f"{pno}.{n}", lstore)
            c.update(id=f"a{pno:02d}{n:02d}", blocks=lstore["blocks"], dir=str(sd), phase=ph,
                     group=f"Level {lv} · {conv_px.LEVELS.get(str(lv), '')}")
            lessons.append(c); ch["lessons"].append(c)
        chapters.append(ch); continue
    pdir = REPO / "phases" / ph
    for ld in sorted(x for x in pdir.iterdir() if x.is_dir() and re.match(r"\d\d-", x.name)):
        ln = int(ld.name[:2])
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        c = conv.convert(ld, f"{pno}.{ln}", lstore)
        c.update(id=f"a{pno:02d}{ln:02d}", blocks=lstore["blocks"], dir=str(ld), phase=ph)
        lessons.append(c); ch["lessons"].append(c)
    chapters.append(ch)

# ---------------------------------------------------------------- voice overlays (same directives as build_vol.py)
ZXT_ADD = {}
def section_end(src, i):
    j = src.find("\n## ", i + 3)
    if j >= 0: return j + 1
    ends = [k for k in (src.find("\n:::checked", i), src.find("\n```quiz", i)) if k >= 0]
    return (min(ends) + 1) if ends else len(src)
def mainpy_md(c, intro):
    f = pathlib.Path(c["dir"]) / "code" / "main.py"
    code = f.read_text().rstrip() + "\n"
    code = re.sub(r'\nif __name__ == ["\']__main__["\']:\n(?:[ \t]+.*\n?|\n)+$', "\n", code)
    lines = code.splitlines(keepends=True)
    try:                                  # cut only at real top-level definitions (never inside a string)
        import ast as _ast
        starts = sorted({min([n.lineno] + [d.lineno for d in getattr(n, "decorator_list", [])]) - 1
                         for n in _ast.parse(code).body if isinstance(n, (_ast.FunctionDef, _ast.AsyncFunctionDef, _ast.ClassDef))})
    except SyntaxError:
        starts = [i for i, l in enumerate(lines) if re.match(r"(async def |def |class |@)", l) and not (i and lines[i - 1].startswith("@"))]
    cuts, last = [0], 0
    for s in starts:
        if s - last >= 45: cuts.append(s); last = s
    cuts.append(len(lines)); parts = ["".join(lines[a:b]) for a, b in zip(cuts, cuts[1:]) if "".join(lines[a:b]).strip()]
    has_main = re.search(r"^def main\(", code, re.M)
    n = len(parts) + (1 if has_main else 0)
    out = [(intro.strip() + "\n\n") if intro.strip() else "",
           f"Here is `code/main.py`, in {n} parts. Each part runs on this page, in order, in one Python session"
           + ("; the last part does what `python3 code/main.py` does." if has_main else ".")]
    for k, p in enumerate(parts, 1):
        names = re.findall(r"^(?:async def|def|class) (\w+)", p, re.M)
        label = ", ".join(f"`{x}`" for x in names[:6]) + (" and more" if len(names) > 6 else "") if names else "setup: imports and constants"
        c["blocks"].append("#!run\n" + p)
        out.append(f"**Part {k} of {n} · {label}**\n\n```python\n{p.rstrip()}\n```\n\n{{{{RUN:{len(c['blocks']) - 1}}}}}")
    if has_main:
        c["blocks"].append("#!run\nimport sys as _s; _s.argv = ['main.py']\nmain()\n")
        out.append(f"**Part {n} of {n} · run it** (what `python3 code/main.py` does)\n\n```python\nmain()\n```\n\n{{{{RUN:{len(c['blocks']) - 1}}}}}")
    return "\n\n".join(x for x in out if x)

def apply_overlay(c):
    f = VOICE / f"{c['id']}.md"
    if not f.exists(): return
    src = c["src"]
    for kind, arg, body in re.findall(r"^@@(top|end|before|takeaways|code|after|replace|skip|mainpy)[ ]?(.*?)\n(.*?)\n@@[ ]*$", f.read_text(), re.S | re.M):
        if kind == "mainpy":          # the lesson's code/main.py, in parts that run on the page in one session, then main()
            body = mainpy_md(c, body)
        if kind == "replace":
            old_t, new_t = body.split("\n===\n", 1)
            if "$" in new_t: new_t = interviews._math(new_t, store)
            if old_t not in src and "$" in old_t and interviews._math(old_t, store) in src: old_t = interviews._math(old_t, store)
            if old_t not in src:
                pno = int(c["id"][1:3])
                lk = lambda t: re.sub(r"\bLesson (\d{2})\b(?![.\d])", lambda mm: f"[Lesson {pno}.{int(mm.group(1))}](#a{pno:02d}{int(mm.group(1)):02d})", t)
                if lk(old_t) in src: old_t, new_t = lk(old_t), lk(new_t)
            if old_t not in src:
                hit = next((k for k in re.findall(r"\{\{MM:(\w+)\}\}", src) if old_t in store["mermaid"][k]), None)
                if not hit: raise SystemExit(f"overlay {c['id']}: replace target not found: {old_t[:60]!r}")
                code = store["mermaid"][hit].replace(old_t, new_t, 1); k2 = conv.h(code); store["mermaid"][k2] = code
                src = src.replace("{{MM:%s}}" % hit, "{{MM:%s}}" % k2, 1); continue
            src = src.replace(old_t, new_t, 1); continue
        if kind == "skip":
            for n in map(int, arg.split()): c["blocks"][n] = "# AIFS_NORUN\n" + c["blocks"][n]
            continue
        if kind == "code":
            n = int(arg); old_code = c["blocks"][n]; new_code = body.rstrip("\n") + "\n"
            tag = "```python\n" + old_code + "```\n\n{{RUN:%d}}" % n
            if tag not in src: raise SystemExit(f"overlay {c['id']}: block {n} not found")
            src = src.replace(tag, "```python\n" + new_code + "```\n\n{{RUN:%d}}" % n, 1); c["blocks"][n] = new_code; continue
        def mermaid_fence(mm):
            k = conv.h(mm.group(1)); store["mermaid"][k] = mm.group(1); return "{{MM:%s}}" % k
        body = re.sub(r"^```mermaid\n(.*?)^```[ \t]*$", mermaid_fence, body, flags=re.S | re.M)
        if kind != "takeaways": body = interviews._math(body, store)
        def runnable(mm):
            code = mm.group(1); c["blocks"].append("#!run\n" + code); n = len(c["blocks"]) - 1
            if "plt.show()" in code: return "PLOTCODE_START\n\n```python\n" + code + "```\n\nPLOTCODE_END\n\n{{RUN:%d}}" % n
            return "```python\n" + code + "```\n\n{{RUN:%d}}" % n
        body = re.sub(r"^```python run\n(.*?)^```[ \t]*$", runnable, body, flags=re.S | re.M)
        if kind == "after":
            tag = "{{RUN:%d}}" % int(arg)
            if tag not in src: raise SystemExit(f"overlay {c['id']}: no run {arg}")
            src = src.replace(tag, tag + "\n\n" + body.strip() + "\n", 1); continue
        if kind == "takeaways":
            ZXT_ADD[c["id"]] = [l for l in body.splitlines() if "|" in l]; continue
        h = arg.strip() if arg.strip().startswith("#") else "## " + arg.strip()
        i = src.find("\n" + h + "\n") + 1 if ("\n" + h + "\n") in src else (0 if src.startswith(h + "\n") else -1)
        if i < 0: raise SystemExit(f"overlay {c['id']}: no heading {h!r}")
        if kind == "top":
            k = i + len(h) + 1; src = src[:k] + "\n" + body.strip() + "\n\n" + src[k:].lstrip("\n")
        elif kind == "before":
            src = src[:i] + body.strip() + "\n\n" + src[i:]
        else:
            k = section_end(src, i); src = src[:k].rstrip("\n") + "\n\n" + body.strip() + "\n\n" + src[k:]
    c["src"] = src
for c in lessons:
    apply_overlay(c)
    if c["id"] in ZXT_ADD:
        heads = set(re.findall(r"^## (.+)$", c["src"], re.M)); tk, bad = {}, []
        for l in ZXT_ADD[c["id"]]:
            cut = next((m.start() for m in re.finditer(r"\|", l) if l[:m.start()].strip() in heads), None)
            if cut is None: bad.append(l.split("|", 1)[0].strip())
            else: tk[l[:cut].strip()] = l[cut + 1:].strip()
        ZXT_ADD[c["id"]] = tk
        if bad: raise SystemExit(f"overlay {c['id']}: takeaways for missing headings {bad}")
print("voice overlays", len(ZXT_ADD), "of", len(lessons))

# ---------------------------------------------------------------- cheat sheets and practice problems
from collections import defaultdict
extras.MATH_HOOK = lambda t: interviews._math(t, store)
BY_DIR = {c.get("key") or f"phases/{c['phase']}/{pathlib.Path(c['dir']).name}": c for c in lessons}
COURSE = json.load(open(SITE / "data" / "course.json"))
PARTS_BUILT = sorted({PART_OF[p] for p in ONLY})
OLD_PARTS = {p["title"]: p for p in COURSE}
COURSE = [p for p in COURSE if p["title"] not in PARTS_BUILT]
SITE_IDS = {l["id"] for p in COURSE for ch in p["chapters"] for l in ch["lessons"]}
SITE_NUM = {l["id"]: l.get("num", "") for p in COURSE for ch in p["chapters"] for l in ch["lessons"]}
def site_lesson(p):                       # "phases/14-agent-engineering/01-the-agent-loop" -> "a1401" if it is in the site
    m = re.match(r"phases/(\d\d)-[^/]+/(\d\d)-", p.strip()); i = m and f"a{m.group(1)}{m.group(2)}"
    return i if i in SITE_IDS else None
PRACTICE, SHEETS_OF, SHEET_PAGES = defaultdict(list), defaultdict(list), []
for _m in sorted((REPO / "practice").glob("*/meta.json")):
    _meta = json.loads(_m.read_text()); _c = BY_DIR.get(_meta.get("lesson", "").rstrip("/"))
    if _c: PRACTICE[_c["id"]].append((_meta, extras.practice_html(_meta["id"])))
for _f in sorted((REPO / "cheatsheets").glob("*.md")):
    if _f.name.isupper() or _f.name == "AUTHORING.md": continue
    _meta, _ = extras.parse_sheet(_f)
    srcs = [p.strip() for p in _meta.get("sources", "").split(",") if p.strip()]
    _covers = [BY_DIR[p] for p in srcs if p in BY_DIR]
    if not _covers: continue
    have = sorted(i for i in SITE_IDS if i == "cs-" + _meta["id"] or i.startswith("cs-" + _meta["id"] + "-v"))
    if have or any(site_lesson(p) for p in srcs):   # already in the site under an earlier phase: link to it
        e = {"id": have[0] if have else None, "title": _meta["title"], "code": _meta.get("code", ""), "hue": _meta.get("hue", "200")}
        if e["id"]:
            for _c in _covers: SHEETS_OF[_c["id"]].append(e)
        continue
    _home = min(_covers, key=lambda c: c["id"])
    e = {"id": "cs-" + _meta["id"], "num": "Cheat sheet", "title": _meta["title"], "minutes": 5, "sheet": _meta["id"],
         "covers": [c["id"] for c in sorted(_covers, key=lambda c: c["id"])], "code": _meta.get("code", ""), "hue": _meta.get("hue", "200"),
         "html": extras.sheet_html(_meta["id"], {p: f"{c['num']} {c['title']}" for p, c in BY_DIR.items()}), "chapter": "ph-" + _home["id"][1:3]}
    SHEET_PAGES.append(e)
    for _c in _covers: SHEETS_OF[_c["id"]].append(e)
for e in SHEET_PAGES:
    next(ch for ch in chapters if ch["id"] == e["chapter"])["lessons"].append(e)
for c in lessons:
    if c["id"] not in PRACTICE and c["id"] not in SHEETS_OF: continue
    src = c["src"]; k = src.find("\n## Ship it\n")
    if k < 0: k = min([i for i in (src.find("\n:::checked"), src.find("\n```quiz"), src.find("\n## Interview questions")) if i >= 0] or [len(src)])
    c["src"] = src[:k].rstrip() + "\n\n## Practice and reference\n\nEXTRASPH\n\n" + src[k:].lstrip("\n")
print("practice problems", sum(len(v) for v in PRACTICE.values()), "| new cheat sheets", len(SHEET_PAGES))

# ---------------------------------------------------------------- interview questions (only those no earlier lesson already carries)
LDIR = {c.get("key") or f"phases/{c['phase']}/{pathlib.Path(c['dir']).name}": c for c in lessons}
interviews.EXCLUDE = lambda p: bool(site_lesson(p.rstrip("/")))
QA = interviews.load(lambda p: p.rstrip("/") in LDIR, lambda p: LDIR[p.rstrip("/")]["id"], store)
for c in lessons:
    qs = QA.get(c["id"])
    if not qs: continue
    sec = ("## Interview questions\n\n{{qatoggle}}\n\nQuestions from real AI engineering interviews that this lesson prepares you for. "
           "Answer out loud first, then open the worked answer.\n\n" + "\n\n".join(qs))
    src = c["src"]; cut = min([i for i in (src.find(":::checked"), src.find("```quiz")) if i >= 0] or [len(src)])
    c["src"] = src[:cut].rstrip() + "\n\n" + sec + "\n\n" + src[cut:]
print("interview questions", sum(len(v) for v in QA.values()), "in", len(QA), "lessons")

# ---------------------------------------------------------------- run the Python (small and CPU only; long jobs are marked @@skip)
def run_lesson(c):
    if not c["blocks"] or int(c["id"][1:3]) not in ONLY or c.get("norun"): return c["id"], []
    key = hashlib.md5((json.dumps(c["blocks"]) + ("nbv1" if c.get("nb") else "p6v1")).encode()).hexdigest()
    cf_ = CACHE / f"run_{c['id']}_{key}.json"
    if cf_.exists(): return c["id"], json.loads(cf_.read_text())
    ldir = pathlib.Path(c["dir"]); wd = pathlib.Path(f"/home/claude/aifs/run/{ldir.parent.name}/{ldir.name}/code"); wd.mkdir(parents=True, exist_ok=True)
    for sib in ldir.parent.iterdir():
        link = wd.parent.parent / sib.name
        if sib.is_dir() and sib != ldir and not link.exists():
            try: link.symlink_to(sib)
            except FileExistsError: pass
    for f in (ldir / "code").glob("*.py"): (wd / f.name).write_text(f.read_text())
    if c.get("nb"):                        # notebook projects: their data folders and helper packages too
        for f in (ldir / "code").iterdir():
            if f.suffix != ".py" and not (wd / f.name).exists(): (wd / f.name).symlink_to(f)
    blocks = [("raise SystemExit  # not run\n" + b) if b.startswith("# AIFS_NORUN") else b for b in c["blocks"]]
    (wd / "blocks.json").write_text(json.dumps(blocks))
    try:
        subprocess.run([PY, "/home/claude/aifs/runner.py", "blocks.json", "res.json"], cwd=wd, timeout=1800 if c.get("nb") else 600, capture_output=True,
                       env={**os.environ, "HF_HUB_OFFLINE": "1", "OMP_NUM_THREADS": "2", **({"AIFS_NB": "1"} if c.get("nb") else {}),
                            **({"PYTHONPATH": "/home/claude/aifs/sitefix"} if "multiprocessing" in "".join(c["blocks"]) else {})})
        res = json.loads((wd / "res.json").read_text())
    except Exception as e:
        res = [{"status": "error", "err": str(e)}] * len(c["blocks"])
    for i, b in enumerate(c["blocks"]):
        if b.startswith("# AIFS_NORUN") and i < len(res): res[i] = {"status": "skipped"}
    cf_.write_text(json.dumps(res)); return c["id"], res
with cf.ThreadPoolExecutor(3) as ex:
    RUNS = dict(ex.map(run_lesson, [c for c in lessons if not c.get("heavy")]))
for c in lessons:                          # memory-hungry lessons (124M-parameter models) one at a time
    if c.get("heavy"): RUNS.update([run_lesson(c)])
stat = {}
for v in RUNS.values():
    for r in v: stat[r["status"]] = stat.get(r["status"], 0) + 1
print("python blocks", stat)

# ---------------------------------------------------------------- diagrams and maths
MCFG = CACHE / "mermaid.json"
MCFG.write_text(json.dumps({"theme": "base", "themeVariables": {
    "fontFamily": "Inter, system-ui, sans-serif", "fontSize": "14px", "primaryColor": "#f9e8da", "primaryBorderColor": "#b5521b",
    "primaryTextColor": "#211c16", "lineColor": "#6c6357", "secondaryColor": "#e7e8f7", "tertiaryColor": "#f4efe7",
    "clusterBkg": "#faf7f2", "clusterBorder": "#d8cdbc", "edgeLabelBackground": "#ffffff", "nodeBorder": "#b5521b"},
    "flowchart": {"curve": "basis", "htmlLabels": False}, "sequence": {"useMaxWidth": True}}))
def mermaid(k):
    out = CACHE / f"mm_{k}.svg"
    if out.exists() and out.stat().st_size > 100: return k, out.read_text()
    src = CACHE / f"mm_{k}.mmd"; src.write_text(store["mermaid"][k])
    subprocess.run(["mmdc", "-i", str(src), "-o", str(out), "-c", str(MCFG), "-b", "transparent", "-q"], capture_output=True, timeout=120)
    return k, out.read_text() if out.exists() else ""
with cf.ThreadPoolExecutor(4) as ex:
    MM = dict(ex.map(mermaid, list(store["mermaid"])))
print("mermaid", sum(1 for v in MM.values() if v), "of", len(MM))
def mm_html(k):
    s = MM.get(k, "")
    if not s: return '<pre class="mm-fallback"><code class="language-plaintext">' + html.escape(store["mermaid"][k]) + "</code></pre>"
    s = re.sub(r"<\?xml.*?\?>", "", s)
    s = re.sub(r'<svg ([^>]*?)style="max-width: ([\d.]+)px;?"', lambda m: '<svg ' + m.group(1) + 'style="max-width:min(100%%,%spx)"' % m.group(2), s, count=1)
    s = re.sub(r'<svg ', '<svg class="dg mm" ', s, count=1).replace("my-svg", "mm" + k)
    return '<figure class="diagram mmfig"><div class="dg-scroll">' + s + "</div></figure>"
mj = CACHE / "math_in.json"; mj.write_text(json.dumps(store["math"]))
subprocess.run(["node", "-e", r"""
const katex=require('%s');const fs=require('fs');
const inp=JSON.parse(fs.readFileSync(process.argv[1]));const out={};
for(const k in inp){const [src,disp]=inp[k];try{out[k]=katex.renderToString(src,{displayMode:disp,throwOnError:false,strict:false,output:'html'})}catch(e){out[k]=null}}
fs.writeFileSync(process.argv[2],JSON.stringify(out));""" % KATEX, str(mj), str(CACHE / "math_out.json")], check=True)
KX = json.loads((CACHE / "math_out.json").read_text())
print("maths", sum(1 for v in KX.values() if v), "of", len(KX))

# ---------------------------------------------------------------- one lesson to HTML (as build_vol.py)
FIGS_USED, RUNFIGS = set(), {}
def fig_src(b64):
    import base64
    name = f"figs/{hashlib.md5(b64.encode()).hexdigest()[:16]}.png"
    (SITE / name).parent.mkdir(exist_ok=True)
    if not (SITE / name).exists(): (SITE / name).write_bytes(base64.b64decode(b64))
    return name
def post(s):
    s = s.replace("<p>PLOTCODE_START</p>", '<details class="plot-code"><summary>Show the code that draws this</summary>').replace("<p>PLOTCODE_END</p>", "</details>")
    s = re.sub(r"\{\{MM:(\w+)\}\}", lambda m: mm_html(m.group(1)), s)
    s = re.sub(r"\{\{KX:(\w+)\}\}", lambda m: '<div class="kx">' + (KX.get(m.group(1)) or html.escape(store["math"][m.group(1)][0])) + "</div>", s)
    s = re.sub(r"\{\{KI:(\w+)\}\}", lambda m: KX.get(m.group(1)) or html.escape(store["math"][m.group(1)][0]), s)
    def fig(m):
        spec = store.get("figcfg", {}).get(m.group(1)[4:], m.group(1)) if m.group(1).startswith("cfg_") else m.group(1)
        FIGS_USED.add(spec.split()[0])
        return f'<figure class="aifig"><div class="lesson-figure" data-figure="{html.escape(spec)}"></div></figure>'
    return re.sub(r"\{\{FIG:([\w-]+)\}\}", fig, s)
def run_box(c, i):
    r = RUNS.get(c["id"]) or []
    if i >= len(r) or r[i]["status"] != "ok" or not (r[i].get("out", "").strip() or r[i].get("imgs")): return ""
    imgs = "".join(f'<img class="run-fig" alt="Plot drawn by the code above" loading="lazy" src="{fig_src(b)}">' for b in r[i].get("imgs", []))
    if not r[i].get("out", "").strip():
        return f'<aside class="co co-run"><div class="co-label">What you should see</div><div class="co-body">{imgs}</div></aside>'
    lines = r[i]["out"].rstrip("\n").split("\n")
    if len(lines) > 40: lines = lines[:36] + ["…", f"({len(lines) - 36} more lines)"]
    txt = "\n".join(l[:160] for l in lines)
    return ('<aside class="co co-run"><div class="co-label">What you should see</div><div class="co-body"><div class="code"><button type="button" class="copy" aria-label="Copy code">Copy</button>'
            '<pre><code class="language-plaintext">' + html.escape(txt) + "</code></pre></div>" + imgs + "</div></aside>")
def drop_echo(c, src):
    r = RUNS.get(c["id"]) or []
    def rep(m):
        i = int(m.group(2)); out = r[i].get("out", "") if i < len(r) and r[i]["status"] == "ok" else ""
        want = [l.strip() for l in m.group(3).splitlines() if l.strip()]; have = {l.strip() for l in out.splitlines()}
        return m.group(1) if want and out and sum(l in have for l in want) >= 0.6 * len(want) else m.group(0)
    return re.sub(r"(\{\{RUN:(\d+)\}\})[ \t]*\n\s*```text\n(.*?)```[ \t]*(?=\n|$)", rep, src, flags=re.S)
def boxes(body, mid):
    holders = {}
    def hold(s):
        k = f"PHX{len(holders):04d}PHX"; holders[k] = s; return f"\n\n{k}\n\n"
    def quiz_sub(m):
        out, qn = [], 0
        for block in re.split(r"\n\s*\n", m.group(1).strip()):
            lines = [l for l in block.strip().splitlines() if l.strip()]
            q = lines[0][2:].strip(); opts, expl = [], ""
            for l in lines[1:]:
                mm = re.match(r"- \[( |x)\] (.*)", l.strip())
                if mm: opts.append((mm.group(1) == "x", mm.group(2)))
                elif l.strip().startswith(">"): expl += l.strip()[1:].strip() + " "
            qn += 1; qid = f"{mid}-q{qn}"
            btns = "".join(f'<button type="button" class="opt" data-correct="{str(c).lower()}" id="{qid}-o{i}"><span class="opt-key">{"ABCDEF"[i]}</span><span>{html.escape(t)}</span></button>' for i, (c, t) in enumerate(opts))
            out.append(f'<div class="q" id="{qid}"><p class="q-text"><span class="q-num">Q{qn}</span>{html.escape(q)}</p><div class="opts">{btns}</div><p class="q-explain" hidden>{html.escape(expl.strip())}</p></div>')
        return hold('<section class="quiz" aria-label="Check your understanding"><div class="quiz-head"><h2>Check your understanding</h2><span class="quiz-score" aria-live="polite"></span></div>' + "".join(out) + "</section>")
    body = re.sub(r"```quiz\n(.*?)\n```", quiz_sub, body, flags=re.S)
    def call_sub(m):
        kind, ttl, inner = m.group(1), m.group(2).strip(), m.group(3)
        label = LABELS.get(kind, kind.title())
        head = f'<div class="co-label">{label}</div>' + (f'<div class="co-title">{html.escape(ttl)}</div>' if ttl and ttl != label else "")
        inner = re.sub(r"\{\{RUN:(\d+)\}\}", lambda m: "\n\nRUNPH%sRUNPH\n\n" % m.group(1), inner)
        bh = post(md(inner))
        bh = re.sub(r"(<p>)?RUNPH(\d+)RUNPH(</p>)?", lambda m: run_box({"id": mid}, int(m.group(2))), bh)
        if kind == "check":
            bh = bh.replace("✗", '<span class="ck-no" aria-label="Wrong">✗</span>').replace("✓", '<span class="ck-yes" aria-label="Right">✓</span>')
        return hold(f'<aside class="co co-{kind}">{head}<div class="co-body">{bh}</div></aside>')
    qa_n = [0]
    def qa_sub(m):
        lvl, q, inner = m.group(1), m.group(2).strip(), m.group(3); qa_n[0] += 1
        return hold(f'<details class="qa" id="{mid}-qa{qa_n[0]}"><summary><span class="qa-lvl qa-{lvl}">{QLVL.get(lvl, lvl.title())}</span>'
                    f'<span class="qa-q">{post(inline(q))}</span></summary><div class="qa-a">{post(md(inner))}</div></details>')
    body = re.sub(r"^\?\?\? (\w+) \| (.+?)\n(.*?)\n\?\?\?[ ]*$", qa_sub, body, flags=re.S | re.M)
    body = body.replace("{{qatoggle}}", hold('<p class="qa-tools"><button type="button" class="qa-all" aria-pressed="false">Open all answers</button>'
                                             '<span class="qa-hint">Try answering out loud first, then open one answer at a time.</span></p>'))
    body = re.sub(r"^:::(\w+)[ ]?(.*?)\n(.*?)\n:::\s*$", call_sub, body, flags=re.S | re.M)
    return body, holders
def extras_section(c):
    parts = []
    if SHEETS_OF.get(c["id"]):
        links = "".join(f'<a href="#{e["id"]}"><span class="t" style="--cs-hue:{e["hue"]}">{html.escape(e["code"])}</span>Cheat sheet · {html.escape(e["title"])}</a>' for e in SHEETS_OF[c["id"]])
        parts.append(f'<p class="ref-lead">One-page references from the source repository that cover this lesson, with commands, defaults and fixes in one place.</p><div class="ref-strip">{links}</div>')
    for meta, ph in PRACTICE.get(c["id"], []):
        parts.append(f'<h3 class="px-h">Practice problem · {html.escape(meta["title"])}</h3>'
                     '<p class="ref-lead">From the source repository: write the function, then press "Run the checks". They run as real Python in your browser '
                     '(the first run loads Python, about 10 MB) and tell you which part is wrong and why. Hints open one at a time; the reference solution opens when every check passes.</p>' + ph)
    return "".join(parts)
def lesson_html(c):
    body, holders = boxes(drop_echo(c, c["src"]), c["id"])
    body = re.sub(r"\{\{RUN:(\d+)\}\}", lambda m: "\n\nRUNPH%sRUNPH\n\n" % m.group(1), body)
    out = md(body)
    for k, v in holders.items(): out = out.replace(f"<p>{k}</p>", v).replace(k, v)
    out = re.sub(r"(<p>)?RUNPH(\d+)RUNPH(</p>)?", lambda m: run_box(c, int(m.group(2))), out)
    out = out.replace("<p>EXTRASPH</p>", extras_section(c))
    out = post(out)
    out = out.replace('class="language-text"', 'class="language-plaintext"').replace('class="language-jl"', 'class="language-julia"').replace('class="language-ts"', 'class="language-typescript"')
    out = out.replace("<table>", '<div class="tbl"><table>').replace("</table>", "</table></div>")
    out = re.sub(r"<pre><code", '<div class="code"><button type="button" class="copy" aria-label="Copy code">Copy</button><pre><code', out)
    out = re.sub(r"</code></pre>(?!</div></div></aside>)", "</code></pre></div>", out)
    out = out.replace('</code></pre></div></div></div></aside>', '</code></pre></div></div></aside>')
    return out
def repo_imgs(a):                          # images from the source repo ship as files next to the page
    def rep(m):
        rel = m.group(2); src = REPO / rel
        if not src.exists(): return m.group(0)
        dst = SITE / "repo-assets" / rel; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(src.read_bytes())
        return m.group(1) + "repo-assets/" + rel + '"'
    return re.sub(r'(<img[^>]*?src=")' + re.escape(conv.REPO_URL) + r'([^"]+)"', rep, a)

FOOT = ('<footer class="m-foot"><div class="done-row"><button type="button" class="done-btn" data-id="{i}" id="done-{i}">Mark complete and continue</button>'
        '<button type="button" class="undo-btn" data-id="{i}" id="undo-{i}" hidden>Mark as not done</button></div><div class="pn-row"></div></footer>')
def crumbs(ch):
    return (f'<nav class="crumbs" aria-label="Where you are"><a href="#home">Course home</a><span aria-hidden="true">/</span>'
            f'<a href="#{ch["id"]}">Phase {ch["code"]} · {html.escape(ch["title"])}</a></nav>')
written = 0
for ch in chapters:
    if ch["pno"] not in ONLY: continue
    for l in ch["lessons"]:
        if l.get("sheet"):
            covers = ", ".join(f'<a href="#{x}">{html.escape(next(c["num"] for c in lessons if c["id"] == x))}</a>' for x in l["covers"])
            a = (f'<header class="m-head">{crumbs(ch)}<h1>{html.escape(l["title"])}</h1>'
                 f'<div class="m-meta"><span class="chip chip-num">Cheat sheet</span><span class="chip">Lessons {covers}</span>'
                 f'<span class="chip chip-done" data-done-chip="{l["id"]}" hidden>Completed</span></div></header>'
                 f'<div class="prose cs-page">{post(l["html"])}</div>' + FOOT.format(i=l["id"]))
        else:
            a = (f'<header class="m-head">{crumbs(ch)}<h1>{html.escape(l["title"])}</h1>'
                 f'<div class="m-meta"><span class="chip chip-num">Lesson {l["num"]}</span><span class="chip">{l["minutes"]} min</span><span class="chip chip-core">{html.escape(l["type"])}</span>'
                 f'<span class="chip chip-done" data-done-chip="{l["id"]}" hidden>Completed</span></div></header>'
                 f'<div class="prose">{lesson_html(l)}</div>' + FOOT.format(i=l["id"]))
        a = repo_imgs(a).replace("�", "&#xFFFD;").replace("\x00", "␀")
        (SITE / "lessons" / f'{l["id"]}.html').write_text(a); written += 1
print("lesson files written", written)

# ---------------------------------------------------------------- course data, takeaways, figure modules
def _lesson_entry(l):
    e = {"id": l["id"], "num": l["num"], "title": l["title"], "min": l["minutes"], "depth": "Cheat sheet" if l.get("sheet") else "", "paths": ["A"]}
    if l.get("sheet"): e["group"] = "Cheat sheets"
    elif l.get("group"): e["group"] = l["group"]
    return e
for ptitle in PARTS_BUILT:
    part = {"title": ptitle, "chapters": [{"id": ch["id"], "code": ch["code"], "title": ch["title"], "desc": ch["desc"],
            "lessons": [_lesson_entry(l) for l in ch["lessons"]]} for ch in chapters if ch["pno"] in ONLY and PART_OF[ch["pno"]] == ptitle]}
    if ptitle in OLD_PARTS:                    # phases not rebuilt this time keep what they had
        keep = [c for c in OLD_PARTS[ptitle]["chapters"] if int(c["code"]) not in ONLY]
        part["chapters"] = sorted(keep + part["chapters"], key=lambda c: int(c["code"]))
    COURSE.append(part)
COURSE.sort(key=lambda p: min(int(c["code"]) for c in p["chapters"]) if p["chapters"] and all(c["code"].isdigit() for c in p["chapters"]) else 99)
json.dump(COURSE, open(SITE / "data" / "course.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
zxt = json.load(open(SITE / "data" / "zxt.json")); zxt.update({k: v for k, v in ZXT_ADD.items() if int(k[1:3]) in ONLY})
json.dump(zxt, open(SITE / "data" / "zxt.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
F = SITE / "engine" / "figs.js"; figs = F.read_text(); added = []
KEYS = lambda t: set(re.findall(r"['\"]([\w-]+)['\"]\s*[:,)]", t))   # every quoted name a module defines or registers
DEFINED = KEYS(figs)
have = lambda n: n in DEFINED
for f in sorted((REPO / "site").glob("figures*.js")):
    t = f.read_text(); tk = KEYS(t)
    if any(not have(n) and n in tk for n in FIGS_USED if not n.startswith("pj-")):
        DEFINED |= tk
        figs += f"\n/* module {f.name} (Part 6) */\n" + t; added.append(f.name)
pj = sorted({n for n in FIGS_USED if n.startswith("pj-")})
if pj:                                     # guided-project labs: their runtime once, then each project's module
    if "window.AIFSProjectFigures" not in figs:
        figs += "\n/* module figures/projects/runtime.js (Part 7) */\n" + (REPO / "site" / "figures" / "projects" / "runtime.js").read_text(); added.append("projects/runtime.js")
    for pid in sorted({re.sub(r"-\d+$", "", n[3:]) for n in pj}):
        f = REPO / "site" / "figures" / "projects" / f"{pid}.js"
        if f.exists() and f"/* module figures/projects/{pid}.js" not in figs:
            figs += f"\n/* module figures/projects/{pid}.js (Part 7) */\n" + f.read_text(); added.append(f"projects/{pid}.js")
    DEFINED = KEYS(figs)
    for n in pj:                           # a project whose figures use a short prefix (pj-rra-* is research-report-agent)
        if n in DEFINED: continue
        for f in sorted((REPO / "site" / "figures" / "projects").glob("*.js")):
            if f"/* module figures/projects/{f.name}" not in figs and re.search(r"['\"]%s['\"]" % re.escape(n), f.read_text()):
                figs += f"\n/* module figures/projects/{f.name} (Part 7) */\n" + f.read_text(); added.append(f"projects/{f.name}"); DEFINED = KEYS(figs); break
if added: F.write_text(figs)
figs = F.read_text()
DEFINED = KEYS(figs); have = lambda n: n in DEFINED
print("figure modules added", added, "| figures still missing", sorted(n for n in FIGS_USED if not have(n)))
