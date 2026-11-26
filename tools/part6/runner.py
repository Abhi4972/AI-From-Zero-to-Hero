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
IN, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.getcwd())
blocks = json.load(open(IN))
ns = {"__name__": "__main__", "__file__": os.path.join(os.getcwd(), "main.py")}
def scrub(t):   # keep this machine's folders out of the published output
    t = re.sub(r"(/home/claude/upstream/phases|/home/claude/aifs/run|/tmp/claude-0/z2/aiefs/repo/phases)/[^/\s]+/[^/\s\"']+", ".", t)
    return re.sub(r"/(home/claude|tmp/claude-0)(/[^\s\"']*)?", "/path/to/project", t)
res = []
for code in blocks:
    if SKIP.search(code) and not code.startswith("#!run\n"):
        res.append({"status": "skipped"}); continue
    buf = io.StringIO()
    signal.alarm(25)
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            exec(compile(code, "<lesson>", "exec"), ns)
        signal.alarm(0)
        res.append({"status": "ok", "out": scrub(buf.getvalue())})
    except TO:
        res.append({"status": "timeout", "out": scrub(buf.getvalue())})
    except SystemExit:
        signal.alarm(0); res.append({"status": "ok", "out": scrub(buf.getvalue())})
    except BaseException as e:
        signal.alarm(0)
        res.append({"status": "error", "out": scrub(buf.getvalue()), "err": f"{type(e).__name__}: {str(e)[:200]}"})
json.dump(res, open(OUT, "w"))
