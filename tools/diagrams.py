"""diagrams.py: render the step-through diagrams in data/diagrams/ and put each one into its lesson.

Each data/diagrams/<lesson id>.mmd is a Mermaid flowchart. Optional first lines:
  %% after: <start of an h2 heading>   the diagram goes after the first paragraph of that section
                                       (default: the first section after "The problem")
The rendered SVG uses the same theme as the course's other diagrams, so the motion layer
animates it and gives it Replay and Step through. A diagram is re-rendered only when its source changes.
Needs mmdc (Mermaid CLI). Run this, then tools/build.py.

Usage: python3 tools/diagrams.py [lesson id ...]
"""
import re, os, sys, json, hashlib, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "data", "diagrams")
THEME = {"theme": "base", "themeVariables": {
    "fontFamily": "Inter,system-ui,sans-serif", "fontSize": "14px", "primaryColor": "#f9e8da", "primaryBorderColor": "#b5521b",
    "primaryTextColor": "#211c16", "textColor": "#211c16", "lineColor": "#6c6357", "clusterBkg": "#faf7f2", "clusterBorder": "#d8cdbc",
    "edgeLabelBackground": "#ffffff", "titleColor": "#0b1018", "tertiaryColor": "#f4efe7", "secondaryColor": "#f4efe7"},
    "flowchart": {"htmlLabels": True, "curve": "basis"}}
FIG = re.compile(r'<figure class="diagram mmfig" data-mmd="([^"]+)" data-h="([^"]+)">.*?</figure>\n?', re.S)

def render(src, sid):
    with tempfile.TemporaryDirectory() as d:
        cfg, i, o = (os.path.join(d, n) for n in ("c.json", "i.mmd", "o.svg"))
        json.dump(THEME, open(cfg, "w")); open(i, "w", encoding="utf-8").write(src)
        r = subprocess.run(["mmdc", "-q", "-i", i, "-o", o, "-c", cfg, "-I", sid, "-b", "transparent"], capture_output=True, text=True)
        if r.returncode or not os.path.exists(o): raise RuntimeError(r.stderr[-800:])
        svg = open(o, encoding="utf-8").read()
    svg = svg.replace(f'<svg id="{sid}" ', f'<svg class="dg mm" id="{sid}" ', 1)
    assert 'class="dg mm"' in svg and "flowchart-v2" in svg, "not a flowchart"
    return svg

def place(a, after):
    heads = list(re.finditer(r"<h2\b[^>]*>(.*?)</h2>", a, re.S))
    txt = lambda m: re.sub(r"<[^>]+>", "", m.group(1)).strip()
    h = next((m for m in heads if after and txt(m).startswith(after)), None) if after else \
        next((m for m in heads if not re.match(r"(The )?problem\b", txt(m), re.I)), None)
    if not h: raise RuntimeError(f"no section {after!r}")
    end = heads[heads.index(h) + 1].start() if heads.index(h) + 1 < len(heads) else len(a)
    pos = h.end()
    for m in re.finditer(r"</p>", a[h.end():end]):
        seg = a[h.end():h.end() + m.end()]
        balanced = all(seg.count("<" + t) == seg.count("</" + t + ">") for t in ("aside", "details", "li", "table", "blockquote", "div"))
        if not balanced: continue
        if re.sub(r"<[^>]+>", "", seg[seg.rfind("<p"):]).strip().endswith(":"): continue   # "…defined by:" belongs with its list
        pos = h.end() + m.end(); break
    return pos

def main(only):
    jobs = []
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".mmd"): continue
        i = f[:-4]
        if only and i not in only: continue
        src = open(os.path.join(SRC, f), encoding="utf-8").read()
        after = (re.search(r"^%% after: (.+)$", src, re.M) or [None, None])[1]
        h = hashlib.sha1((i + src).encode()).hexdigest()[:10]
        jobs.append((i, src, after, h))
    def one(job):
        i, src, after, h = job
        p = os.path.join(ROOT, "lessons", i + ".html"); a = open(p, encoding="utf-8").read()
        m = FIG.search(a)
        if m and m.group(2) == h: return i, "same"
        fig = f'<figure class="diagram mmfig" data-mmd="{i}" data-h="{h}"><div class="dg-scroll">{render(src, "mm" + h)}</div></figure>\n'
        if m: a = a[:m.start()] + fig + a[m.end():]
        else:
            pos = place(a, after.strip() if after else None)
            a = a[:pos] + "\n" + fig + a[pos:]
        open(p, "w", encoding="utf-8").write(a)
        return i, "updated" if m else "added"
    out, bad = {}, []
    with ThreadPoolExecutor(4) as ex:
        for job, fut in [(j, ex.submit(one, j)) for j in jobs]:
            try: i, s = fut.result(); out[s] = out.get(s, 0) + 1
            except Exception as e: bad.append(f"{job[0]}: {e}")
    print(json.dumps(out))
    if bad: print("\n".join(bad)); sys.exit(1)

if __name__ == "__main__": main(set(sys.argv[1:]))
