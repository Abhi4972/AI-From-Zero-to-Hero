"""Print a compact brief of Part 7 lessons for writing voice overlays: python3 px/brief.py a2001 a2002 ..."""
import sys, re, json, pathlib
sys.path.insert(0, "/home/claude/aifs"); sys.path.insert(0, "/home/claude/ai-from-zero-to-hero/data")
import conv_px, titles_src as T
REPO = pathlib.Path("/home/claude/upstream")
course = json.load(open("/home/claude/ai-from-zero-to-hero/data/course.json"))
D = json.loads(pathlib.Path("/home/claude/aifs/px/demos.json").read_text())
projs = sorted((json.loads(f.read_text()) for f in (REPO / "projects").glob("*/project.json")), key=lambda j: (j.get("level", 9), j["title"].lower()))
projs = [j for j in projs if j.get("status") == "ready"]
scen = []
for sd in sorted((REPO / "interviews" / "scenarios").iterdir()):
    if (sd / "README.md").exists():
        mt, _ = conv_px._front((sd / "README.md").read_text()); scen.append((int(mt.get("level", 2) or 2), int(mt.get("minutes", 20) or 20), mt.get("title", sd.name).lower(), sd))
scen = [x[3] for x in sorted(scen)]
for lid in sys.argv[1:]:
    st = {"mermaid": {}, "math": {}, "figcfg": {}, "blocks": []}
    n = int(lid[3:])
    if lid.startswith("a20"):
        j = projs[n - 1]; c = conv_px.convert_project(REPO / "projects" / j["id"], f"20.{n}", st, D.get(j["id"]))
    else:
        c = conv_px.convert_scenario(scen[n - 2], f"21.{n}", st)
    src = c["src"]
    heads = re.findall(r"^## (.+)$", src, re.M)
    print(f"=== {lid} {T.LESSONS.get(lid)}  [{c['slug']}]")
    print("HEADS:", " | ".join(heads))
    body = re.sub(r"\?\?\? (tests|code) \|.*?\n\?\?\?", "[code hidden]", src, flags=re.S)
    body = re.sub(r":::goals.*?:::\n|:::prereq.*?:::\n|:::checked.*?:::", "", body, flags=re.S)
    body = re.sub(r"\n{3,}", "\n\n", body)
    lim = int(sys.argv[0] and 9000)
    print(body[:lim]); print()
