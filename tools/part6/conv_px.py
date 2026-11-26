"""Convert AI Engineering from Scratch's guided projects (projects/<id>) and interview scenarios
(interviews/scenarios/<id>) into the course's lesson source format (the same markdown + ::: boxes conv.py writes).

convert_project(dir, num, store, demo) and convert_scenario(dir, num, store) return the dict conv.convert returns,
plus "key" (the repo path cheat sheets and links use)."""
import re, json, pathlib, html
import conv

LANG = {"python": "python", "typescript": "typescript", "go": "go", "rust": "rust", "javascript": "javascript"}
EXT = {".py": "python", ".ts": "typescript", ".go": "go", ".rs": "rust", ".js": "javascript", ".mjs": "javascript", ".toml": "toml",
       ".json": "json", ".md": "markdown", ".sh": "bash"}
EXERCISE_HEADS = {"investigate next", "extend it", "inspect and extend"}
LANG_NAME = {"python": "Python", "typescript": "TypeScript", "go": "Go", "rust": "Rust", "javascript": "JavaScript"}
SKIP_HEADS = {"learning objectives", "learning goals"}
SOURCE_HEADS = {"references", "primary reference", "further reading", "sources"}
META_LINE = re.compile(r"^\*\*(Type|Languages|Stage|Prerequisites|Time):\*\*.*$\n?", re.M)


def _strip_workspace_talk(t):
    """Drop the source repo's grading-harness instructions: the learner reads, runs and rebuilds here instead."""
    t = re.sub(r"^```bash\n(?:(?!```).)*?(?:project_test|learning-artifacts|--init)(?:(?!```).)*?```[ \t]*\n?", "", t, flags=re.S | re.M)
    paras = re.split(r"\n\s*\n", t)
    keep = []
    for p in paras:
        low = p.lower()
        if p.lstrip().startswith("```") or p.lstrip().startswith("{{"):
            keep.append(p); continue
        if any(k in low for k in ("project_test", "learner workspace", "learning-artifacts", "initialization copies", "fresh stub fails",
                                   "reference run does not", "grade cumulatively", "from the repository root", "cli helpers are provided",
                                   "first command checks the reference", "second command checks", "change the figure controls",
                                   "initialize once", "fresh first stage", "grader runs the real", "grading executes your",
                                   "change the controls, predict", "sample files live in your workspace", "this stage contributes to")):
            continue
        keep.append(p)
    return "\n\n".join(keep).strip()


def _split_sections(text):
    """[(None, lead), (h2 title, body), ...] at level-2 headings outside code fences."""
    return conv.split_h(text, 2)


def _code_block(path, rel, lang=None):
    code = path.read_text(errors="replace").rstrip("\n")
    lang = lang or EXT.get(path.suffix, "text")
    fence = "~~~~" if "```" in code else "```"
    return f"{fence}{lang}\n{code}\n{fence}", len(code.splitlines())


def convert_project(pdir, num, store, demo=None):
    d = pathlib.Path(pdir)
    j = json.loads((d / "project.json").read_text())
    pid = j["id"]
    readme = (d / "README.md").read_text()
    fix_readme = conv.body_fixer(d, num, store)
    sources, exercises, scopes = [], [], []

    # README: the lead paragraphs (the problem) and the integration boundary
    secs = _split_sections(re.sub(r"^#\s+.+\n", "", readme, count=1))
    lead = next((b for t, b in secs if t is None), "")
    boundary = next((b for t, b in secs if t and t.lower().startswith("integration boundary")), "")
    refs = next((b for t, b in secs if t and t.lower() in SOURCE_HEADS | {"primary references"}), "")
    if refs.strip(): sources.append(refs.strip())

    src = []
    skills = j.get("skills") or [s["title"] for s in j.get("stages", [])]
    src.append(":::goals What you will be able to do\n" + "\n".join("- " + s for s in skills) + "\n:::")
    needs = ", ".join(f"[{p['title']}](../../{p['path']}/docs/en.md)" if isinstance(p, dict) else str(p).rstrip(".")
                      for p in j.get("prerequisites", []))
    langs = j.get("languages", [])
    lw = j.get("languageWhy") or {}
    why = ("*Why:* " + " ".join(v.rstrip(".") + "." for v in lw.values())) if len(lw) == 1 else " ".join(f"*Why {k}:* {v.rstrip('.')}." for k, v in lw.items())
    pre = (f"- **Needs**: {needs or 'nothing beyond the earlier phases.'}\n"
           f"- **Type**: Project, level {j.get('level')} ({j.get('levelName', '')}). **Time**: about {j.get('hours', 8)} hours over {len(j.get("stages", []))} steps.\n"
           f"- **Code in**: {', '.join(langs)}. {why}\n")
    src.append(":::prereq Before you start\n" + fix_readme(pre).strip() + "\n:::")
    if j.get("tagline"):
        src.append(":::plain The idea in one line\n" + fix_readme(j["tagline"]) + "\n:::")

    prob = [fix_readme(lead.strip())] if lead.strip() else []
    if j.get("youWillBuild") and j["youWillBuild"].strip()[:40].lower() not in lead.lower():
        prob.append(f"**What you will build:** {fix_readme(j['youWillBuild'])}")
    uf = [u for u in (j.get("usefulFor") or []) if u != j.get("youWillBuild")]
    if uf: prob.append("**Where it stops:** " + " ".join(fix_readme(u) for u in uf))
    if j.get("figures") and j.get("overviewFigure"): prob.append("{{FIG:%s}}" % j["overviewFigure"])
    src.append("## The problem\n\n" + "\n\n".join(prob))

    # stages
    stage_dirs = sorted(x for x in (d / "stages").iterdir() if x.is_dir()) if (d / "stages").exists() else []
    meta_by_id = {s["id"]: s for s in j.get("stages", [])}
    used_figs = {j.get("overviewFigure")}
    seen_paras = set()
    def dedupe(t):                         # a paragraph repeated word for word in an earlier step is said once
        out = []
        for p in re.split(r"\n\s*\n", t):
            key = re.sub(r"\s+", " ", p.strip()).lower()
            if len(key) > 60 and not p.lstrip().startswith(("```", "{{")) and key in seen_paras: continue
            seen_paras.add(key); out.append(p)
        return "\n\n".join(out)
    for k, sd in enumerate(stage_dirs, 1):
        sm = meta_by_id.get(sd.name, {})
        raw = (sd / "docs" / "en.md").read_text() if (sd / "docs" / "en.md").exists() else ""
        m = re.match(r"#\s+(.+)\n", raw); title = sm.get("title") or (m.group(1).strip() if m else sd.name)
        body = raw[m.end():] if m else raw
        motto = re.match(r"\s*((?:^>.*\n?)+)", body, re.M)
        if motto: body = body[motto.end():]
        body = META_LINE.sub("", body)
        body = re.sub(r"^\*\*Language:\*\*[^\n]*\n?", "", body, flags=re.M)
        if motto and (motto.group(1).lstrip("> ").strip().rstrip(".") in body
                      or motto.group(1).lstrip("> ").strip().rstrip(".") == (j.get("tagline") or "").strip().rstrip(".")): motto = None
        body = re.sub(r"^\*\*Stage \d+ of \d+\.\*\*[^\n]*\n?", "", body, flags=re.M)
        body = re.sub(r"^Stage \d+ of \d+\.\s*", "", body, flags=re.M)
        body = re.sub(r"Read the \[project prerequisites\]\([^)]*\) before starting; this stage builds on the preceding contracts\.\s*", "", body)
        fix0 = conv.body_fixer(sd / "docs", num, store)
        def fix(t):                        # links to another stage of this project become "Step N"
            t = re.sub(r"\[([^\]]+)\]\(\.\./\.\./(\d\d)-[^)]*\)", lambda mm: f"Step {int(mm.group(2))}" if re.match(r"(?i)stage \d+$", mm.group(1)) else f"{mm.group(1)} (Step {int(mm.group(2))})", t)
            return fix0(t)
        parts = []
        lead_t = sm.get("summary", "")
        hrs = sm.get("hours"); lang = sm.get("language", langs[0] if langs else "")
        parts.append(f"*Step {k} of {len(stage_dirs)} · about {hrs or 2} hours · {LANG_NAME.get(str(lang).lower(), str(lang)) if lang else ''}*".replace(" · *", "*"))
        if motto: parts.append("> " + " ".join(x.lstrip("> ").strip() for x in motto.group(1).splitlines()))
        elif lead_t and lead_t.strip().rstrip(".") not in body: parts.append(lead_t.strip().rstrip(".") + ".")
        for t, b in _split_sections(body):
            b = dedupe(_strip_workspace_talk(b))
            b = re.sub(r"\[[^\]]+ standard library\]\([^)]*\)(?:,? and \[[^\]]+\]\([^)]*\))*\.\s*", "", b)
            b = re.sub(r"\s*All fixtures and implementations are original\.", "", b)
            if t and t.strip().lower() in EXERCISE_HEADS:
                q, _, scope = b.strip().partition("Scope:")
                if scope.strip() and scope.strip() not in scopes: scopes.append(scope.strip())
                if q.strip(): exercises.append((k, fix(q.strip())))
                continue
            if t and t.strip().lower() in SKIP_HEADS: continue
            if t and t.strip().lower() in SOURCE_HEADS:
                if b.strip(): sources.append(fix(b.strip()))
                continue
            b = re.sub(r"^Primary reference: (\[.*?\]\(.*?\))\.?\s*$", lambda mm: (sources.append(mm.group(1)) or ""), b, flags=re.M)
            if not b.strip(): continue
            b = fix(b)
            used_figs.update(re.findall(r"\{\{FIG:([\w-]+)\}\}", b))
            if t:                              # a sub-heading becomes a bold lead-in, so each step stays one card
                lead_in = f"**{t.strip().rstrip('.')}.**"
                b = b.strip()
                b = (lead_in + " " + b) if not re.match(r"(```|~~~|\{\{|[-*>|#]|\d+\.)", b) else (lead_in + "\n\n" + b)
            parts.append(b.strip())
        tests = sorted((sd / "tests").glob("*")) if (sd / "tests").exists() else []
        for tf in tests:
            if not tf.is_file() or tf.suffix not in EXT: continue
            code, n = _code_block(tf, tf.name)
            parts.append(f"??? tests | The checks this stage must pass: `{tf.name}` ({n} lines)\n{code}\n???")
        src.append(f"## Step {k} · {title}\n\n" + "\n\n".join(parts))

    if j.get("overviewFigure") and any("{{FIG:%s}}" % j["overviewFigure"] in x for x in src if x.startswith("## Step")):
        src = [x.replace("\n\n{{FIG:%s}}" % j["overviewFigure"], "") if x.startswith("## The problem") else x for x in src]
    # the finished project: run it, then read it
    dm = j.get("demo") or {}
    cmd = " ".join(dm.get("command", []))
    run = [f"The finished reference runs with one command, from its `{dm.get('cwd', 'solution')}/` folder:\n\n```bash\n{cmd}\n```"]
    if demo and demo.get("code") == 0 and demo.get("out", "").strip():
        out = re.sub(r"/tmp/tmp\w+", "<tmp>", demo["out"])
        out = re.sub(r"(/tmp/[\w-]+?-)[A-Za-z0-9]{6}\b", r"\1XXXXXX", out).rstrip("\n").splitlines()
        if len(out) > 60: out = out[:38] + ["…", f"({len(out) - 56} lines left out here)", "…"] + out[-18:]
        fence = "~~~~" if any(l.startswith("```") for l in out) else "```"
        if demo.get("recorded"):
            run.append("This output was recorded by the source project. The shipped demo does not run as it stands here (it expects a fixture file the repository does not include), so the recorded run is shown instead.")
        run.append(":::run What you should see\n" + fence + "text\n" + "\n".join(l[:180] for l in out) + "\n" + fence + "\n:::")
    src.append("## Run the finished project\n\n" + "\n\n".join(run))

    files = []
    sol = d / "solution"
    for f in sorted(sol.rglob("*")) if sol.exists() else []:
        if not f.is_file() or f.suffix not in EXT or f.suffix in (".md",) or "node_modules" in f.parts or f.name.endswith(".lock"): continue
        if f.suffix == ".json" and f.stat().st_size > 4000: continue
        rel = f.relative_to(d)
        code, n = _code_block(f, rel)
        files.append(f"??? code | `{rel}` ({n} lines)\n{code}\n???")
    if files:
        src.append("## Read the finished code\n\nThe complete reference, file by file. Open a file to read it; the stages above say which part each function belongs to.\n\n"
                   + "\n\n".join(files))
    stops = [fix_readme(_strip_workspace_talk(boundary))] if boundary.strip() else []
    stops += [conv.body_fixer(d, num, store)(x) for x in scopes]
    if stops:
        src.append("## Where the project stops\n\n" + "\n\n".join(x for x in stops if x.strip()))
    src.append("## Build it on your machine\n\n"
               "Each step above is meant to be built, not only read. The source repository ships a starter and the checks for every step, "
               "and its test runner grades your own folder step by step:\n\n"
               f"```bash\ngit clone https://github.com/rohitg00/ai-engineering-from-scratch\ncd ai-engineering-from-scratch\n"
               f"python3 scripts/project_test.py {pid} --init my-{pid}\n"
               f"python3 scripts/project_test.py {pid} --stage 1 --path my-{pid}\n```\n\n"
               "Write the step, run its checks, then move to the next step. The checks for each step are also shown above, under that step, so you can see what is expected before you start.")
    src.append("## Exercises\n\n" + ("\n".join(f"{n}. {re.sub(chr(10)+'+', ' ', q)} *(step {k})*" for n, (k, q) in enumerate(exercises, 1))
                                     if exercises else "Questions to test what you built. Try each one before you open the solutions."))
    if sources:
        rd = "\n".join(s if s.lstrip().startswith("-") else "- " + s for s in sources)
        rd = re.sub(r"(?<![(<\"\w])(https?://[^\s)<>]+?)([.,;]?)(?=\s|$|\))", r"<\1>\2", rd)
        src.append(":::checked Sources and further reading\n" + rd + "\n:::")
    return {"title": j["title"], "minutes": max(60, int(j.get("hours", 8)) * 60), "type": "Project", "src": "\n\n".join(src),
            "num": num, "slug": pid, "key": f"projects/{pid}", "figs": sorted(x for x in used_figs if x), "level": j.get("level"),
            "levelName": j.get("levelName", ""), "languages": langs}


def _front(raw):
    m = re.match(r"---\n(.*?)\n---\n", raw, re.S)
    meta, body = {}, raw
    if m:
        body = raw[m.end():]
        cur = None
        for line in m.group(1).splitlines():
            if re.match(r"^\s+\S", line) and cur:
                k2, _, v2 = line.strip().partition(":")
                if line.strip().startswith("- "): meta.setdefault(cur, []); meta[cur] = (meta[cur] if isinstance(meta[cur], list) else []) + [line.strip()[2:]]
                else: meta.setdefault(cur, {}); meta[cur] = meta[cur] if isinstance(meta[cur], dict) else {}; meta[cur][k2.strip()] = v2.strip()
                continue
            k, _, v = line.partition(":"); cur = k.strip(); v = v.strip()
            if v.startswith("[") and v.endswith("]"): v = [x.strip() for x in v[1:-1].split(",") if x.strip()]
            meta[cur] = v
    return meta, body


LEVELS = {"1": "Screen", "2": "Working", "3": "Senior", "4": "Staff"}


def convert_scenario(sdir, num, store):
    d = pathlib.Path(sdir)
    meta, body = _front((d / "README.md").read_text())
    fix = conv.body_fixer(d, num, store)
    secs = {(t or "").strip().lower(): b for t, b in _split_sections(body)}
    sysm = meta.get("system") if isinstance(meta.get("system"), dict) else {}
    src = []
    rounds = ", ".join(meta.get("rounds") or [])
    roles = ", ".join(re.sub(r"\bai\b", "AI", r.replace("-", " ")) for r in (meta.get("roles") or []))
    pre = (f"- **Type**: Interview case file, {meta.get('kind', 'incident')}. Level {meta.get('level')} ({LEVELS.get(str(meta.get('level')), '')}). "
           f"**Time**: about {meta.get('minutes', 20)} minutes.\n"
           + (f"- **Interview rounds**: {rounds}. **Roles**: {roles}.\n" if rounds else "")
           + "".join(f"- **{k.title()}**: {v}\n" for k, v in sysm.items()))
    lessons = meta.get("lessons") or []
    if lessons:
        def _ln(p):
            m = re.search(r"phases/(\d\d)-[^/]+/(\d\d)-", p)
            return f"[Lesson {int(m.group(1))}.{int(m.group(2))}](../../../{p}/docs/en.md)" if m else p
        pre = f"- **Needs**: " + ", ".join(_ln(p) for p in lessons) + "\n" + pre
    src.append(":::prereq Before you start\n" + fix(pre).strip() + "\n:::")
    src.append("## The situation\n\n" + fix(secs.get("situation", "").strip()))
    ev = []
    for label, path in re.findall(r"^- \[(.+?)\]\((evidence/[^)]+)\)", secs.get("evidence", ""), re.M):
        f = d / path
        if not f.exists(): continue
        txt = f.read_text(errors="replace").rstrip("\n")
        fence = "~~~~" if "```" in txt else "```"
        ev.append(f"**{label[0].upper() + label[1:]}**\n\n{fence}text\n{txt}\n{fence}")
    src.append("## The evidence\n\nRead one listing at a time, and write down what each one tells you before you open the next.\n\n" + "\n\n".join(ev))
    if secs.get("questions"): src.append("## Questions to answer first\n\n" + fix(secs["questions"].strip()))
    if secs.get("walkthrough"):
        src.append("## Walkthrough\n\n??? sol | Open the walkthrough once you have your own answers\n" + fix(secs["walkthrough"].strip()) + "\n???")
    for key, head in (("resolution", "What actually happened"), ("wrong turns", "Wrong turns"), ("generalize", "The lesson to carry")):
        if secs.get(key): src.append(f"## {head}\n\n" + fix(secs[key].strip()))
    if secs.get("taught in"): src.append(":::connect Where this is taught\n" + fix(secs["taught in"].strip()) + "\n:::")
    return {"title": meta.get("title", d.name), "minutes": int(meta.get("minutes", 20) or 20), "type": "Case file", "src": "\n\n".join(src),
            "num": num, "slug": d.name, "key": f"interviews/scenarios/{d.name}", "level": int(meta.get("level", 2) or 2), "figs": []}
