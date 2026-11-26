# AI from Scratch

A free, hands-on course from a dev environment and a little linear algebra to agents that plan, use tools and work in teams: **787 lessons in 17 phases**, with runnable Python, maths, interactive figures, quick checks, interview questions and a review queue, all in the browser.

**Open the course:** https://abhi4972.github.io/AI-From-Zero-to-Hero/

Everything is on one site: one menu for all 17 phases, one search across every lesson, one progress tracker. No account and no install are needed.

## What's inside

| Part | Phases | Lessons |
|---|---|---|
| 1 · Foundations | 0 Setup & Tooling · 1 Math Foundations · 2 ML Fundamentals · 3 Deep Learning Core | 130 |
| 2 · Perception | 4 Computer Vision · 5 NLP · 6 Speech & Audio | 126 |
| 3 · Models | 7 Transformers · 8 Generative AI · 9 Reinforcement Learning · 10 LLMs from Scratch | 127 |
| 4 · Building with LLMs | 11 LLM Engineering · 12 Multimodal AI · 13 Tools & Protocols | 145 |
| 5 · Agents | 14 Agent Engineering · 15 Autonomous Systems · 16 Multi-Agent & Swarms | 259 |

Lessons marked **From Zero to Agents** are companion lessons on the same topics, included in full.

## Using it

- **Progress** is saved in your browser. To move it to another device, use **Export progress** on the home page, then **Import progress** on the other device. Import merges, it never overwrites.
- **Python** runs in the page (Pyodide). The first run downloads about 10 MB; after that your browser usually has it cached.
- **Guided or Scroll**: show a lesson one step at a time, or as one page.
- Press **⌘K** / **Ctrl+K** (or `/`) to jump to any lesson, section or interview question.

## How the site is built

```
index.html          the app: menu, home, search, interview prep, review, playground, and a small summary of every lesson
lessons/<id>.html   each full lesson, loaded when you open it
search/p1..p5.json  lesson text for search, one file per part, fetched on your first search
meta/th-<phase>.json  thumbnails for the phase pages
img/ figs/ repo-assets/ src/   images and data used by lessons
shared/             Python runtime (Pyodide 0.26.4) and maths fonts
thumbs/             link-preview images
vol1/ … vol5/       old links from the five-volume version, redirected here
tools/build.py      builds this site from the five volume pages (kept on the five-volumes branch)
```

The earlier five-volume version is kept on the [`five-volumes`](https://github.com/Abhi4972/AI-From-Zero-to-Hero/tree/five-volumes) branch.

Served by GitHub Pages from `main`, root folder.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk will not work, because browsers block loading the lesson files that way.

## Credits

Lessons adapted from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch) by Rohit Ghumare (MIT licence), with worked examples, exercises and takeaways added for this course.
