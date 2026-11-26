"""build.py: build the site from its own sources. Run it after editing any lesson.

Sources (edit these):
  lessons/<id>.html   one lesson each (the inside of its <article>)
  data/course.json    parts, phases and the lesson list (order, numbers, titles, minutes)
  data/zxt.json       one-line summaries the lesson player shows per section
  engine/             the app: page shell, styles and scripts

Generated (do not edit by hand):
  index.html          the app with every lesson's summary stub and the course data
  search/p1..p5.json  lesson text for search, one file per part
  meta/th-<phase>.json  thumbnails for the phase pages
  the Previous / Next footer of each lesson file (rewritten from data/course.json)

Usage: python3 tools/build.py [site_root]      (default: the folder above tools/)
"""
import re, json, os, sys, html as H
from collections import defaultdict, Counter

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
def P(*a): return os.path.join(ROOT, *a)
def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s): open(p, "w", encoding="utf-8").write(s)

COURSE = json.load(open(P("data", "course.json"), encoding="utf-8"))
ZXT = json.load(open(P("data", "zxt.json"), encoding="utf-8"))
flat = [l for p in COURSE for ch in p["chapters"] for l in ch["lessons"]]
ids = [l["id"] for l in flat]
PHASES = {ch["id"]: ch for p in COURSE for ch in p["chapters"]}
phase_of = {l["id"]: ch["id"] for p in COURSE for ch in p["chapters"] for l in ch["lessons"]}
files = {f[:-5] for f in os.listdir(P("lessons")) if f.endswith(".html")}
problems = []
if len(set(ids)) != len(ids): problems.append("duplicate lesson ids in data/course.json: " + ", ".join(k for k, n in Counter(ids).items() if n > 1))
if set(ids) - files: problems.append("listed but no lesson file: " + ", ".join(sorted(set(ids) - files)))
if files - set(ids): problems.append("lesson file not listed in data/course.json: " + ", ".join(sorted(files - set(ids))))
if problems: sys.exit("\n".join(problems))

ART = {i: rd(P("lessons", i + ".html")) for i in ids}

# ---------------------------------------------------------------- footers: Previous / Next across the whole course
def label(l):
    if l["id"].startswith("cs-"): return "Cheat sheet · " + l["title"]
    return f'{l["num"]} · {l["title"]}' if l.get("num") else l["title"]
def pn_row(k):
    parts = []
    if k > 0:
        p = flat[k - 1]; parts.append(f'<a class="pn prev" href="#{p["id"]}"><span class="pn-dir">Previous</span><span class="pn-t">{H.escape(label(p), quote=False)}</span></a>')
    if k + 1 < len(flat):
        n = flat[k + 1]; parts.append(f'<a class="pn next" href="#{n["id"]}"><span class="pn-dir">Next</span><span class="pn-t">{H.escape(label(n), quote=False)}</span></a>')
    return '<div class="pn-row">' + "".join(parts) + "</div>"
footers = 0
for k, l in enumerate(flat):
    a = ART[l["id"]]
    b = re.sub(r'<div class="pn-row">.*?</div>(?=</footer>)', lambda m: pn_row(k), a, count=1, flags=re.S)
    if b != a: ART[l["id"]] = b; wr(P("lessons", l["id"] + ".html"), b); footers += 1

# ---------------------------------------------------------------- checks: every in-site link goes somewhere
special = {"home", "curriculum", "interview", "playground", "review"}
dead = Counter()
for i, a in ART.items():
    own = set(re.findall(r'\sid="([^"]+)"', a))
    for t in re.findall(r'href="#([^"]*)"', a):
        if t and t not in special and t not in PHASES and t not in ART and t not in own and not t.startswith("term-"):
            dead[f"{i} -> #{t}"] += 1
claude_links = sum(a.count("claude.ai/artifact") for a in ART.values())

# ---------------------------------------------------------------- stubs: what the start-up code reads from each lesson
def stub(i, a):
    head = re.search(r'<header class="m-head">.*?</header>', a, re.S)
    meta = [re.sub(r"</summary>.*</details>$", "</summary></details>", d, flags=re.S)       # question only; answer loads with the lesson
            for d in re.findall(r'<details class="qa[^"]*" id="[^"]+".*?</details>', a, re.S)]
    meta += re.findall(r'<section class="quiz".*?</section>', a, re.S)
    meta += re.findall(r'<figure class="viz[^"]*"[^>]*>.*?</figure>\s*<script>.*?</script>', a, re.S)
    heads = re.findall(r"<(h[23])\b[^>]*>(.*?)</\1>", a, re.S)
    meta.append('<div class="stub-heads">' + "".join(f"<{t}>{x}</{t}>" for t, x in heads) + "</div>")
    return (f'<article class="module" id="{i}" data-id="{i}" hidden data-stub="1">' + (head.group(0) if head else "")
            + '<div class="stub-meta">' + "".join(meta) + "</div></article>")

# ---------------------------------------------------------------- thumbnails (what the dashboard's thumb() would pick)
def svg_end(t, start):
    depth = 0
    for m in re.finditer(r"<svg\b|</svg>", t[start:]):
        depth += 1 if m.group(0) == "<svg" else -1
        if depth == 0: return start + m.end()
    return len(t)
def own_thumb(a):
    svgs = []
    for f in re.finditer(r'<figure class="diagram[^"]*"[^>]*>', a):
        end = a.find("</figure>", f.end())
        for m in re.finditer(r"<svg\b[^>]*>", a[f.end():end]):
            c = re.search(r'class="([^"]*)"', m.group(0))
            if c and "dg" in c.group(1).split():
                st = f.end() + m.start(); svgs.append(a[st:svg_end(a, st)]); break
    def wide(svg):
        vb = re.search(r'viewBox="([^"]+)"', svg[:800])
        try: x = [float(t) for t in vb.group(1).replace(",", " ").split()]; return len(x) == 4 and x[2] >= x[3] * 1.1
        except Exception: return False
    if svgs: return '<figure class="diagram">' + next((v for v in svgs if wide(v)), svgs[0]) + "</figure>"
    im = re.search(r'<figure class="xfig[^"]*"[^>]*>.*?(<img[^>]*>)', a, re.S)
    if im: return '<figure class="xfig">' + im.group(1) + "</figure>"
    im = re.search(r'(<img[^>]*src="repo-assets/[^"]*"[^>]*>)', a) or re.search(r'(<img[^>]*class="run-fig"[^>]*>)', a)
    if im: return im.group(1)
    for m in re.finditer(r"<svg\b[^>]*>", a):
        c = re.search(r'class="([^"]*)"', m.group(0))
        if c and "cs-arch" in c.group(1).split(): return a[m.start():svg_end(a, m.start())]
    return ""
TH = {i: own_thumb(a) for i, a in ART.items()}
for i, a in ART.items():                      # a cheat sheet without a figure borrows one from the first lesson it covers
    if not TH[i] and i.startswith("cs-"):
        for t in dict.fromkeys(re.findall(r'href="#(a\d+)"', a)):
            if TH.get(t): TH[i] = TH[t]; break
def crumb_phase(i, a):
    nav = re.search(r'<nav class="crumbs"[^>]*>.*?</nav>', a, re.S)
    hrefs = [x for x in re.findall(r'<a href="#([^"]+)"', nav.group(0)) if x != "home"] if nav else []
    return hrefs[0] if hrefs else phase_of[i]
byph = defaultdict(dict)
for i, t in TH.items(): byph[crumb_phase(i, ART[i])][i] = t
os.makedirs(P("meta"), exist_ok=True)
for f in os.listdir(P("meta")): os.remove(P("meta", f))
for ph, d in byph.items():
    json.dump(d, open(P("meta", f"th-{ph}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------- search: lesson text (code, diagrams and rendered maths left out)
def text_of(a):
    for pat in (r"<(script|style)\b.*?</\1>", r"<svg\b.*?</svg>", r"<pre\b.*?</pre>", r'<span class="katex">.*?</span></span></span>'):
        a = re.sub(pat, " ", a, flags=re.S)
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", a))).strip()
os.makedirs(P("search"), exist_ok=True)
for f in os.listdir(P("search")): os.remove(P("search", f))
for k, part in enumerate(COURSE):
    json.dump({l["id"]: text_of(ART[l["id"]]) for ch in part["chapters"] for l in ch["lessons"]},
              open(P("search", f"p{k + 1}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------- the page
E = lambda n: rd(P("engine", n))
N = str(len(flat))
course_js = E("course.js").replace("/*@@COURSE@@*/", json.dumps(COURSE, ensure_ascii=False), 1)
player_js = E("player.js").replace("/*@@ZXT@@*/", json.dumps(ZXT, ensure_ascii=False), 1)
assert "/*@@" not in course_js + player_js
page = (E("head.html").replace("@@N@@", N) + E("styles.html") + "<script>" + E("site.js") + "</script>\n</head><body>\n"
        + E("shell.html").replace("@@N@@", N) + "\n".join(stub(i, ART[i]) for i in ids) + E("tail.html")
        + "<script>" + E("zv.js") + "</script>\n"
        + '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>\n'
        + "<script>" + player_js + "</script>\n<script>" + course_js + "</script>\n<script>" + E("figs.js") + "</script>\n<script>" + E("xv.js") + "</script>\n"
        + '<script id="dj-js">' + E("dj.js") + '</script>\n<script type="text/plain" id="px-harness">' + E("px-harness.py") + '</script>\n<script id="px-js">' + E("px.js") + "</script>\n"
        + "<script>" + E("hljs.js") + "</script>\n<script>" + E("hlrun.js") + "</script>\n</body></html>\n")
assert "@@N@@" not in page
wr(P("index.html"), page)

missing = sorted({p for a in ART.values() for p in re.findall(r'(?:src|href)="((?:img|figs|repo-assets|src)/[^"#?]+)"', a) if not os.path.exists(P(p))})
report = {"lessons": len(flat), "phases": len(PHASES), "parts": len(COURSE), "footers_rewritten": footers,
          "dead_links": sum(dead.values()), "claude_links": claude_links, "missing_assets": missing,
          "index_kb": len(page.encode()) // 1024, "thumbnails": sum(1 for t in TH.values() if t)}
print(json.dumps(report, indent=1))
if dead: print("dead links:", list(dead)[:20])
if dead or claude_links or missing: sys.exit(1)
