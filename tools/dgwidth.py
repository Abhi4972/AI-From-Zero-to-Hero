"""List the step-through diagrams whose natural size will shrink their text on the page (wider than ~760px)."""
import re, os, sys
R = os.path.join(os.path.dirname(__file__), "..")
for f in sorted(os.listdir(os.path.join(R, "data", "diagrams"))):
    i = f[:-4]; a = open(os.path.join(R, "lessons", i + ".html"), encoding="utf-8").read()
    m = re.search(r'data-mmd="%s"[^>]*><div class="dg-scroll"><svg[^>]*?viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"' % i, a)
    if not m: print(i, "no rendered diagram found"); continue
    w, h = float(m.group(1)), float(m.group(2))
    if w > 760 or h > 1100 or (len(sys.argv) > 1): print(i, round(w), round(h), "scale %.2f" % min(1, 716 / w))
