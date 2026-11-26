"""renumber.py: after changing lesson numbers in data/course.json, update every reference to them.

Compares the numbers in data/course.json with the numbers of the last build (the course data inside index.html).
For each lesson whose number changed it rewrites
  - the "Lesson N" chip in that lesson's header,
  - the text of every link that points to it ("Lesson 14.70", "later · 14.70", "14.70 · Title"),
  - plain-text mentions such as "Lesson 14.70" or "Lessons 14.70 and 14.71" (code blocks are left alone).
Then run tools/build.py, which rewrites the Previous / Next footers and rebuilds index.html.

Usage: python3 tools/renumber.py [site_root]
"""
import re, json, os, sys
from collections import Counter

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
P = lambda *a: os.path.join(ROOT, *a)
new = {l["id"]: l.get("num", "") for p in json.load(open(P("data", "course.json"), encoding="utf-8")) for ch in p["chapters"] for l in ch["lessons"]}
built = json.loads(re.search(r"const COURSE = (\[.*?\]);\n", open(P("index.html"), encoding="utf-8").read(), re.S).group(1))
old = {l["id"]: l.get("num", "") for p in built for ch in p["chapters"] for l in ch["lessons"]}
changed = {i: (old[i], new[i]) for i in new if i in old and old[i] and new[i] and old[i] != new[i]}
if not changed: sys.exit("No lesson number changed since the last build.")
by_old = {o: n for o, n in changed.values()}
assert len(by_old) == len(changed), "two lessons had the same old number"
NUM = r"[A-Z]?\d+\.\d+"
TOKEN = re.compile(r"(?<![\w.])(" + NUM + r")(?!\d|\.\d)")

stats = Counter()
def sub_nums(s, only=None):
    def f(m):
        o = m.group(1)
        if o in by_old and (only is None or o == only): stats["numbers"] += 1; return by_old[o]
        return o
    return TOKEN.sub(f, s)

RAW = re.compile(r"<(script|style|pre|textarea|code)\b.*?</\1>|<[^>]+>", re.S)
def split_html(a):
    out, pos = [], 0
    for m in RAW.finditer(a):
        if m.start() > pos: out.append(a[pos:m.start()])
        out.append(m.group(0)); pos = m.end()
    out.append(a[pos:])
    return out
def rewrite(i, a):
    parts = split_html(a)
    skip = 0; anchors = []
    for k, t in enumerate(parts):
        if t.startswith("<"):
            m = re.match(r"<(/?)([a-zA-Z0-9]+)", t)
            if m:
                tag = m.group(2).lower(); closing = m.group(1) == "/"
                if tag == "a":
                    if closing: anchors and anchors.pop()
                    else:
                        h = re.search(r'href="#([^"]+)"', t); anchors.append(h.group(1) if h else None)
            continue
        if skip > 0 or not t.strip(): continue
        target = next((x for x in reversed(anchors) if x), None)
        if target in changed:                          # the text of a link to a renumbered lesson
            parts[k] = sub_nums(t, only=changed[target][0])
        elif target is None:                          # plain text: "Lesson 14.70", "Lessons 14.70 and 14.71"
            parts[k] = re.sub(r"\b(Lessons? )(" + NUM + r"(?:(?:,| and| or|–|-) ?" + NUM + r")*)",
                              lambda m: m.group(1) + sub_nums(m.group(2)), t)
    a = "".join(parts)
    if i in changed:
        o, n = changed[i]
        a = a.replace(f'<span class="chip chip-num">Lesson {o}</span>', f'<span class="chip chip-num">Lesson {n}</span>')
    return a

edited = 0
for f in sorted(os.listdir(P("lessons"))):
    if not f.endswith(".html"): continue
    i = f[:-5]; a = open(P("lessons", f), encoding="utf-8").read(); b = rewrite(i, a)
    if b != a: open(P("lessons", f), "w", encoding="utf-8").write(b); edited += 1
print(json.dumps({"lessons_renumbered": len(changed), "lesson_files_edited": edited, "numbers_rewritten": stats["numbers"]}))
