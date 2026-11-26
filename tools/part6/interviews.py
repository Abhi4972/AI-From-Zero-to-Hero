"""Turn AI Engineering from Scratch's interview questions (interviews/questions/*/*.md, MIT) into the course's
??? qa blocks, grouped by the lesson that teaches them.

load(in_vol, lesson_id, store) -> {our lesson id: [qa block markdown, ...]}
  in_vol(path) says whether a repo lesson path ("phases/03-deep-learning-core/01-the-perceptron") is in this volume,
  lesson_id(path) gives our id for it ("a0301"). A question goes to the first of its lessons that is in the volume."""
import re, glob, hashlib
EXCLUDE = None   # set to a function: a question that names any lesson it accepts is already placed elsewhere

REPO = "/tmp/claude-0/z2/aiefs/repo"
KIND = {"concept": "explain", "debug": "debug", "design": "defend", "tradeoff": "tradeoff",
        "code-reading": "coderead", "estimate": "estimate", "take-home": "takehome"}

def _h(s):
    return hashlib.md5(s.encode()).hexdigest()[:10]

def _math(t, store):
    pieces = re.split(r"(```.*?```|`[^`\n]+`)", t, flags=re.S)
    for i in range(0, len(pieces), 2):
        def disp(m):
            k = _h(m.group(1)); store["math"][k] = (m.group(1).strip(), True); return "{{KX:%s}}" % k
        def inl(m):
            k = _h(m.group(1)); store["math"][k] = (m.group(1), False); return "{{KI:%s}}" % k
        pieces[i] = re.sub(r"\$\$(.+?)\$\$", disp, pieces[i], flags=re.S)
        pieces[i] = re.sub(r"(?<![\\$\w])\$(?!\s)([^$\n]{1,200}?)(?<!\s)\$(?![\w$])", inl, pieces[i])
    return "".join(pieces)

def _sections(body):
    out, cur, name = {}, [], "_lead"
    in_code = False
    for ln in body.split("\n"):
        if ln.startswith("```"): in_code = not in_code
        if not in_code and ln.startswith("## "):
            out[name] = "\n".join(cur).strip(); name, cur = ln[3:].strip().lower(), []
        else:
            cur.append(ln)
    out[name] = "\n".join(cur).strip()
    return out

def load(in_vol, lesson_id, store):
    res = {}
    for f in sorted(glob.glob(f"{REPO}/interviews/questions/*/*.md")):
        if f.endswith("README.md"): continue
        t = open(f).read()
        m = re.match(r"---\n(.*?)\n---\n(.*)", t, re.S)
        if not m: continue
        fm, body = m.group(1), m.group(2)
        g = lambda k: (re.search(rf"^{k}:\s*(.*)$", fm, re.M) or [None, ""])[1].strip()
        lessons = [x.strip() for x in g("lessons").strip("[]").split(",") if x.strip()]
        if EXCLUDE and any(EXCLUDE(l) for l in lessons): continue
        home = next((l for l in lessons if in_vol(l)), None)
        if not home: continue
        kind = KIND.get(g("kind"), "explain")
        S = _sections(body)
        prompt = " ".join(S.get("_lead", "").split())
        if not prompt: continue

        def links(s):
            def rep(mm):
                path = re.sub(r"^(\.\./)+", "", mm.group(2)).rstrip("/")
                if path.startswith("phases/") and in_vol(path):
                    return f"[{mm.group(1)}](#{lesson_id(path)})"
                return mm.group(1)
            return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", rep, s)

        full = S.get("full answer", "")
        full = re.sub(r"^### (.+)$", r"**\1.**", full, flags=re.M)
        parts = [f"*Level {g('level')} of 4 · about {g('minutes')} minutes to answer well.*",
                 "**Short answer.** " + S.get("short answer", "").strip(), full]
        if S.get("wrong answers"):
            parts.append("**Plausible wrong answers.**\n\n" + S["wrong answers"])
        if S.get("follow-ups"):
            parts.append("**Follow-ups an interviewer may ask.**\n\n" + re.sub(r"\*\*Level (\d):\*\*", r"*(level \1)*", S["follow-ups"]))
        if S.get("taught in"):
            parts.append("**Where it is taught.** " + S["taught in"])
        ans = links(_math("\n\n".join(p for p in parts if p.strip()), store))
        q = links(_math(prompt, store))
        res.setdefault(lesson_id(home), []).append(f"??? {kind} | {q}\n{ans}\n???")
    return res
