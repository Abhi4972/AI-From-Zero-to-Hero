"""Phase 33: AI on Snowflake, End to End. Original lessons written for this course (aifs/snowai/*.md),
built from Snowflake documentation (checked November 2026); no text is copied."""
import pathlib, re
import conv
from ext import lesson_ref

SRC = pathlib.Path("/home/claude/aifs/snowai")
WORK = pathlib.Path("/home/claude/aifs/extsrc/snowai")

def _meta(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    return {k.strip(): v.strip() for k, v in meta.items()}, text[m.end():]

def lessons(pno, store):
    out = []
    for n, f in enumerate(sorted(SRC.glob("*.md")), 1):
        meta, body = _meta(f.read_text())
        rel = [x.strip() for x in meta.get("lessons", "").split(",") if x.strip()]
        parts = re.split(r"(```.*?```)", body, flags=re.S)       # lesson numbers in prose become links (not inside code)
        body = "".join(x if x.startswith("```") else re.sub(r"(?<![\d.\w#\[])(3[1-3])\.(\d{1,2})(?![\d])", lambda m: f"[{m.group(1)}.{m.group(2)}](#a{m.group(1)}{int(m.group(2)):02d})", re.sub(r"\$(?=\d)", "&#36;", x)) for x in parts)
        body = body.replace("{{NEEDS}}", "; ".join(lesson_ref(i) for i in rel) if rel else "the earlier lessons of this phase")
        wd = WORK / f.stem; (wd / "code").mkdir(parents=True, exist_ok=True)
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        src = conv.body_fixer(wd, f"{pno}.{n}", lstore)(body.strip())
        out.append({"title": meta["title"], "minutes": int(meta.get("minutes", 60)), "type": meta.get("type", "Lesson"), "num": f"{pno}.{n}",
                    "src": src, "key": f"ext/snowai/{f.stem}", "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(wd),
                    "phase": "ext/snowai", "group": meta.get("group", ""), "nb": True})
    return out
