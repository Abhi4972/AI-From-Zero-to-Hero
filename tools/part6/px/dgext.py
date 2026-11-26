"""Step-through diagrams for the Project Library (phases 22-30), written to data/diagrams/<id>.mmd.
Projects that run here: the steps in order. Apps and samples: how the parts connect. Recipes: the recipe's sections."""
import json, re, html, os
SITE = "/home/claude/ai-from-zero-to-hero"
OUT = SITE + "/data/diagrams"
course = json.load(open(SITE + "/data/course.json"))
L = [(ch["code"], l) for p in course for ch in p["chapters"] if ch["code"].isdigit() and 22 <= int(ch["code"]) <= 30 for l in ch["lessons"]]

def q(s, n=56):
    s = html.unescape(re.sub(r"<[^>]+>", "", s)).replace('"', "'").replace("`", "").strip()
    s = re.sub(r"\{#[^}]*\}", "", s); s = re.sub("[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]+", "", s).strip()
    s = re.sub(r"\s+", " ", s)
    if len(s) > n: s = s[:n - 1].rsplit(" ", 1)[0] + "…"
    if len(s) > 24:                          # two lines, words kept in order
        w, a = s.split(" "), []
        while w and len(" ".join(a + [w[0]])) <= (len(s) + 1) // 2: a.append(w.pop(0))
        if a and w: s = " ".join(a) + "<br/>" + " ".join(w)
    return s

def steps_flow(lid, page):
    st = re.findall(r"<h2>Step \d+ · (.*?)</h2>", page)
    if len(st) < 2: return None
    nodes = [f'  S{i}["{i + 1}. {q(t)}"]' for i, t in enumerate(st)]
    edges = [f"  S{i} --> S{i + 1}" for i in range(len(st) - 1)]
    return "%% after: The problem\nflowchart " + ("LR" if len(st) <= 3 else "TD") + "\n" + "\n".join(nodes + edges) + "\n"

def stack_flow(lid, page, sample=False):
    rows = dict(re.findall(r"<tr>\s*<td>([^<]+)</td>\s*<td>([^<]+)</td>\s*</tr>", page))
    if not rows: return None
    ui, fw, llm, db, tools = (rows.get(k) for k in ("Interface", "Framework", "Models", "Data store", "Tools and services"))
    who = "Snowflake account" if sample else "You"
    lines = ["%% after: " + ("How it is built" if "<h2>How it is built</h2>" in page else "What it does"), "flowchart TD", f'  U["{who}"]']
    prev = "U"
    if ui: lines.append(f'  UI["{q("Interface: " + ui)}"]'); lines.append(f"  {prev} --> UI"); prev = "UI"
    lines.append(f'  APP["{q(("App logic: " + fw) if fw else "App logic")}"]'); lines.append(f"  {prev} --> APP")
    if llm: lines.append(f'  M["{q("Models: " + llm)}"]'); lines.append('  APP -->|"prompts"| M'); lines.append('  M -->|"answers"| APP')
    if db: lines.append(f'  D["{q("Data: " + db)}"]'); lines.append('  APP -->|"store / retrieve"| D')
    if tools: lines.append(f'  T["{q("Tools: " + tools)}"]'); lines.append('  APP -->|"calls"| T')
    return "\n".join(lines) + "\n"

def recipe_flow(lid, page):
    sec = page.split("<h2>The recipe</h2>", 1)
    if len(sec) < 2: return None
    body = sec[1].split("<h2>", 1)[0]
    heads = [re.sub(r"<[^>]+>", "", h) for h in re.findall(r"<p><strong>([^<]{4,90})</strong>(?:</p>|\s*\n)", body)]
    heads = [h for h in heads if 3 < len(h) < 90 and not re.match(r"(Output|Note|Tip|Prerequisites|Setup|Install|Table of contents|What you|Required|Optional|Requirements|Conclusion|Summary|Next steps|Learn more|Resources)", h.strip(" :"), re.I) and not h.strip().endswith(":")]
    seen, hs = set(), []
    for h in heads:
        k = h.lower()
        if k not in seen: seen.add(k); hs.append(h)
    hs = hs[:6]
    if len(hs) < 2: return None
    nodes = [f'  S{i}["{q(t)}"]' for i, t in enumerate(hs)]
    edges = [f"  S{i} --> S{i + 1}" for i in range(len(hs) - 1)]
    return "%% after: The recipe\nflowchart TD\n" + "\n".join(nodes + edges) + "\n"

FALL = {"Chatbot": 'flowchart LR\n  A["Your sentence"] --> B["TextBlob: sentiment<br/>and noun phrases"] --> C["A rule picks<br/>the reply"]',
        "Novel": 'flowchart LR\n  A["Book text"] --> B["Split into<br/>sentences"] --> C["Polarity of<br/>each sentence"] --> D["Most positive<br/>and negative"]'}
def fallback(c, l, page):
    if c in (22, 23):
        slug = next((k for k in FALL if k in l["title"]), None)
        return ("%% after: The problem\n" + FALL[slug] + "\n") if slug else None
    if c in (28, 29):
        return '%% after: The recipe\nflowchart LR\n  A["Your code"] -->|"request"| B["Claude API"] -->|"response"| C["Your code<br/>uses the result"]\n'
    who = "Snowflake account" if c == 30 else "You"
    return f'%% after: What it does\nflowchart LR\n  A["{who}"] --> B["This project"] -->|"API calls"| C["Hosted models<br/>and services"]\n'
n = 0
for code, l in L:
    p = f"{SITE}/lessons/{l['id']}.html"
    if not os.path.exists(p): continue
    page = open(p, encoding="utf-8").read()
    c = int(code)
    src = steps_flow(l["id"], page) if c in (22, 23) else recipe_flow(l["id"], page) if c in (28, 29) else stack_flow(l["id"], page, c == 30)
    src = src or fallback(c, l, page)
    if src:
        open(f"{OUT}/{l['id']}.mmd", "w").write(src); n += 1
print("diagrams", n, "of", len(L))
