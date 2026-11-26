"""Write voice overlays for the interview case files from compact entries: python3 px/scen.py <entries.py>"""
import sys, runpy, pathlib
V = pathlib.Path("/home/claude/aifs/voice")
E = runpy.run_path(sys.argv[1])["E"]
HEADS = ["The situation", "The evidence", "Questions to answer first", "Walkthrough", "What actually happened", "Wrong turns", "The lesson to carry"]
for lid, e in E.items():
    checks = []
    for item in e["check"]:
        mark, text = item[0], item[1]
        checks.append(f"- {mark} {text}" + (f"\n  {item[2]}" if len(item) > 2 else ""))
    tk = e["tk"]
    out = (f"@@top The situation\n:::plain In plain words first\n{e['plain'].strip()}\n:::\n@@\n\n"
           f"@@before Walkthrough\n:::check\nWhich statements are right?\n\n" + "\n".join(checks) + "\n:::\n@@\n\n"
           f"@@end The lesson to carry\n:::recap What to keep from this case\n" + "\n".join("- " + r for r in e["recap"]) + "\n:::\n@@\n\n"
           "@@takeaways\n" + "\n".join(f"{h} | {t}" for h, t in zip(HEADS, tk)) + "\n@@\n")
    (V / f"{lid}.md").write_text(out)
print("wrote", len(E))
