"""Repository extras turned into course HTML: cheat sheets (cheatsheets/*.md) and practice problems (practice/<id>/)."""
import html, json, pathlib, re
import markdown

REPO = pathlib.Path("/tmp/claude-0/z2/aiefs/repo")
md = lambda t: markdown.markdown(t, extensions=["fenced_code", "tables", "sane_lists"])
TYPE_CLASS = {"concepts": "cs-violet", "glossary": "cs-violet", "task-table": "cs-blue", "command-table": "cs-blue",
              "annotated-code": "cs-ink", "flow": "cs-teal", "architecture": "cs-teal", "defaults": "cs-amber",
              "comparison": "cs-slate", "troubleshooting": "cs-red", "qa": "cs-green", "tips": "cs-green"}
WIDE = {"annotated-code", "architecture", "defaults", "troubleshooting", "comparison"}
KIND_MARK = {"client": "▢", "process": "⚙", "store": "▤", "queue": "≡", "gpu": "▦", "model": "◆"}


def parse_sheet(path):
    s = pathlib.Path(path).read_text()
    fm, body = re.match(r"---\n(.*?)\n---\n(.*)", s, re.S).groups()
    meta = dict(re.findall(r"^(\w+): (.*)$", fm, re.M))
    blocks = []
    for chunk in re.split(r"^## ", body, flags=re.M)[1:]:
        head, rest = chunk.split("\n", 1)
        keys, _, content = rest.partition("\n\n")
        kv = dict(re.findall(r"^(\w+): (.*)$", keys, re.M))
        blocks.append({"title": head.strip(), "type": kv.get("type", "tips"), "lang": kv.get("lang", ""),
                       "span": int(kv["span"]) if "span" in kv else (2 if kv.get("type") in WIDE else 1), "body": content.strip()})
    return meta, blocks


def arch_svg(src):
    nodes, edges = {}, []
    for line in src.splitlines():
        p = [x.strip() for x in line.split("|")]
        if p[0] == "node":
            c, r = map(int, p[2].split(","))
            nodes[p[1]] = {"c": c, "r": r, "label": p[3], "sub": p[4] if len(p) > 4 else "", "kind": p[5] if len(p) > 5 else ""}
        elif p[0] == "edge":
            edges.append((p[1], p[2], p[3] if len(p) > 3 else ""))
    W, H, GX, GY, PAD = 176, 56, 70, 52, 8
    cols, rows = max(n["c"] for n in nodes.values()), max(n["r"] for n in nodes.values())
    vw, vh = cols * W + (cols - 1) * GX + 2 * PAD, rows * H + (rows - 1) * GY + 2 * PAD
    pos = {k: (PAD + (n["c"] - 1) * (W + GX), PAD + (n["r"] - 1) * (H + GY)) for k, n in nodes.items()}
    out = [f'<svg class="cs-arch" viewBox="0 0 {vw} {vh}" role="img" aria-label="Architecture diagram">',
           '<defs><marker id="csarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
           '<path d="M0,0 L10,5 L0,10 z" class="cs-arrowhead"/></marker></defs>']
    for a, b, lab in edges:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        cx1, cy1, cx2, cy2 = x1 + W / 2, y1 + H / 2, x2 + W / 2, y2 + H / 2
        dx, dy = cx2 - cx1, cy2 - cy1
        def edge_pt(cx, cy, sx, sy):          # where the line from the centre leaves the box
            tx = (W / 2) / abs(sx) if sx else 1e9; ty = (H / 2) / abs(sy) if sy else 1e9; t = min(tx, ty)
            return cx + sx * t, cy + sy * t
        sx, sy = edge_pt(cx1, cy1, dx, dy); ex, ey = edge_pt(cx2, cy2, -dx, -dy)
        out.append(f'<line x1="{sx:.0f}" y1="{sy:.0f}" x2="{ex:.0f}" y2="{ey:.0f}" class="cs-edge" marker-end="url(#csarr)"/>')
        if lab:
            mx, my = (sx + ex) / 2, (sy + ey) / 2
            out.append(f'<text x="{mx:.0f}" y="{my - 5:.0f}" class="cs-elabel" text-anchor="middle">{html.escape(lab)}</text>')
    for k, n in nodes.items():
        x, y = pos[k]
        out.append(f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="8" class="cs-node"/>'
                   f'<text x="{x + W / 2}" y="{y + (24 if n["sub"] else 33)}" class="cs-nlabel" text-anchor="middle">{html.escape(n["label"])}</text>')
        if n["sub"]:
            out.append(f'<text x="{x + W / 2}" y="{y + 42}" class="cs-nsub" text-anchor="middle">{html.escape(n["sub"])}</text>')
        if n["kind"] in KIND_MARK:
            out.append(f'<text x="{x + W - 9}" y="{y + 15}" class="cs-nkind" text-anchor="end">{KIND_MARK[n["kind"]]}<title>{n["kind"]}</title></text>')
    return "".join(out) + "</svg>"


def block_html(b):
    t, body = b["type"], b["body"]
    if t == "architecture":
        inner = arch_svg(re.search(r"```arch\n(.*?)```", body, re.S).group(1))
    elif t == "annotated-code":
        code = re.search(r"```\w*\n(.*?)```", body, re.S).group(1)
        lines = []
        for ln in code.rstrip("\n").split("\n"):
            m = re.match(r"(.*?\S)\s{2,}(#.*)$", ln)
            lines.append((m.group(1), m.group(2)) if m else (ln, ""))
        w = max(len(c) for c, _ in lines) + 2
        rows = "".join(f'<span class="cs-cl"><span class="cs-cc">{html.escape(c.ljust(w) if k else c)}</span>'
                       f'<span class="cs-cm">{html.escape(k)}</span></span>\n' for c, k in lines)
        plain = "\n".join(c for c, _ in lines)
        inner = (f'<div class="cs-code"><button type="button" class="copy" data-copy="{html.escape(plain)}">Copy</button>'
                 f'<pre><code>{rows}</code></pre></div>')
    elif t == "flow":
        steps = re.findall(r"^\d+\. (.*)$", body, re.M)
        inner = '<ol class="cs-flow">' + "".join(f"<li>{md(s)[3:-4]}</li>" for s in steps) + "</ol>"
    else:
        inner = md(body)
    inner = re.sub(r"&lt;(\w[\w -]*)&gt;", r'<span class="cs-ph">&lt;\1&gt;</span>', inner)
    return (f'<section class="cs-block {TYPE_CLASS.get(t, "cs-slate")} cs-span{min(b["span"], 2)}">'
            f'<h3>{html.escape(b["title"])}</h3><div class="cs-body cs-{t}">{inner}</div></section>')


def sheet_html(sheet_id, lesson_titles=None):
    meta, blocks = parse_sheet(REPO / "cheatsheets" / f"{sheet_id}.md")
    covers = [p.strip() for p in meta.get("sources", "").split(",") if p.strip()]
    cov = ""
    if lesson_titles:
        items = [lesson_titles[p] for p in covers if p in lesson_titles]
        if items:
            cov = '<p class="cs-covers">Covers ' + ", ".join(items) + "</p>"
    return (f'<div class="cs-sheet" style="--cs-hue:{meta.get("hue", "200")}"><header class="cs-head">'
            f'<span class="cs-code-tile">{html.escape(meta.get("code", ""))}</span><div><h2>{html.escape(meta["title"])}</h2>'
            f'<p class="cs-sub">{html.escape(meta.get("subtitle", ""))}</p>{cov}</div></header>'
            f'<div class="cs-grid">{"".join(block_html(b) for b in blocks)}</div></div>')


def practice_html(pid):
    d = REPO / "practice" / pid
    meta = json.loads((d / "meta.json").read_text())
    hints = re.split(r"^## .*$", (d / "hints.md").read_text(), flags=re.M)[1:]
    files = {"tests.py": (d / "tests.py").read_text(), "fixtures.json": (d / "fixtures.json").read_text(),
             "solution.py": (d / "solution.py").read_text(), "starter.py": (d / "starter.py").read_text()}
    if (d / "support.py").exists():
        files["support.py"] = (d / "support.py").read_text()
    mut = "".join(f"<li>{html.escape(v)}</li>" for v in meta.get("mutants", {}).values())
    hint_html = "".join(f'<details class="px-hint"><summary>Hint {i + 1}</summary>{md(h.strip())}</details>' for i, h in enumerate(hints))
    return (f'<div class="px" data-px="{pid}"><div class="px-meta"><span class="chip">{meta["difficulty"]}</span>'
            f'<span class="chip">{meta["minutes"]} min</span><span class="chip">{meta["kind"]}</span></div>'
            f'<div class="px-problem">{md((d / "problem.md").read_text())}</div>'
            f'<div class="px-editor"><div class="px-bar"><span>Your code</span><span class="px-actions">'
            f'<button type="button" class="px-run">Run the checks</button><button type="button" class="px-reset">Reset</button></span></div>'
            f'<textarea class="px-src" spellcheck="false" aria-label="Your solution">{html.escape(files["starter.py"])}</textarea></div>'
            f'<div class="px-out" aria-live="polite"></div>'
            f'<details class="px-mut"><summary>Common mistakes the checks catch</summary><ul>{mut}</ul></details>'
            f'{hint_html}<details class="px-sol" hidden><summary>Reference solution and notes</summary>'
            f'<pre><code>{html.escape(files["solution.py"])}</code></pre>{md((d / "notes.md").read_text())}</details>'
            f'<script type="application/json" class="px-files">{json.dumps(files).replace("</", "<\\/")}</script></div>')


HARNESS = (REPO / "practice" / "_harness" / "practice_check.py").read_text()
