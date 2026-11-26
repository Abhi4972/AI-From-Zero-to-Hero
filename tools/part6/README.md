# Part 6 build (phases 17–19)

`build_p6.py` converts phases 17–19 of AI Engineering from Scratch into this site's lesson format (the same converter the five volumes used: `conv.py`, `interviews.py`, `extras.py`, `runner.py`), then applies the course's own additions from `voice/<lesson id>.md`: plain-words boxes, formulas, worked examples, checks, predictions, runs with their output, a deliberate mistake, recap, solutions and per-section takeaways.

It expects the source repository at /home/claude/upstream (sparse checkout of phases 17–19, interviews, cheatsheets, practice, site/figures) and writes into the site. Then run `tools/diagrams.py` and `tools/build.py`.
