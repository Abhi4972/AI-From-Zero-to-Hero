"""retitle.py: give phases, lessons and cheat sheets this course's own names (data/titles_src.py).

It sets the titles in data/course.json and rewrites every place a lesson page shows one: the page heading,
the "Phase N · ..." crumb, cheat-sheet "Covers ..." lists and related-sheet boxes. It is safe to run again,
and must be run after anything that rewrites lessons or course.json from the source repo (tools/part6/build_p6.py).
It also writes data/titles.json (id -> title, plus the original titles it replaced).

Usage: python3 tools/retitle.py      then: python3 tools/build.py
"""
import re, os, sys, json, html as H

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "data"))
import titles_src as T

P = lambda *a: os.path.join(ROOT, *a)
course = json.load(open(P("data", "course.json"), encoding="utf-8"))
old_store = json.load(open(P("data", "titles.json"), encoding="utf-8")) if os.path.exists(P("data", "titles.json")) else {}
orig = old_store.get("original", {})          # id -> the title it had before this tool first renamed it

new = {}
for p in course:
    for ch in p["chapters"]:
        if ch["id"] in T.PHASES:
            if ch["title"] != T.PHASES[ch["id"]]: orig.setdefault(ch["id"], ch["title"])
            new[ch["id"]] = T.PHASES[ch["id"]]
        for l in ch["lessons"]:
            i = l["id"]
            t = T.LESSONS.get(i) if i.startswith("a") else T.SHEETS.get(re.sub(r"-v\d+$", "", i[3:])) if i.startswith("cs-") else None
            if not t: continue
            if l["title"] != t: orig.setdefault(i, l["title"])
            new[i] = t
for p in course:
    for ch in p["chapters"]:
        if ch["id"] in new: ch["title"] = new[ch["id"]]
        for l in ch["lessons"]:
            if l["id"] in new: l["title"] = new[l["id"]]
json.dump(course, open(P("data", "course.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# every old spelling (raw and HTML-escaped) of a title -> its new one
pairs = []
for i, o in orig.items():
    if i in new and o != new[i]:
        for a, b in ((o, new[i]), (H.escape(o, quote=False), H.escape(new[i], quote=False))):
            pairs.append((i, a, b))
num = {l["id"]: l.get("num", "") for p in course for ch in p["chapters"] for l in ch["lessons"]}
code = {ch["id"]: ch.get("code", "") for p in course for ch in p["chapters"]}

NEEDS_MAP = {o: n for i, o, n in pairs}                     # "Needs: Phase 1, Lessons 01 (Linear Algebra Intuition), ..."
NEEDS_RE = re.compile(r"(?<![\w&])(?:%s)(?![\w])" % "|".join(re.escape(o) for o in sorted(NEEDS_MAP, key=len, reverse=True)))
ANY_RE = re.compile("|".join(re.escape(o) for o in sorted(NEEDS_MAP, key=len, reverse=True)))
changed = 0
for f in sorted(os.listdir(P("lessons"))):
    if not f.endswith(".html"): continue
    path = P("lessons", f); a = open(path, encoding="utf-8").read(); b = a; me = f[:-5]
    here = set(ANY_RE.findall(b))                           # only the old titles this page mentions
    for i, o, n in pairs:
        if o not in here: continue
        if i == me:                                         # this page's own heading (a cheat sheet also has it in its card)
            b = b.replace(f"<h1>{o}</h1>", f"<h1>{n}</h1>").replace(f"<div><h2>{o}</h2>", f"<div><h2>{n}</h2>")
        if i.startswith("ph-"):                             # the course map in lesson 0.0 ("Setup & Tooling · 32 lessons") and crumbs
            b = b.replace(f"</span>{o} · ", f"</span>{n} · ").replace(f"Phase {code[i]} · {o}<", f"Phase {code[i]} · {n}<")
        elif num.get(i):                                    # "14.1 The Agent Loop..." in Covers lists, "14.1 · ..." labels
            b = b.replace(f"{num[i]} {o}", f"{num[i]} {n}").replace(f"{num[i]} · {o}", f"{num[i]} · {n}")
        if i.startswith("cs-"):                             # related cheat-sheet boxes: "Cheat sheet · Agent Harness Engineering"
            b = b.replace(f"Cheat sheet · {o}<", f"Cheat sheet · {n}<")
    b = re.sub(r"<li><strong>Needs</strong>:.*?</li>", lambda m: NEEDS_RE.sub(lambda x: NEEDS_MAP[x.group(0)], m.group(0)), b)
    if b != a: open(path, "w", encoding="utf-8").write(b); changed += 1

json.dump({"course": T.COURSE, "titles": new, "original": orig}, open(P("data", "titles.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({"titled": len(new), "lesson files changed": changed}))
