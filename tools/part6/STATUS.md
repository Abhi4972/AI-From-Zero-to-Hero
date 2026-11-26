# Part 6 (phases 17-19) status — AI from Scratch site
Site repo: /home/claude/ai-from-zero-to-hero. Upstream repo (sparse, phases 17-19 + interviews, cheatsheets, practice, site/figures): /home/claude/upstream (symlinked at /tmp/claude-0/z2/aiefs/repo).
Build: cd /home/claude/aifs && python3 build_p6.py 17   (or 18 / 19 / none = all). Writes lessons/a17xx..., cs-*, course.json Part 6 "Serving, Safety & Capstones", zxt.json, figs.js modules.
Then in the site: python3 tools/diagrams.py && python3 tools/build.py ; commit; push (git -c push.negotiate=true push -q origin main).
Voice overlays: /home/claude/aifs/voice/<id>.md. Directives: @@top <h2>, @@end <h2>, @@before <h2>, @@mainpy <h2> (runs code/main.py in parts), @@takeaways, @@replace, @@skip, @@code, @@after.
Overlay pattern per lesson: plain (top The problem), math?, worked, check, predict, visual + python run, read (end last Idea); mainpy Use it; read of main.py output + broken + recap (before Ship it); Solutions (end Exercises); takeaways for every h2 + Solutions.
Rules: money in prose not inside $math$; use u^{*} not u^\*; runner skips code containing openai/anthropic/requests./while True etc. (mainpy parts are forced with #!run).
Helpers: rd.py <ppNN> prints a source lesson compactly; heads.txt lists converted h2 headings per lesson.
Done: all of Part 6. Phase 17, 18 and 19 overlays (144 lessons, a1701-a1987) and step-through diagrams (data/diagrams/a17*, a18*, a19*; lessons with upstream Mermaid use that instead).
Runner: lessons are run as a real __main__ module (multiprocessing pickling works), a full main() gets 150 s, local paths are scrubbed from output; lessons that import multiprocessing run with PYTHONPATH=sitefix (torch file_system sharing).
build_p6 splits main.py for @@mainpy at AST top-level definitions, never inside a string.
IMPORTANT: build_p6.py rewrites lesson HTML, which removes the step-through diagrams; always run tools/diagrams.py (all ids) afterwards.
conv.py now keeps the whole first block quote as the one-line idea (it used to cut at 600 characters).
Note: many toy main.py outputs contradict their own captions; read boxes say so honestly.
