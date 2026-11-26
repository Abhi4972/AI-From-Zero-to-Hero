"""Compact brief for writing overlays: python3 px/brief2.py a2001 a2002"""
import sys, re, json, pathlib
sys.path.insert(0, "/home/claude/aifs"); sys.path.insert(0, "/home/claude/ai-from-zero-to-hero/data")
import conv_px, titles_src as T
REPO = pathlib.Path("/home/claude/upstream")
D = json.loads(pathlib.Path("/home/claude/aifs/px/demos.json").read_text())
projs = sorted((json.loads(f.read_text()) for f in (REPO / "projects").glob("*/project.json")), key=lambda j: (j.get("level", 9), j["title"].lower()))
projs = [j for j in projs if j.get("status") == "ready"]
for lid in sys.argv[1:]:
    n = int(lid[3:]); j = projs[n - 1]
    st = {"mermaid": {}, "math": {}, "figcfg": {}, "blocks": []}
    c = conv_px.convert_project(REPO / "projects" / j["id"], f"20.{n}", st, D.get(j["id"]))
    src = c["src"]
    print(f"=== {lid} {T.LESSONS.get(lid)} [{j['id']}] L{j.get('level')} {','.join(j['languages'])}")
    print("TAG:", j.get("tagline")); print("BUILD:", j.get("youWillBuild"))
    for s in re.findall(r"^## (Step \d+ · .+?)\n(.*?)(?=^## |\Z)", src, re.S | re.M):
        body = re.sub(r"\?\?\? .*?\n\?\?\?", "", s[1], flags=re.S); body = re.sub(r"\{\{FIG:[^}]+\}\}|\*Step.*?\*\n", "", body)
        wb = re.sub(r"\s+", " ", body)[:420]
        print(" -", s[0], "::", wb)
    ex = re.search(r"^## Exercises\n\n(.*?)(?=^## |^:::|\Z)", src, re.S | re.M)
    print("EX:", ex.group(1).strip() if ex else "-")
    d = D.get(j["id"], {})
    out = d.get("out", "")
    print("DEMO:", " ".join(d.get("cmd", [])), "code", d.get("code"))
    lines = out.splitlines()
    print("\n".join(l[:150] for l in lines[:28]) + (f"\n...({len(lines)} lines)" if len(lines) > 28 else ""))
    print()
