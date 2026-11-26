"""Run a lesson's Python blocks in order, in one namespace, and record what each prints.
Usage: python runner.py blocks.json out.json   (run inside the foundations venv, in a scratch directory)"""
import sys, json, io, contextlib, signal, traceback, os, re, builtins

SKIP = re.compile(r"\binput\(|requests\.|urlopen|pip install|\.cuda\(|cuda:0|wandb|mlflow|\bfeast\b|\bjax\b|optax|orbax|faiss|"
                  r"from transformers|import transformers|from datasets|import datasets|openai|anthropic|ollama|gradio|streamlit|"
                  r"\.download\(|fetch_openml|load_dataset|while True|time\.sleep\(\s*[3-9]|serve_forever|uvicorn|socket\.", re.I)
os.environ.setdefault("MPLBACKEND", "Agg")
try:
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt; plt.show = lambda *a, **k: None
except Exception:
    pass

class TO(Exception):
    pass

def alarm(sig, frame):
    raise TO()

signal.signal(signal.SIGALRM, alarm)
IN, OUT = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
sys.path.insert(0, os.getcwd())
blocks = json.load(open(IN))
import types
_main = types.ModuleType("__main__"); _main.__file__ = os.path.join(os.getcwd(), "main.py")
sys.modules["__main__"] = _main          # so pickling (multiprocessing spawn) finds functions defined on the page
ns = _main.__dict__
def scrub(t):   # keep this machine's folders out of the published output
    t = re.sub(r"(/home/claude/upstream/phases|/home/claude/aifs/run|/tmp/claude-0/z2/aiefs/repo/phases)/[^/\s]+/[^/\s\"']+", ".", t)
    return re.sub(r"/(home/claude|tmp/claude-0)(/[^\s\"']*)?", "/path/to/project", t)
NB = os.environ.get("AIFS_NB") == "1"        # notebook mode: show the last expression's value, keep the figures
import ast, base64
NBSKIP = re.compile(r"\binput\(|pip install|openai|anthropic|\.download\(|load_dataset|fetch_openml|serve_forever|app\.run\(", re.I)
def nb_exec(code, ns):
    tree = ast.parse(code)
    last = tree.body[-1] if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    if last is not None: tree.body = tree.body[:-1]
    exec(compile(tree, "<lesson>", "exec"), ns)
    if last is None: return
    v = eval(compile(ast.Expression(last.value), "<lesson>", "eval"), ns)
    if v is None: return
    mod = type(v).__module__ or ""
    if mod.startswith("matplotlib") or mod.startswith("seaborn"): return
    if isinstance(v, (list, tuple)) and v and all((type(x).__module__ or "").startswith("matplotlib") for x in v): return
    if isinstance(v, (list, tuple)) and v and (type(v[0]).__module__ or "").startswith("matplotlib"): return
    try:
        import pandas as pd
        if isinstance(v, (pd.DataFrame, pd.Series)):
            with pd.option_context("display.max_rows", 12, "display.max_columns", 10, "display.width", 140):
                print(v.to_string(max_rows=12, max_cols=10) if isinstance(v, pd.DataFrame) else v.to_string(max_rows=12)); return
    except Exception:
        pass
    print(repr(v))
def grab_figs():
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return []
    out = []
    for n in plt.get_fignums()[:4]:
        b = io.BytesIO(); plt.figure(n).savefig(b, format="png", dpi=80, bbox_inches="tight"); out.append(base64.b64encode(b.getvalue()).decode())
    plt.close("all"); return out
res = []
for _bi, code in enumerate(blocks):
    if os.environ.get("AIFS_DEBUG"): print("block", _bi, file=sys.__stderr__, flush=True)
    if (NBSKIP.search(code) if NB else SKIP.search(code)) and not code.startswith("#!run\n"):
        res.append({"status": "skipped"}); continue
    buf = io.StringIO()
    signal.alarm(600 if NB else 150 if code.startswith("#!run\nimport sys as _s") else 25)   # a lesson's full main() gets longer
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            if NB:
                nb_exec(code, ns)
            else:
                exec(compile(code, "<lesson>", "exec"), ns)
        signal.alarm(0)
        r = {"status": "ok", "out": scrub(buf.getvalue())}
        if NB: r["imgs"] = grab_figs()
        res.append(r)
    except TO:
        res.append({"status": "timeout", "out": scrub(buf.getvalue())})
    except SystemExit:
        signal.alarm(0); res.append({"status": "ok", "out": scrub(buf.getvalue())})
    except BaseException as e:
        signal.alarm(0)
        res.append({"status": "error", "out": scrub(buf.getvalue()), "err": f"{type(e).__name__}: {str(e)[:200]}"})
json.dump(res, open(OUT, "w"))
