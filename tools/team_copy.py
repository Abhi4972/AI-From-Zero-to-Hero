"""team_copy.py: make the team edition of the course, a copy with no interview material.

  python3 tools/team_copy.py /path/to/empty-or-new-folder

It copies the site (not .git, not the source-build pipeline in tools/part6, not src/), then in the copy:
removes Phase 21 (interview case files) and renumbers the phases after it, removes every lesson's
"Interview questions" section and the Interview prep page, mock-interview links and interview-style
level names, rewrites the home page, lesson 0.0 and README to match, and rebuilds the site.
"""
import os, re, sys, json, glob, shutil, subprocess

SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DST = os.path.abspath(sys.argv[1])
if os.path.exists(DST): shutil.rmtree(DST)
shutil.copytree(SRC, DST, ignore=shutil.ignore_patterns(".git", "__pycache__", "part6", "src", "team_copy.py", "renumber.py", "migrate.py"))
P = lambda *a: os.path.join(DST, *a)
def edit(path, pairs, strict=True):
    s = open(path, encoding="utf-8").read()
    for a, b in pairs:
        if a not in s:
            if strict: raise SystemExit(f"{path}: not found: {a[:80]}")
            continue
        s = s.replace(a, b)
    open(path, "w", encoding="utf-8").write(s)

# 1. course: Phase 21 goes, later phases move up by one
course = json.load(open(P("data", "course.json"), encoding="utf-8"))
gone, newnum, oldnum, shiftp = set(), {}, {}, {}
for part in course:
    for ch in part["chapters"]:
        if ch["id"] == "ph-21": gone |= {l["id"] for l in ch["lessons"]}
    part["chapters"] = [ch for ch in part["chapters"] if ch["id"] != "ph-21"]
    if part["title"] == "Projects and Case Files": part["title"] = "Hands-On Projects"
    for ch in part["chapters"]:
        c = int(ch["code"]) if str(ch["code"]).isdigit() else -1
        if c > 21:
            shiftp[str(c)] = str(c - 1); ch["code"] = str(c - 1)
            for l in ch["lessons"]:
                if re.match(r"^\d+\.\d+$", l["num"]):
                    oldnum[l["id"]] = l["num"]; l["num"] = f"{c - 1}.{l['num'].split('.')[1]}"; newnum[l["id"]] = l["num"]
json.dump(course, open(P("data", "course.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for i in gone:
    for f in (P("lessons", i + ".html"), P("data", "diagrams", i + ".mmd")):
        if os.path.exists(f): os.remove(f)
for f in glob.glob(P("meta", "th-ph-21*")): os.remove(f)
for f in ("titles.json",):
    d = json.load(open(P("data", f), encoding="utf-8"))
    for k in ("titles", "original"): d[k] = {i: t for i, t in d.get(k, {}).items() if i not in gone and i != "ph-21"}
    json.dump(d, open(P("data", f), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ts = open(P("data", "titles_src.py"), encoding="utf-8").read()
ts = "\n".join(l for l in ts.split("\n") if not re.match(r"\s*'(a21\d\d|ph-21)':", l))
open(P("data", "titles_src.py"), "w", encoding="utf-8").write(ts)

# 2. lesson pages
END = re.compile(r'<h2[ >]|<aside class="co co-checked"|</div><footer')
def drop_interview(s):
    while True:
        i = s.find("<h2>Interview questions</h2>")
        if i < 0: return s
        m = END.search(s, i + 10)
        s = s[:i] + s[m.start():] if m else s[:i]
LEVELS = {"Junior": "Foundation", "Mid": "Intermediate", "Senior": "Advanced"}
TERMS = [("System design rounds", "System design exercises"), ("system design round", "system design exercise"),
         ("System design round", "System design exercise"),
         ("An interview where you design a system end to end and discuss trade-offs", "An exercise where you design a system end to end and discuss trade-offs"),
         ("<td>Interviews</td>", "<td>Design</td>")]
A = re.compile(r'(<a\b[^>]*href="#([\w-]+)"[^>]*>)(.*?)(</a>)', re.S)
changed = 0
for f in glob.glob(P("lessons", "*.html")):
    me = os.path.basename(f)[:-5]
    a = open(f, encoding="utf-8").read()
    b = drop_interview(a)
    b = re.sub(r'(<span class="qa-lvl[^"]*">)(Junior|Mid|Senior)(</span>)', lambda m: m.group(1) + LEVELS[m.group(2)] + m.group(3), b)
    b = re.sub(r"<tr>\s*<td><a [^>]*>[^<]*[Ii]nterview[^<]*</a></td>.*?</tr>\s*", "", b, flags=re.S)
    b = re.sub(r"<li><a [^>]*>[^<]*[Ii]nterview[^<]*</a>.*?</li>\s*", "", b, flags=re.S)
    for x, y in TERMS: b = b.replace(x, y)
    b = re.sub(r'<a class="pn (prev|next)" href="#a21\d\d">.*?</a>', "", b)
    # the phases after 21 move up by one
    if me in newnum:
        b = b.replace(f'<span class="chip chip-num">Lesson {oldnum[me]}</span>', f'<span class="chip chip-num">Lesson {newnum[me]}</span>')
    for op, np in shiftp.items():
        b = re.sub(r'(href="#ph-%s">Phase )%s( · )' % (op, op), r"\g<1>%s\g<2>" % np, b)
        b = b.replace(f'<a href="#ph-{op}"><span class="num">{op}</span>', f'<a href="#ph-{op}"><span class="num">{np}</span>')
    b = A.sub(lambda m: m.group(1) + (m.group(3).replace(oldnum[m.group(2)], newnum[m.group(2)]) if m.group(2) in oldnum and m.group(3) == oldnum[m.group(2)] else m.group(3)) + m.group(4), b)
    if b != a: open(f, "w", encoding="utf-8").write(b); changed += 1

# 3. lesson 0.0, home page, search, README
n_total = sum(len(ch["lessons"]) for p in course for ch in p["chapters"])
n_ph = sum(len(p["chapters"]) for p in course)
l0 = P("lessons", "l0001.html")
s = open(l0, encoding="utf-8").read()
s = re.sub(r"<li><strong>Part 7 · Projects and Case Files \(Phases 20 and 21\)\.</strong>.*?</li>",
           "<li><strong>Part 7 · Hands-On Projects (Phase 20).</strong> 79 smaller projects you build and test stage by stage, from starter tools to frontier systems.</li>", s, flags=re.S)
s = re.sub(r"<li><strong>Part 8 · Project Library \(Phases 22 to 30\)\.</strong>", "<li><strong>Part 8 · Project Library (Phases 21 to 29).</strong>", s)
s = re.sub(r'<li><a href="#ph-21"><span class="num">21</span>[^<]*</a></li>', "", s)
s = s.replace('<span class="cmap-pname">Projects and Case Files</span>', '<span class="cmap-pname">Hands-On Projects</span>')
s = re.sub(r"[\d,]+ lessons in 31 phases: 753 lessons in phases 0 to 19, 79 guided projects, 61 interview case-file lessons, 199 cheat sheets",
           f"{n_total:,} lessons in {n_ph} phases: 753 lessons in phases 0 to 19, 79 guided projects, 199 cheat sheets", s)
for a, b in [(" Build projects from Phase 20 as you go, and work the case files of Phase 21 before interviews.", " Build projects from Phase 20 as you go."),
             (", the case files of Phase 21 about 22", ""),
             ("to jump to any lesson, section heading or interview question by name", "to jump to any lesson or section heading by name"),
             (", and interview questions with model answers", ""), (" and interview questions with model answers", ""),
             ("then hands-on projects, interview case files and a project library", "then hands-on projects and a project library"),
             ("Eight parts, 31 phases", f"Eight parts, {n_ph} phases"), ("Pick a route through the 31 phases", f"Pick a route through the {n_ph} phases"),
             ("then practice and interview questions.", "then practice."), ("<span>In Interview prep</span>", "<span>In the Playground</span>"),
             ("The seventh and eighth are practice.", "The seventh and eighth are practice.")]:
    s = s.replace(a, b)
s = re.sub(r"<li><strong>Review, Interview prep and Playground\.</strong>(.*?)<em>Interview prep</em> collects every interview question in the course with a model answer\. ",
           r"<li><strong>Review and Playground.</strong>\1", s, flags=re.S)
s = s.replace("The icons on the left open them. <em>Review</em>", "The icons on the left open them. <em>Review</em>")
open(l0, "w", encoding="utf-8").write(s)

edit(P("engine", "course.js"), [("guided projects, interview case files and a project library", "guided projects and a project library"),
                                ("quick checks, exercises and interview questions to make it stick", "quick checks and exercises to make it stick")])
edit(P("engine", "player.js"), [("a seventh of projects and interview case files, and an eighth", "a seventh of hands-on projects, and an eighth"),
                                ('"Course map":"31 phases in eight parts;', f'"Course map":"{n_ph} phases in eight parts;')])
dj = P("engine", "dj.js"); s = open(dj, encoding="utf-8").read()
for a, b in [('["interview", "#interview", "Interview prep", "chat"], ', ""), ('<a class="dj-btn" href="#interview">Practise interview questions</a>', ""),
             ('placeholder="Search lessons, sections, interview questions, labs"', 'placeholder="Search lessons, sections and labs"'),
             ('[["Interview prep", "#interview"], ["Playground", "#playground"]', '[["Playground", "#playground"]'),
             ('["Interview prep|#interview", "Playground|#playground"', '["Playground|#playground"'),
             ('const PAGES = { interview: [renderInterview, "Interview prep"], playground:', "const PAGES = { playground:"),
             ("a spaced Review queue for quick checks, an Interview bank built\n   from every interview question in the lessons, and a Playground", "a spaced Review queue for quick checks, and a Playground")]:
    if a not in s: raise SystemExit("dj.js: " + a[:60])
    s = s.replace(a, b)
i = s.index("    const B = bank(), byCh = {}; B.forEach(x => { byCh[x.ch] = (byCh[x.ch] || 0) + 1; });")
j = s.index('"</a>"));', s.index("Practise all ", i)) + len('"</a>"));')
s = s[:i] + s[j:]
k = s.index('    bank().forEach(x => IDX.push({ g: "Interview questions"')
s = s[:k] + s[s.index("\n", k) + 1:]
open(dj, "w", encoding="utf-8").write(s)

rd = P("README.md"); s = open(rd, encoding="utf-8").read()
s = re.sub(r"then 79 guided projects, 60 interview case files and a library of (\d+) more projects and recipes: \*\*[\d,]+ lessons in 31 phases\*\*",
           lambda m: f"then 79 guided projects and a library of {m.group(1)} more projects and recipes: **{n_total:,} lessons in {n_ph} phases**", s)
s = s.replace("quick checks, interview questions and a review queue", "quick checks and a review queue")
s = s.replace("one menu for all 31 phases", f"one menu for all {n_ph} phases")
s = s.replace("| 7 · Projects and Case Files | 20 Hands-On AI Projects · 21 Interview Case Files: Debugging AI Systems | 144 |", "| 7 · Hands-On Projects | 20 Hands-On AI Projects | 83 |")
s = re.sub(r"(\| 8 · Project Library \|)([^|]*)\|", lambda m: m.group(1) + re.sub(r"\b(2[2-9]|30)\b(?= )", lambda x: str(int(x.group(1)) - 1), m.group(2)) + "|", s)
s = s.replace(" Phase 21 opens with how an interview loop runs, then gives 60 real incidents to diagnose before reading what actually happened.", "")
s = s.replace("to jump to any lesson, section or interview question.", "to jump to any lesson or section.")
s = re.sub(r"\n[^\n]*tools/part6[^\n]*", "", s)
s = re.sub(r"\*\*Open the course:\*\* https://\S+", "**Open the course:** this is the team edition. Serve this folder with any static web server (see *Run it locally* below), or put it on an internal web server.", s)
s = re.sub(r"\n[^\n]*tools/migrate\.py[^\n]*", "", s)
open(rd, "w", encoding="utf-8").write(s)
edit(P("THIRD_PARTY_NOTICES.md"), [("lessons, figures and interview questions are adapted", "lessons and figures are adapted")], strict=False)

print(json.dumps({"lessons removed": len(gone), "pages changed": changed, "lessons": n_total, "phases": n_ph}))
subprocess.run([sys.executable, P("tools", "build.py")], cwd=DST, check=True)
