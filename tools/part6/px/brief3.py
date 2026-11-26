import sys, re, pathlib
sys.path.insert(0, "/home/claude/aifs"); sys.path.insert(0, "/home/claude/ai-from-zero-to-hero/data")
import conv_px, titles_src as T
REPO = pathlib.Path("/home/claude/upstream")
scen = []
for sd in sorted((REPO / "interviews" / "scenarios").iterdir()):
    if (sd / "README.md").exists():
        mt, _ = conv_px._front((sd / "README.md").read_text()); scen.append((int(mt.get("level", 2) or 2), int(mt.get("minutes", 20) or 20), mt.get("title", sd.name).lower(), sd))
scen = [x[3] for x in sorted(scen)]
for lid in sys.argv[1:]:
    sd = scen[int(lid[3:]) - 2]
    meta, body = conv_px._front((sd / "README.md").read_text())
    secs = {(t or "").strip().lower(): b for t, b in conv_px._split_sections(body)}
    sq = lambda s, n: re.sub(r"\s+", " ", s)[:n]
    print(f"=== {lid} {T.LESSONS.get(lid)} [{sd.name}] L{meta.get('level')}")
    print("SIT:", sq(secs.get("situation", ""), 430))
    print("RES:", sq(secs.get("resolution", ""), 380))
    print("GEN:", sq(secs.get("generalize", ""), 160))
