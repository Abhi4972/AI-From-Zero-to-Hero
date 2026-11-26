"""Convert one AI Engineering from Scratch lesson (docs/en.md + quiz.json) into the Zero to Agents lesson source format.

Output: a dict with title, minutes, kind, and `src`, a markdown body that uses the course's ::: boxes, ```quiz block and
placeholders the volume builder renders: {{MM:id}} mermaid diagram, {{KX:id}} display math, {{FIG:name}} interactive figure,
{{RUN:n}} the recorded output of the n-th Python block. Inline $math$ becomes {{KI:id}}."""
import re, json, hashlib, pathlib

def h(s):
    return hashlib.md5(s.encode()).hexdigest()[:10]

FENCE = re.compile(r"^```([\w+-]*)[^\n]*\n(.*?)^```[ \t]*$", re.S | re.M)
SKIP_SECTIONS = {"connections"}            # kept, just renamed
RENAME = {"the problem": "The problem", "use it": "Use it: the same idea with real libraries", "ship it": "Ship it",
          "summary": "Summary", "connections": "How this connects", "common mistakes": "Common mistakes",
          "exercises": "Exercises", "further reading": "Further reading"}

def split_h(text, level):
    marker = "#" * level + " "
    parts, cur, title = [], [], None
    in_code = False
    for ln in text.split("\n"):
        if ln.startswith("```"):
            in_code = not in_code
        if not in_code and ln.startswith(marker) and not ln.startswith(marker + "#"):
            if title is not None or any(x.strip() for x in cur):
                parts.append((title, "\n".join(cur).strip("\n")))
            title, cur = ln[len(marker):].strip(), []
        else:
            cur.append(ln)
    parts.append((title, "\n".join(cur).strip("\n")))
    return parts

REPO_URL = "https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/"
XLINKS = {}   # lesson id -> GitHub URL, for links to lessons that may live in another volume

def body_fixer(base_dir, num, store):
    """fix_body for markdown whose relative links are relative to base_dir: fences -> placeholders, maths, lesson links."""
    import os
    blocks = store.setdefault("blocks", []); py_i = [0]

    def rel_link(mm):
        """A relative link to another file of the repo: a lesson becomes #aPPLL (the build turns ids outside this volume
        into GitHub links); any other file links to GitHub."""
        target = mm.group(1)
        path = os.path.normpath(os.path.join(str(base_dir), target.split("#")[0]))
        rm = re.search(r"/(phases/(\d{2})-[^/]+/(\d{2})-[^/]+)(?:/|$)", path)
        if rm and (path.endswith("/docs/en.md") or path.rstrip("/").endswith(rm.group(1))):
            lid = f"a{rm.group(2)}{rm.group(3)}"
            XLINKS[lid] = REPO_URL + rm.group(1) + "/docs/en.md"
            return f"](#{lid})"
        rr = re.search(r"/((?:phases|interviews|docs|site|manuals|projects|cheatsheets|practice|glossary)/.*)$", path)
        return f"]({REPO_URL + rr.group(1)})" if rr else mm.group(0)
    def fix_body(t):
        # fenced blocks first, so inline math inside code is left alone
        def fence(mm):
            lang, code = mm.group(1).lower(), mm.group(2)
            if lang == "mermaid":
                k = h(code); store.setdefault("mermaid", {})[k] = code; return "{{MM:%s}}" % k
            if lang == "math":
                k = h(code); store.setdefault("math", {})[k] = (code.strip(), True); return "{{KX:%s}}" % k
            if lang == "figure":
                return "{{FIG:%s}}" % code.strip().split()[0]
            if lang == "pyshow":                    # Python shown for reading, never run
                return "```python\n" + code + "```"
            if lang in ("python", "py"):
                py_i[0] += 1
                blocks.append(code)
                return "```python\n" + code + "```\n\n{{RUN:%d}}" % (len(blocks) - 1)
            if lang == "":
                return "```text\n" + code + "```"
            return mm.group(0)
        t = FENCE.sub(fence, t)
        # "Lesson 03" inside a phase means lesson 3 of this phase: give it the course number and a link
        pno = int(num.split(".")[0])
        # inline math outside code spans and fences
        pieces = re.split(r"(```.*?```|`[^`\n]+`)", t, flags=re.S)
        for i in range(0, len(pieces), 2):
            def im(mm):
                code = mm.group(1)
                k = h(code); store.setdefault("math", {})[k] = (code, False); return "{{KI:%s}}" % k
            pieces[i] = re.sub(r"\$\$(.+?)\$\$", lambda mm: "{{KX:%s}}" % (store.setdefault("math", {}).__setitem__(h(mm.group(1)), (mm.group(1).strip(), True)) or h(mm.group(1))), pieces[i], flags=re.S)
            pieces[i] = re.sub(r"\]\(((?:\.\./)+[^)\s]+)\)", rel_link, pieces[i])
            # "Phase 7 · Lesson 16" names a lesson of another phase: link it there, not to this phase's lesson 16
            pieces[i] = re.sub(r"\bPhase (\d+) · Lesson (\d{2})\b(?![.\d])", lambda mm: f"[Lesson {int(mm.group(1))}.{int(mm.group(2))}](#a{int(mm.group(1)):02d}{int(mm.group(2)):02d})", pieces[i])
            pieces[i] = re.sub(r"\bLesson (\d{2})\b(?![.\d])", lambda mm: f"[Lesson {pno}.{int(mm.group(1))}](#a{pno:02d}{int(mm.group(1)):02d})", pieces[i])
            pieces[i] = re.sub(r"(?<![\\$\w])\$(?!\s)([^$\n]{1,200}?)(?<!\s)\$(?![\w$])", im, pieces[i])
        return "".join(pieces)

    return fix_body

def convert(lesson_dir, num, store):
    d = pathlib.Path(lesson_dir)
    raw = (d / "docs" / "en.md").read_text()
    m = re.match(r"#\s+(.+)\n", raw)
    title = m.group(1).strip() if m else d.name
    mq = re.search(r"(?:^>.*\n?)+", raw[:4000], re.M)      # the first block quote, whole (it can be long)
    motto = " ".join(x[1:].strip() for x in mq.group(0).splitlines()) if mq else ""
    meta = dict(re.findall(r"^\*\*(Type|Languages|Prerequisites|Time):\*\*\s*(.+)$", raw, re.M))
    minutes = int((re.search(r"(\d+)", meta.get("Time", "45")) or [0, 45])[1])
    body = raw[m.end():] if m else raw
    secs = split_h(body, 2)
    goals, terms, reading, out, notes = [], "", "", [], []
    fix_body = body_fixer(d / "docs", num, store)

    idea_n = 0
    for st, sb in secs:
        key = (st or "").strip().lower()
        if st is None:
            continue
        if key == "learning objectives":
            goals = [re.sub(r"^[-*]\s+", "", x).strip() for x in sb.splitlines() if re.match(r"^[-*]\s+", x)]
            continue
        if key == "key terms":
            terms = sb; continue
        if key == "further reading":
            reading = sb; continue
        if key == "the concept":
            subs = split_h(sb, 3)
            lead = subs[0][1] if subs and subs[0][0] is None else ""
            rest = [s for s in subs if s[0] is not None]
            if lead.strip():
                if rest:
                    out.append(("The idea", fix_body(lead)))
                else:
                    out.append(("The idea", fix_body(lead)))
            for t2, b2 in rest:
                idea_n += 1
                out.append((f"Idea {idea_n} · {t2}", fix_body(b2)))
            continue
        if key == "build it":
            subs = split_h(sb, 3)
            lead = subs[0][1] if subs and subs[0][0] is None else ""
            rest = [s for s in subs if s[0] is not None]
            first = True
            for t2, b2 in rest:
                t2 = re.sub(r"^Step\s+(\d+)\s*[:.\-–]\s*", r"Step \1 · ", t2)
                if not t2.startswith("Step"):
                    t2 = "Build · " + t2
                out.append((t2, fix_body(((lead + "\n\n") if first and lead.strip() else "") + b2)))
                first = False
            if not rest and lead.strip():
                out.append(("Build it", fix_body(lead)))
            continue
        if key == "ship it":
            extra = []
            for of in sorted((d / "outputs").glob("*.md")) if (d / "outputs").exists() else []:
                txt = of.read_text()
                if len(txt) < 9000 and "~~~~" not in txt:
                    extra.append(f"**`outputs/{of.name}`**\n\n~~~~markdown\n{txt.rstrip()}\n~~~~")
            out.append((RENAME.get(key, st), fix_body(sb) + ("\n\n" + "\n\n".join(extra) if extra else "")))
            continue
        out.append((RENAME.get(key, st), fix_body(sb)))

    # assemble the course-format source
    src = []
    if goals:
        src.append(":::goals What you will be able to do\n" + "\n".join("- " + g for g in goals) + "\n:::")
    pre = meta.get("Prerequisites", "").strip()
    src.append(":::prereq Before you start\n" + (f"- **Needs**: {pre}\n" if pre and pre.lower() not in ("none", "-") else "- **Needs**: nothing beyond the earlier lessons of this phase.\n")
               + f"- **Type**: {meta.get('Type', 'Learn').strip()}. **Time**: about {minutes} minutes.\n"
               + (f"- **Code in**: {meta.get('Languages').strip()}. The Python runs on this page; the other languages are shown for comparison.\n" if meta.get("Languages") and "," in meta.get("Languages") else "")
               + ":::")
    if motto:
        src.append(":::plain The idea in one line\n" + fix_body(motto) + "\n:::")
    if terms.strip():
        rows = [l for l in terms.splitlines() if l.strip().startswith("|")]
        if len(rows) >= 3:
            src.append(":::terms Terms you'll hear\n" + "\n".join(rows) + "\n:::")
        else:
            src.append(":::terms Terms you'll hear\n" + fix_body(terms) + "\n:::")
    for t, b in out:
        src.append(f"## {t}\n\n{b}")
    if reading.strip():
        reading = re.sub(r"(?<![(<\"\w])(https?://[^\s)<>]+?)([.,;]?)(?=\s|$|\))", r"<\1>\2", reading)
        src.append(":::checked Sources and further reading\n" + fix_body(reading) + "\n:::")
    qf = d / "quiz.json"
    if qf.exists():
        try:
            qs = json.loads(qf.read_text())
            qtxt = []
            for q in qs:
                opts = "\n".join(f"- [{'x' if i == q['correct'] else ' '}] {o}" for i, o in enumerate(q["options"]))
                qtxt.append(f"Q: {q['question']}\n{opts}\n> {q.get('explanation', '')}")
            if qtxt:
                src.append("```quiz\n" + "\n\n".join(qtxt) + "\n```")
        except Exception:
            pass
    return {"title": title, "minutes": max(10, min(minutes, 180)), "type": meta.get("Type", "Learn").strip(),
            "src": "\n\n".join(src), "num": num, "slug": d.name}
