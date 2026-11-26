# AI from Scratch

A five-volume course, from a dev environment to multi-agent systems: 724 lessons, about 616 hours with runnable Python in the browser.

```
index.html          landing page (links to all five volumes)
vol1/ … vol5/       one volume each (index.html + figures and images)
shared/pyodide/     Python-in-the-browser runtime, shared by all volumes
shared/katex-fonts/ maths fonts, shared by all volumes
thumbs/             link-preview images (1200×630) for the site and each volume
.nojekyll           tells GitHub Pages to serve the files as they are
```

## Live site

https://abhi4972.github.io/AI-From-Zero-to-Hero/

Served by GitHub Pages from the `main` branch, root folder (Settings → Pages → Deploy from a branch). On a free account a Pages site is public.

## Try it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk will not run the Python cells, because browsers block those file loads.

## Notes

- **Progress** is saved in the visitor's browser (localStorage), separately for each volume. Nothing is sent anywhere.
- **Python** runs with Pyodide 0.26.4. The loader script comes from cdn.jsdelivr.net; the runtime, standard library and numpy are served from `shared/pyodide/`.
- **Links to "Zero to Agents"** point at a private claude.ai artifact. They only open for its owner when signed in to claude.ai.
- Total size is about 130 MB. The largest single file is about 15 MB, well under GitHub's 100 MB per-file limit.
