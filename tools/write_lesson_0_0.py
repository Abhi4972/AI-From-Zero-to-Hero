"""Rewrite lesson 0.0 (l0001) as the orientation for this course, from the course data. Run from the site root."""
import re, json, html as H
C = json.load(open('data/course.json'))
a = open('lessons/l0001.html', encoding='utf-8').read()
num = {l['id']: l['num'] for p in C for c in p['chapters'] for l in c['lessons']}
mins = {l['id']: l['min'] for p in C for c in p['chapters'] for l in c['lessons']}
PH = [c for p in C for c in p['chapters']]
def hrs(m): h = m / 60; return f"{h:.0f}" if h >= 10 else f"{h:.1f}"
def L(i, text=None): return f'<a class="xref" href="#{i}">{"Lesson " + num[i] if text is None else text}</a>'
def P(cid): c = next(x for x in PH if x['id'] == cid); return f'<a class="xref" href="#{cid}">Phase {c["code"]} · {H.escape(c["title"])}</a>'
def grange(cid, gname):
    c = next(x for x in PH if x['id'] == cid); ls = [l for l in c['lessons'] if l.get('group', '').endswith(gname)]
    assert ls, (cid, gname)
    return f'{L(ls[0]["id"], ls[0]["num"])} to {L(ls[-1]["id"], ls[-1]["num"])}', sum(l['min'] for l in ls)
def own(c): return [l for l in c['lessons'] if l['id'].startswith('a')]

head = re.search(r'<header class="m-head">.*?</header>', a, re.S).group(0)
head = head.replace('<span class="chip chip-zero">From Zero to Agents</span>', '')
assert 'Lesson 0.0' in head
def sec(name):
    return re.search(r'<h2>' + re.escape(name) + r'</h2>.*?(?=<h2>|<aside class="co co-recap">|<section class="quiz")', a, re.S).group(0)
finding = sec('Finding your way around'); mentions = sec('When a lesson mentions something it has not taught yet')
study = sec('How to study so it sticks'); stack = sec('The stack in one picture')
foot = re.search(r'<footer class="m-foot">.*</footer>', a, re.S).group(0)
tail = a[a.rfind('</footer>') + 9:]

def must(pat, new, s):
    s2, n = re.subn(pat, new, s, count=1, flags=re.S); assert n == 1, pat; return s2
fx = finding
fx = must(r'<li><strong>Course home\.</strong>.*?</li>', '<li><strong>Course home.</strong> Click the course name at the top left, or <em>Course home</em> in the contents. It shows every phase as a card, your overall progress, and a <em>Continue</em> button that takes you to your next lesson.</li>', fx)
fx = must(r'<li><strong>Choose your path\.</strong>.*?</li>\s*', '', fx)
fx = must(r'<li><strong>Chapters\.</strong>.*?</li>', '<li><strong>Phases and sections.</strong> A phase groups lessons on one subject. Open one to see its sections: the phase\'s own lessons, its <em>Cheat sheets</em> (one-page references), and companion lessons marked <em>From Zero to Agents</em>, grouped by topic. Each row shows how long a lesson takes and whether you have finished it.</li>', fx)
fx = must(r'(<li><strong>Contents\.</strong>.*?)all chapters and lessons(.*?</li>)', r'\1all phases and lessons\2<li><strong>Search everything.</strong> Press <kbd>⌘K</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> (or <kbd>/</kbd>) to jump to any lesson, section heading or interview question by name.</li>', fx)
fx = must(r'<li><strong>Your progress\.</strong>.*?</li>', '<li><strong>Your progress.</strong> It is saved in your browser. To carry it to another device, use <em>Export progress</em> on the home page and <em>Import progress</em> on the other device; importing adds to what is there and never overwrites it.</li><li><strong>Review, Interview prep and Playground.</strong> The icons on the left open them. <em>Review</em> brings back the quick checks you missed after 1, 3 and 7 days. <em>Interview prep</em> collects every interview question in the course with a model answer. <em>Playground</em> has a neural network you can train in the browser and the course\'s interactive labs in one place.</li>', fx)
mentions = mentions.replace('later · 4.6', 'later · 14.60')

total = sum(mins.values()); own_total = sum(l['min'] for c in PH for l in own(c))
n_all = len(num); n_own = sum(len(own(c)) for c in PH)
n_cs = sum(1 for c in PH for l in c['lessons'] if l['id'].startswith('cs-')); n_z = sum(1 for c in PH for l in c['lessons'] if l.get('group', '').startswith('From Zero'))

goals = f'''<aside class="co co-goals"><div class="co-label">Lesson goals</div><div class="co-title">What you will be able to do</div><div class="co-body"><ul>
<li>Say what this course covers, from setting up your computer to systems of agents that work in teams</li>
<li>Pick a route through the 17 phases that fits you, and know what you can skip</li>
<li>Read any lesson: what each box means, how the figures and the code work</li>
<li>Study in a way that makes the material stick</li>
</ul></div></aside>
<aside class="co co-prereq"><div class="co-label">Before you start</div><div class="co-body"><ul>
<li><strong>Needs</strong>: nothing. No programming, no math beyond school arithmetic, no AI background.</li>
<li><strong>Depth</strong>: Core, for everyone. <strong>Time</strong>: about 30 minutes. <strong>Next</strong>: {L('a0001')} sets up your computer; if you have never programmed, start with the Python section of {P('ph-00')}.</li>
</ul></div></aside>
<aside class="co co-plain"><div class="co-label">In plain words first</div><div class="co-title">The idea in one line</div><div class="co-body"><p>This course builds AI from the ground up: every idea first written out in small code you can run, then used the way production teams use it, from a first training loop to agents that work in teams.</p></div></aside>
<aside class="co co-why"><div class="co-label">Why this came about</div><div class="co-body"><p>Most AI courses pick one end of the subject. Some start with a working chatbot and never explain what is inside it; others start with calculus and lose people before anything works. This course does both, in order: every idea is built from scratch in small code you can run, the maths is shown with pictures and real numbers, and only then do the lessons reach for the libraries and the production practice that teams use.</p></div></aside>
'''
who = '''<h2>Who this course is for</h2>
<p><strong>Anyone who wants to understand AI properly, from the ground up</strong>: engineers, analysts, data scientists, product people and students. You do not need to know Python, statistics or machine learning before you start. The course teaches each of them, and each lesson names what it assumes, so you can skip what you already know.</p>
<p>By the end you will be able to:</p>
<ul>
<li>explain, with the right technical terms, how a model learns from data, how a neural network is trained, and how a transformer turns text into predictions;</li>
<li>build the core pieces yourself in Python: a training loop, a convolutional network, a tokenizer, attention, a small language model, retrieval and an agent loop;</li>
<li>use the libraries and protocols that production teams use, and evaluate, secure, serve and cost what you build;</li>
<li>design agents and multi-agent systems that hold up outside a demo.</li>
</ul>
'''
parts_txt = {
    'Foundations': 'Tools, the maths you actually need, classic machine learning and the core of deep learning, written out by hand. Everything later stands on these four phases.',
    'Perception': 'How models see, read and listen: convolutional vision, language from tokens to sequence models, and speech. Each modality introduces an idea the rest of the course reuses.',
    'Models': 'Attention and transformers in depth, generative models, reinforcement learning, and finally a small language model built end to end.',
    'Building with LLMs': 'Using large models well: prompting, retrieval, evaluation and serving; models that mix text and images; and the tools and protocols, such as MCP, that connect them to the world.',
    'Agents': 'The agent loop and everything around it: planning, memory, tools, frameworks and production engineering, then autonomous systems and teams of agents.'}
story = '<h2>The story of this course in one page</h2>\n<aside class="co co-why"><div class="co-label">Why this came about</div><div class="co-title">How the parts connect</div><div class="co-body"><p>The five parts follow the history of the field: each one exists because the step before it ran into a limit.</p>\n<ol>\n'
for k, p in enumerate(C):
    phs = p['chapters']
    story += f'<li><strong>Part {k + 1} · {H.escape(p["title"])} (Phases {phs[0]["code"]} to {phs[-1]["code"]}).</strong> {parts_txt[p["title"]]}</li>\n'
story += '</ol></div></aside>\n'
cmap = f'<h2>Course map</h2>\n<p>{n_all} lessons in 17 phases: {n_own} lessons of the course itself, {n_cs} cheat sheets, and {n_z} companion lessons from <em>Zero to Agents</em>, each placed in the phase it supports. Click a phase to open it.</p>\n<div class="cmap">'
for k, p in enumerate(C):
    m = sum(l['min'] for c in p['chapters'] for l in c['lessons'])
    cmap += f'<div class="cmap-part"><div class="cmap-head"><a class="cmap-plabel" href="#{p["chapters"][0]["id"]}">Part {k + 1}</a><span class="cmap-pname">{H.escape(p["title"])}</span><span class="cmap-hrs">{hrs(m)} h</span></div><ol>'
    for c in p['chapters']:
        cmap += f'<li><a href="#{c["id"]}"><span class="num">{c["code"]}</span>{H.escape(c["title"])} · {len(c["lessons"])} lessons</a></li>'
    cmap += '</ol></div>'
cmap += '</div>\n'
table = '<h2>What is covered, and where</h2>\n<div class="tbl"><table>\n<thead>\n<tr>\n<th>Phase</th>\n<th>What it covers</th>\n<th>Lessons</th>\n</tr>\n</thead>\n<tbody>\n'
for c in PH:
    o = own(c); rng = f'{L(o[0]["id"], o[0]["num"])} to {L(o[-1]["id"], o[-1]["num"])}'
    ncs = sum(1 for l in c['lessons'] if l['id'].startswith('cs-')); nz = sum(1 for l in c['lessons'] if l.get('group', '').startswith('From Zero'))
    extra = ([f'{ncs} cheat sheet' + ('s' if ncs > 1 else '')] if ncs else []) + ([f'{nz} companion lesson' + ('s' if nz > 1 else '')] if nz else [])
    table += f'<tr>\n<td>{P(c["id"])}</td>\n<td>{H.escape(c["desc"])}</td>\n<td>{rng}' + (f'<br /><small>plus {" and ".join(extra)}</small>' if extra else '') + '</td>\n</tr>\n'
table += '</tbody>\n</table></div>\n'
py, pym = grange('ph-00', 'Python on-ramp (optional)'); ma, mam = grange('ph-01', 'The math you need, with pictures')
ml, mlm = grange('ph-02', 'Machine learning from zero'); nn, nnm = grange('ph-03', 'Neural networks and deep learning')
ag, agm = grange('ph-14', 'Agents from first principles'); tm, tmm = grange('ph-11', 'Talking to models: APIs, messages, prompts and context')
pr, prm = grange('ph-14', 'Production engineering and AI system design'); rag, ragm = grange('ph-14', 'Retrieval (RAG)'); lg, lgm = grange('ph-14', 'LangChain and LangGraph')
ownp = lambda cids: sum(l['min'] for c in PH if c['id'] in cids for l in own(c))
lead = [x for x in ['l0003', 'l0004', 'l2301', 'l2501', 'l2601', 'l2701', 'l2704', 'l2707', 'l0300', 'l0401', 'l1004', 'l1201', 'l1210'] if x in num]
partC = [c['id'] for p in C[3:] for c in p['chapters']] + ['ph-07', 'ph-10']
paths = f'''<h2>Choose your path</h2>
<p>Nobody needs every lesson in the order printed. Pick the route closest to you. The hours are reading plus running the code at a comfortable pace; doubling them is normal the first time.</p>
<div class="tbl"><table>
<thead>
<tr>
<th>Route</th>
<th>Who it is for</th>
<th>Take these</th>
<th>Roughly</th>
</tr>
</thead>
<tbody>
<tr>
<td>A · Everything, in order</td>
<td>You want to understand the whole field properly</td>
<td>Phases 0 to 16, each phase's own lessons first. Use the cheat sheets for review and the companion sections when you want a gentler or more applied angle.</td>
<td>{hrs(own_total)} hours for the course's own lessons; {hrs(total)} with every section</td>
</tr>
<tr>
<td>B · New to programming and to AI</td>
<td>You have not written code before, or not for a long time</td>
<td>The Python section of Phase 0 ({py}), then the picture-first maths in Phase 1 ({ma}), machine learning from zero in Phase 2 ({ml}) and neural networks in Phase 3 ({nn}). Then continue as route A.</td>
<td>{hrs(pym + mam + mlm + nnm)} hours for this on-ramp, then as route A</td>
</tr>
<tr>
<td>C · You know Python and some machine learning</td>
<td>You want the modern models, then LLMs and agents</td>
<td>Skim Part 1, then {P('ph-07')} and {P('ph-10')}, then Parts 4 and 5.</td>
<td>{hrs(ownp(partC))} hours for those phases' own lessons</td>
</tr>
<tr>
<td>D · Build agents soon</td>
<td>You need something working within weeks and will come back for depth</td>
<td>In Phase 11, the section on talking to models ({tm}); in Phase 14, agents from first principles ({ag}), retrieval ({rag}), and LangChain and LangGraph ({lg}); then {P('ph-13')} and the production section of Phase 14 ({pr}).</td>
<td>{hrs(tmm + agm + ragm + lgm + prm + ownp(['ph-13']))} hours</td>
</tr>
<tr>
<td>E · Leaders and non-coders</td>
<td>You decide, buy or govern AI systems and want to understand them without coding</td>
<td>{", ".join(L(i) for i in lead)}. In each, read the <em>In plain words first</em> boxes, the pictures and the <em>Recap</em>; skip the code.</td>
<td>{hrs(sum(mins[i] for i in lead))} hours</td>
</tr>
</tbody>
</table></div>
<p>Each lesson's <em>Before you start</em> box names the lessons it needs, so you can jump in anywhere and step back when something is unfamiliar.</p>
'''
built = '''<h2>How every lesson is built</h2>
<p>Every lesson of the course follows the same shape, so you always know where you are:</p>
<ul>
<li><strong>Goals and prerequisites.</strong> What you will be able to do, what you need first, and how long it takes.</li>
<li><strong>In plain words first.</strong> The idea in everyday language before any jargon, then <em>Terms you'll hear</em>, which explains the words practitioners use.</li>
<li><strong>The problem and the ideas.</strong> Why the topic exists, then the concepts one at a time, with a formula, a worked example by hand, and a prediction to make before you run anything.</li>
<li><strong>See it drawn.</strong> Real runs on small models and real data, with the exact output and a note on how to read it. Diagrams animate and can be stepped through one part at a time.</li>
<li><strong>Build it, then use it.</strong> The mechanism written from scratch, then the same idea with the libraries teams use.</li>
<li><strong>Practice.</strong> A deliberate mistake to find, how industry does it today, exercises with solutions, practice problems you can check in the browser, and interview questions with model answers.</li>
</ul>
<p>Along the way you will meet these boxes:</p>
<div class="tbl"><table>
<thead>
<tr>
<th>Box</th>
<th>What it is for</th>
</tr>
</thead>
<tbody>
<tr><td>In plain words first</td><td>The idea without jargon, before the details</td></tr>
<tr><td>Terms you'll hear</td><td>The words practitioners use, and what they actually mean</td></tr>
<tr><td>The same idea as a formula</td><td>The maths, gently; you can skip it without losing the thread</td></tr>
<tr><td>Worked example</td><td>The idea computed by hand with real numbers</td></tr>
<tr><td>Check your mental model</td><td>Common misunderstandings, as true-or-false cards with the correction</td></tr>
<tr><td>Predict before you run</td><td>A question to answer before you see the output; the answer is in the Solutions</td></tr>
<tr><td>See it drawn, What you should see, Reading this output</td><td>A real run: the code, its exact output, and what every number in it means</td></tr>
<tr><td>Break it on purpose</td><td>Change one thing so the code fails, and work out why</td></tr>
<tr><td>Industry practice</td><td>How teams do it today, with sources</td></tr>
<tr><td>Practice problem</td><td>Write a function and press <em>Run the checks</em>: real Python runs in your browser and tells you which part is wrong and why</td></tr>
<tr><td>From Zero to Agents</td><td>Companion lessons that cover the basics a lesson builds on</td></tr>
<tr><td>Recap</td><td>The lesson's main points in a few lines</td></tr>
</tbody>
</table></div>
<p><strong>Code.</strong> Every code block in this course has been run, and its output is printed underneath. Examples that would need a large model or a GPU use small models on an ordinary computer, and the lesson says what changes at full scale. Type the code yourself rather than copying it: the typing is where the learning happens.</p>
'''
design = '''<h2>How this course was designed</h2>
<ul>
<li><strong>Build it before you use it.</strong> Each mechanism is written from scratch in a few dozen lines first, so that when a library does it for you, you know what it is doing.</li>
<li><strong>Real runs, not made-up output.</strong> Every figure and every printed number comes from code that was actually run, on small models that fit on a laptop, so you can reproduce it.</li>
<li><strong>Pictures before equations.</strong> Diagrams build themselves step by step, and many lessons have an interactive figure you can drag or slide; the formula comes after the picture.</li>
<li><strong>Practice that checks itself.</strong> Predictions, true-or-false cards, quick checks that come back in Review, exercises with solutions, practice problems checked in the browser, and interview questions with model answers.</li>
<li><strong>The whole field, in order.</strong> The phases run from tooling and maths to agents in production, and the companion lessons add a gentler on-ramp and the applied agent engineering that teams use today.</li>
</ul>
'''
dates = f'''<h2>Dates and trust</h2>
<p>AI tools change monthly. Version-sensitive material carries the date it was checked, and {L('a0001')} sets up the environment the code was run in. When something in a lesson disagrees with a library's official documentation, trust the documentation.</p>
'''
recap = '''<aside class="co co-recap"><div class="co-label">Recap</div><div class="co-title">What to keep from this lesson</div><div class="co-body"><ul>
<li>Five parts, 17 phases: foundations, perception, models, building with LLMs, agents. Each phase has its own lessons, cheat sheets and companion sections.</li>
<li>Pick a route (A to E) and use each lesson's <em>Before you start</em> box to skip what you know.</li>
<li>Each lesson goes: plain words, the ideas with real runs, build it, use it, then practice and interview questions.</li>
<li>Predict before you run, recall instead of rereading, space your study, and use Review for the checks you missed.</li>
</ul></div></aside>
'''
def q(n, text, opts, right, explain):
    o = ''.join(f'<button type="button" class="opt" data-correct="{"true" if k == right else "false"}" id="l0001-q{n}-o{k}"><span class="opt-key">{"ABCD"[k]}</span><span>{x}</span></button>' for k, x in enumerate(opts))
    return f'<div class="q" id="l0001-q{n}"><p class="q-text"><span class="q-num">Q{n}</span>{text}</p><div class="opts">{o}</div><p class="q-explain" hidden>{explain}</p></div>'
quiz = '<section class="quiz" aria-label="Check your understanding"><div class="quiz-head"><h2>Check your understanding</h2><span class="quiz-score" aria-live="polite"></span></div>'
quiz += q(1, 'You know Python well but have never studied machine learning. Which route fits best?', ['Route B, starting with the Python section of Phase 0', 'Route A: start at Phase 0 and skim the Python you already know', 'Route E, reading only', 'Start directly at Phase 14'], 1, 'You still need the foundations of Part 1; you only skip the Python basics.')
quiz += q(2, 'What is the most effective way to use the "What you should see" output under each code block?', ['Read it instead of running the code', 'Predict the output first, then run the code and compare', 'Copy it into your notes', 'Skip it once the code runs without errors'], 1, 'Predicting first turns each example into a small test of your understanding.')
quiz += q(3, 'Where do you find a one-page summary of a topic, with commands and defaults in one place?', ['In the Recap box of every lesson', 'In the Cheat sheets section of the phase', 'On the home page', 'In Interview prep'], 1, 'Each phase has a Cheat sheets section of one-page references.')
quiz += '</section>'
body = head + '<div class="prose">' + goals + who + story + cmap + table + paths + fx + mentions + built + study + design + stack + dates + recap + quiz + '</div>' + foot + tail
assert body.count('<div class="prose">') == 1
open('lessons/l0001.html', 'w', encoding='utf-8').write(body)
print('lesson 0.0 rewritten:', len(a), '->', len(body), 'bytes')
