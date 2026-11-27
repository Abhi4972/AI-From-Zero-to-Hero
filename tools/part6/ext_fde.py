"""Phase 31: Forward Deployed Engineering with Claude. Original lessons written for this course (aifs/fde/*.md),
inspired by the outline of Anthropic's Claude FDE learning path and other FDE programmes; no text is copied from them."""
import pathlib, re
import conv
from ext import lesson_ref

SRC = pathlib.Path("/home/claude/aifs/fde")
WORK = pathlib.Path("/home/claude/aifs/extsrc/fde")

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
        body = "".join(x if x.startswith("```") else re.sub(r"(?<![\d.\w#\[])31\.(\d{1,2})(?![\d])", lambda m: f"[31.{m.group(1)}](#a31{int(m.group(1)):02d})", re.sub(r"\$(?=\d)", "&#36;", x)) for x in parts)
        body = body.replace("{{NEEDS}}", "; ".join(lesson_ref(i) for i in rel) if rel else "the earlier lessons of this phase")
        wd = WORK / f.stem; (wd / "code").mkdir(parents=True, exist_ok=True)
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        src = conv.body_fixer(wd, f"{pno}.{n}", lstore)(body.strip())
        out.append({"title": meta["title"], "minutes": int(meta.get("minutes", 60)), "type": meta.get("type", "Lesson"), "num": f"{pno}.{n}",
                    "src": src, "key": f"ext/fde/{f.stem}", "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(wd),
                    "phase": "ext/fde", "group": meta.get("group", ""), "nb": True})
    return out
