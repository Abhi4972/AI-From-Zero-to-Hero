"""fold_ops.py: fold the MLOps and LLMOps lessons into the phases they belong to, and close the gap in phase numbers.

The MLOps and LLMOps lessons (ids a3201-a3220) were built as their own phase. They now live inside the topic phases:
  a3201-a3214 (MLOps for classic ML, ending with Snowflake MLOps)  -> Phase 2, after a0221 (training-serving skew)
  a3215-a3219 (LLMOps)                                              -> Phase 17, after a1721 (LLM A/B testing)
  a3220 (capstone that needs both)                                  -> Phase 17, as its last lesson
The AI on Snowflake chapter keeps its id ph-33 but is shown as Phase 32.

Run it after build_p6.py has (re)built phase 32 or 33, because that build puts the old chapter back:
    python3 tools/fold_ops.py [--renumber]
--renumber also runs tools/renumber.py, which rewrites every lesson-number reference from the numbers of the last
build (index.html) to the new ones. Use it only when index.html still shows the old numbers (the first fold, or a
rebuild of phase 32/33 followed by tools/build.py before folding). Then run tools/diagrams.py and tools/build.py.
"""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
P = lambda *a: os.path.join(ROOT, *a)
OPS = [f"a32{i:02d}" for i in range(1, 21)]
TO_P2, TO_P17, LAST_P17 = OPS[:14], OPS[14:19], OPS[19]
SNOW_ID, SNOW_CODE = "ph-33", "32"

course = json.load(open(P("data", "course.json"), encoding="utf-8"))
lessons = {l["id"]: l for p in course for ch in p["chapters"] for l in ch["lessons"]}
chap = {ch["id"]: ch for p in course for ch in p["chapters"]}

# 1. drop the separate chapter (and its part) if a build put it back
for p in course:
    p["chapters"] = [ch for ch in p["chapters"] if ch["id"] != "ph-32"]
course = [p for p in course if p["chapters"]]

def entry(i):
    e = dict(lessons[i]); e.pop("group", None); return e

def place(ch_id, ids, after):
    L = chap[ch_id]["lessons"]
    L[:] = [l for l in L if l["id"] not in ids]                    # idempotent: remove, then insert once
    if after is None:                                               # last lesson before the cheat sheets
        k = max(n for n, l in enumerate(L) if not l["id"].startswith("cs-")) + 1
    else:
        k = next(n for n, l in enumerate(L) if l["id"] == after) + 1
    L[k:k] = [entry(i) for i in ids]

place("ph-02", TO_P2, "a0221")
place("ph-17", TO_P17, "a1721")
place("ph-17", [LAST_P17], None)
chap[SNOW_ID]["code"] = SNOW_CODE

chap["ph-02"]["desc"] = ("Classic machine learning from scratch: regression, trees, SVMs, clustering, evaluation and pipelines, "
                         "then MLOps: reproducibility, experiment tracking, the model registry, data contracts, point-in-time features, "
                         "pipelines, CI/CD, serving, safe releases, monitoring, retraining, governance and MLOps on Snowflake.")
chap["ph-17"]["desc"] = ("Running models for real users: serving engines, GPUs and autoscaling, caching and routing, observability, "
                         "releases, LLMOps (release manifests, prompt registries, evaluation data from production, LLM monitoring and "
                         "model upgrades), reliability, security, compliance and cost.")

# 2. numbers, in order, within the changed phases
for cid in ("ph-02", "ph-17", SNOW_ID):
    ch = chap[cid]; n = 0
    for l in ch["lessons"]:
        if re.fullmatch(r"\d+\.\d+", str(l.get("num", ""))):
            n += 1; l["num"] = f"{ch['code']}.{n}"
json.dump(course, open(P("data", "course.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 3. breadcrumbs of the moved lessons and of the Snowflake phase
CRUMB = {"ph-02": "Phase 2 · Machine Learning Algorithms", "ph-17": "Phase 17 · " + chap["ph-17"]["title"]}
for i in OPS:
    f = P("lessons", i + ".html"); s = open(f, encoding="utf-8").read()
    home = "ph-02" if i in TO_P2 else "ph-17"
    s = re.sub(r'<a href="#ph-32">Phase 32 · [^<]*</a>', f'<a href="#{home}">{CRUMB[home]}</a>', s)
    open(f, "w", encoding="utf-8").write(s)
for f in sorted(os.listdir(P("lessons"))):
    if not f.endswith(".html"): continue
    fp = P("lessons", f); s = open(fp, encoding="utf-8").read()
    t = s.replace('href="#ph-33">Phase 33 · ', f'href="#ph-33">Phase {SNOW_CODE} · ').replace('href="#ph-33">Phase 33<', f'href="#ph-33">Phase {SNOW_CODE}<')
    if t != s: open(fp, "w", encoding="utf-8").write(t)

if "--renumber" in sys.argv:
    subprocess.run([sys.executable, P("tools", "renumber.py")], check=True)
print(json.dumps({"phase 2": len(chap["ph-02"]["lessons"]), "phase 17": len(chap["ph-17"]["lessons"]),
                  "snowflake shown as": SNOW_CODE, "parts": len(course)}))
