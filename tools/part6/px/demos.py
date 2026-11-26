"""Run every ready project's demo command in a scratch copy and record its output (cache: px/demos.json)."""
import json, glob, os, shutil, subprocess, tempfile, pathlib, sys, concurrent.futures as cf
SRC = pathlib.Path("/home/claude/upstream/projects"); OUT = pathlib.Path("/home/claude/aifs/px/demos.json")
done = json.loads(OUT.read_text()) if OUT.exists() else {}
only = sys.argv[1:]
def run(pid):
    j = json.loads((SRC / pid / "project.json").read_text()); d = j.get("demo") or {}
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="pxd-")) / pid
    shutil.copytree(SRC / pid, tmp, ignore=shutil.ignore_patterns("media", "*.gif"))
    cwd = tmp / d.get("cwd", "solution")
    cmd = d.get("command", [])
    env = {**os.environ, "NO_COLOR": "1", "GOFLAGS": "-mod=mod", "GOTOOLCHAIN": "local", "PYTHONDONTWRITEBYTECODE": "1"}
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=240, env=env)
        out = (r.stdout + ("\n" + r.stderr if r.stderr.strip() and r.returncode else "")).replace(str(tmp), "<project>")
        res = {"cmd": cmd, "code": r.returncode, "out": out[-20000:]}
    except subprocess.TimeoutExpired as e:
        res = {"cmd": cmd, "code": "timeout", "out": ""}
    shutil.rmtree(tmp.parent, ignore_errors=True)
    return pid, res
ids = [p.parent.name for p in sorted(SRC.glob("*/project.json")) if json.loads(p.read_text()).get("status") == "ready"]
todo = [i for i in ids if (only and i in only) or (not only and i not in done)]
with cf.ThreadPoolExecutor(4) as ex:
    for pid, res in ex.map(run, todo):
        done[pid] = res; print(pid, res["code"], len(res["out"]), flush=True)
OUT.write_text(json.dumps(done, indent=1))
bad = {k: v["code"] for k, v in done.items() if v["code"] != 0}
print("ran", len(done), "nonzero", bad)
