"""blend.py: place the companion lessons inside their phases, next to the lessons they support, and renumber.

The order comes from data/blend_src.py. Every page is then brought in line with the new numbers: the "Lesson N.M" chip,
links to other lessons, plain "Lesson N.M" references, and "Phase 7 · 03"-style references in the Needs lists.
The companion lessons lose their separate label. Run it once; it records what it did in data/blend.json, and a second run
only reorders course.json again (pages already carry the new numbers).

Usage: python3 tools/blend.py      then: python3 tools/retitle.py && python3 tools/build.py
"""
import re, os, sys, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "data"))
import blend_src as B

P = lambda *a: os.path.join(ROOT, *a)
course = json.load(open(P("data", "course.json"), encoding="utf-8"))
done_before = os.path.exists(P("data", "blend.json"))

old_num, new_num = {}, {}
for part in course:
    for ch in part["chapters"]:
        L = ch["lessons"]
        for l in L: old_num[l["id"]] = l["num"]
        if not any(l["id"].startswith("l") and l["id"] != "l0001" for l in L): continue
        sheets = [l for l in L if l["id"].startswith("cs-")]
        main = [l for l in L if not l["id"].startswith("l") and not l["id"].startswith("cs-")]
        comp = [l for l in L if l["id"].startswith("l")]
        by = {l["id"]: l for l in comp}
        order = [l for l in main]
        if "l0001" in by: order.insert(0, by.pop("l0001"))
        start = [by[i] for i, w in B.PLACE.items() if i in by and w == "^"]
        end = [by[i] for i, w in B.PLACE.items() if i in by and w == "$"]
        k0 = 1 if order and order[0]["id"] == "l0001" else 0
        order[k0:k0] = start
        rest = [i for i, w in B.PLACE.items() if i in by and w not in ("^", "$")]
        while rest:
            ids = [l["id"] for l in order]
            placed = [i for i in rest if B.PLACE[i] in ids]
            if not placed: raise SystemExit("cannot place: %s" % rest)
            for i in placed:
                ids = [l["id"] for l in order]
                j = ids.index(B.PLACE[i]) + 1
                while j < len(order) and B.PLACE.get(order[j]["id"]) == B.PLACE[i]: j += 1   # keep the source order of siblings
                order.insert(j, by[i]); rest.remove(i)
        order += end
        n = 0 if order[0]["id"] == "l0001" else 1
        for l in order:
            l["num"] = f"{ch['code']}.{n}"; n += 1
            if l.get("group", "").startswith("From Zero to Agents"): l.pop("group", None)
            if l.get("depth") == "From Zero to Agents": l["depth"] = ""
        ch["lessons"] = order + sheets
for part in course:
    for ch in part["chapters"]:
        for l in ch["lessons"]: new_num[l["id"]] = l["num"]
json.dump(course, open(P("data", "course.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
if done_before:
    print("course.json reordered; pages were already renumbered"); raise SystemExit

# old "P.N" -> id (per phase), and the source repo's "Phase P · NN" numbering -> id
by_old = {v: k for k, v in old_num.items() if re.match(r"^\d+\.\d+$", v)}
def nn(old):                                   # an old "P.N" -> its new number (unchanged if unknown)
    i = by_old.get(old); return new_num.get(i, old) if i else old
def up(p, k):                                  # source repo's lesson k of phase p -> new number
    i = f"a{int(p):02d}{int(k):02d}"; return new_num.get(i)

NUM = r"\d{1,2}\.\d{1,3}"
TOK = re.compile(
    r'(?P<a><a\b[^>]*href="#(?P<href>[\w-]+)"[^>]*>(?P<at>.*?)</a>)'
    r'|(?P<lr>\b(?:Lessons?|lessons?|builds on) ' + NUM + r'(?:(?:,\s*|\s+and\s+|\s+or\s+|\s+to\s+|\s*[–-]\s*)' + NUM + r'(?![\d.]))*)'
    r'|(?P<chip><span class="chip chip-num">Lesson ' + NUM + r'</span>)', re.S)
def fix_tokens(s, me):
    def one(m):
        if m.group("a"):
            i, t = m.group("href"), m.group("at")
            if i in old_num and old_num[i] != new_num.get(i) and re.match(r"^\d+\.\d+$", old_num[i]):
                t = re.sub(r"(?<![\d.])" + re.escape(old_num[i]) + r"(?![\d])", new_num[i], t)
            return m.group(0)[:m.start("at") - m.start()] + t + "</a>"
        if m.group("chip"):
            return f'<span class="chip chip-num">Lesson {new_num.get(me, "")}</span>' if me in new_num else m.group(0)
        return re.sub(r"(?<![\d.])" + NUM + r"(?![\d.])", lambda x: nn(x.group(0)), m.group("lr"))
    return TOK.sub(one, s)

NEEDS = re.compile(r"<li><strong>Needs</strong>:.*?</li>", re.S)
def fix_needs(li):
    li = re.sub(r"Phase (\d+) · (\d{1,2})\b", lambda m: ("Lesson " + up(*m.groups())) if up(*m.groups()) else m.group(0), li)
    def rng(m):
        p, a, b = m.group(1), m.group(4), m.group(6)
        x, y = up(p, a), (up(p, b) if b else None)
        if not x or (b and not y): return m.group(0)
        return f"Lessons {x} to {y}" if b else f"Lesson {x}"
    return re.sub(r"Phase (\d+)(,)? (Track [A-Z] )?[Ll]essons? (\d{1,2})(\s*(?:-|to|–)\s*(\d{1,2}))?\b", rng, li)

ZTA = '<div class="co-label">From Zero to Agents</div><div class="co-title">Already covered in your course</div>'
ZTA_NEW = '<div class="co-label">Build up to this</div><div class="co-title">Lessons that cover the basics first</div>'
changed = 0
for f in sorted(os.listdir(P("lessons"))):
    if not f.endswith(".html"): continue
    path = P("lessons", f); a = open(path, encoding="utf-8").read(); me = f[:-5]
    b = a.replace('<span class="chip chip-zero">From Zero to Agents</span>', "").replace(ZTA, ZTA_NEW)
    b = re.sub(r"There is no Zero to Agents chapter on this; it builds on ", "It builds on ", b)
    b = fix_tokens(b, me)
    b = NEEDS.sub(lambda m: fix_needs(m.group(0)), b)
    if b != a: open(path, "w", encoding="utf-8").write(b); changed += 1
json.dump({"old": old_num, "new": new_num}, open(P("data", "blend.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(json.dumps({"renumbered": sum(1 for k in new_num if old_num.get(k) != new_num[k]), "pages changed": changed}))
