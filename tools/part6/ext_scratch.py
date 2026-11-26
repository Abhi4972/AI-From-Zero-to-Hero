"""Phase 23: build-from-scratch projects: karpathy/micrograd, minbpe, nanoGPT (MIT) and rasbt/LLMs-from-scratch ch02-ch05 (Apache-2.0)."""
import pathlib, re, shutil, json
import conv
from ext import EXT, WORK, nb_cells, clean_md, clean_code, credit, fence, copy_tree, lesson_ref

def _files(root, names, label_fn):
    out = []
    for n in names:
        p = root / n
        out.append(f"??? code | {label_fn(n)}: `{n}` ({len(p.read_text().splitlines())} lines)\n" + fence("pyshow", p.read_text().rstrip()) + "\n???")
    return "\n\n".join(out)

def _auto_steps(nb, base_url, skip_heads=(), drop_code=(), fixes=(), max_md=420):
    """Split a notebook into steps at its '## N.N' headings; keep code and the short explanations between it."""
    steps, cur, k = [], None, -1
    for typ, s, _ in nb_cells(nb):
        if typ == "markdown":
            m = re.search(r"^##\s+(\d+\.\d+\s+.+)$", s, re.M)
            if m:
                title = re.sub(r"^\d+\.\d+\s+", "", m.group(1)).strip()
                if any(h.lower() in title.lower() for h in skip_heads): cur = None; continue
                cur = [title, []]; steps.append(cur); s = s[m.end():]
            if cur is None: continue
            s = re.sub(r"^#{1,6}\s.*$", lambda mm: "**" + mm.group(0).lstrip("#").strip() + "**", s, flags=re.M)
            t = clean_md(s, base_url)
            if not t or "<img" in s and len(t) < 40: continue
            if len(t) > max_md:                                  # long passages: keep the first two sentences
                t = " ".join(re.split(r"(?<=[.!?])\s+", t)[:2])
            cur[1].append(t)
        else:
            k += 1
            if cur is None or k in drop_code: continue
            code = clean_code(s, fixes)
            code = "\n".join(l for l in code.split("\n") if not re.search(r"importlib\.metadata|from importlib\.metadata import version|version\(\"|__version__", l)).strip()
            if "model_and_optimizer" in code: continue      # a second full copy of model and optimizer state; too big for the build machine
            if code: cur[1].append(fence("python", code))
    return steps

def page(meta, steps_md, files_md="", run_md="", extra_top=""):
    L = [":::goals What you will be able to do\n" + "\n".join("- " + g for g in meta["goals"]) + "\n:::"]
    rel = "; ".join(lesson_ref(i) for i in meta["lessons"])
    L.append(":::prereq Before you start\n" + "\n".join([
        f"- **Needs**: {rel}", f"- **Type**: Project (build from scratch). **Time**: about {meta['minutes']} minutes.",
        f"- **Code in**: Python ({meta['libs']}). **Runs**: on a laptop CPU; every output below is from a real run here.",
        "- **Source**: " + meta["credit"]]) + "\n:::")
    L.append(":::plain The idea in one line\n" + meta["plain"] + "\n:::")
    L.append("## The problem\n\n" + meta["problem"] + (("\n\n" + extra_top) if extra_top else ""))
    for n, (t, body) in enumerate(steps_md, 1):
        L.append(f"## Step {n} · {t}\n\n" + "\n\n".join(body))
    if files_md: L.append("## Read the code\n\n" + files_md)
    if run_md: L.append("## Run it on your machine\n\n" + run_md)
    L.append("## Exercises\n\n" + "\n".join(f"{i}. {e}" for i, e in enumerate(meta["exercises"], 1)))
    L.append(":::recap What to keep\n" + "\n".join("- " + r for r in meta["recap"]) + "\n:::")
    L.append(":::checked Sources and further reading\n" + "\n".join("- " + s for s in meta["sources"]) + "\n:::")
    return "\n\n".join(L)

def micrograd():
    R = EXT / "karpathy_micrograd"; wd = WORK / "scratch" / "micrograd"; copy_tree(R, wd / "code")
    meta = dict(title="micrograd: a Tiny Autograd Engine and Neural Net Library", minutes=60, lessons=["a0303", "a0105"], libs="pure Python, scikit-learn for the data",
        goals=["Read a complete reverse-mode autograd engine in under 100 lines", "Build neurons, layers and an MLP on top of scalar `Value`s", "Train a classifier on the two-moons dataset with SVM max-margin loss"],
        plain="Every number remembers how it was made, so calling `backward()` on the loss walks that history in reverse and fills in every gradient.",
        problem="Deep learning frameworks hide automatic differentiation behind tensors and GPUs. micrograd strips it to the core: a `Value` object wraps one number, records the operation that produced it, and knows how to push gradients to its inputs. A topological sort of the graph and the chain rule do the rest. On top sits a small PyTorch-like neural network library, enough to train a binary classifier.",
        credit=credit("karpathy/micrograd", "MIT", "https://github.com/karpathy/micrograd"),
        exercises=["Add `tanh` and `exp` operations to `Value` with their backward functions, and check the gradients against a finite-difference estimate.",
                   "Replace the SVM max-margin loss with binary cross-entropy (via a sigmoid) and compare the decision boundary.",
                   "Count how many `Value` nodes one forward pass of the MLP creates. Why does this approach not scale to real networks?"],
        recap=["Reverse-mode autodiff = record the graph forward, apply the chain rule backward in topological order.", "Gradients accumulate (`+=`) because a value can feed several operations.", "A neural net library is layers of the same scalar operations."],
        sources=["[karpathy/micrograd](https://github.com/karpathy/micrograd), MIT licence", "[The spelled-out intro to neural networks and backpropagation](https://www.youtube.com/watch?v=VMj-3S1tku0) (video lecture building micrograd)"])
    steps = [("The engine: a scalar `Value` with gradients", ["Here is the whole engine; read it once before running anything. Each operation returns a new `Value` whose `_backward` closure knows the local derivative.",
              "```python\nfrom micrograd.engine import Value\n\na = Value(-4.0)\nb = Value(2.0)\nc = a + b\nd = a * b + b**3\nc += c + 1\nc += 1 + c + (-a)\nd += d * 2 + (b + a).relu()\nd += 3 * d + (b - a).relu()\ne = c - d\nf = e**2\ng = f / 2.0\ng += 10.0 / f\nprint(f'{g.data:.4f}')  # the forward pass\ng.backward()\nprint(f'{a.grad:.4f}')  # dg/da\nprint(f'{b.grad:.4f}')  # dg/db\n```"])]
    # demo notebook: the moons classifier
    body, k = [], -1
    for typ, s, _ in nb_cells(R / "demo.ipynb"):
        if typ == "code":
            k += 1
            code = clean_code(s, [(r"^np\.random\.seed\(1337\)\nrandom\.seed\(1337\)", "np.random.seed(1337)\nrandom.seed(1337)")])
            if code and "%matplotlib" not in code: body.append(fence("python", code))
        else:
            t = clean_md(s)
            if t: body.append(t)
    steps.append(("Train an MLP on two moons", ["The demo builds a 2-16-16-1 network, uses an SVM max-margin loss with L2 regularisation, and trains with plain SGD whose learning rate decays over 100 steps."] + body))
    files = _files(R / "micrograd", ["engine.py", "nn.py"], lambda n: {"engine.py": "The autograd engine", "nn.py": "Neuron, Layer and MLP"}[n])
    run = fence("bash", "git clone https://github.com/karpathy/micrograd\ncd micrograd\npip install -e .\npython -m pytest   # checks gradients against PyTorch (needs torch)")
    return meta, page(meta, steps, files, run), wd

def minbpe():
    R = EXT / "karpathy_minbpe"; wd = WORK / "scratch" / "minbpe"; copy_tree(R, wd / "code")
    meta = dict(title="minbpe: Byte Pair Encoding Tokenizers, from Basic to GPT-4 Style", minutes=75, lessons=["a1002", "a0519"], libs="pure Python, regex, tiktoken for the check",
        goals=["Implement byte-level BPE training, encoding and decoding", "Add a regex pre-split the way GPT-2 and GPT-4 do", "Check a from-scratch tokenizer against tiktoken's GPT-4 encoding"],
        plain="Start from raw bytes, repeatedly merge the most frequent adjacent pair into a new token, and keep the list of merges: that list is the tokenizer.",
        problem="Every LLM reads tokens, not characters. Byte Pair Encoding learns its vocabulary from data: it starts with the 256 possible bytes and merges frequent pairs until it reaches the vocabulary size you ask for. minbpe implements the algorithm three ways: a basic version, one that first splits text with a regex as GPT-2/GPT-4 do, and one that loads GPT-4's real merges so its output matches tiktoken exactly.",
        credit=credit("karpathy/minbpe", "MIT", "https://github.com/karpathy/minbpe"),
        exercises=["Train with vocabulary sizes 300, 512 and 1024 and plot compression ratio (bytes per token) against vocabulary size.",
                   "Add special tokens such as `<|endoftext|>` to the RegexTokenizer and make sure they are never split.",
                   "Encode the same paragraph with your 512-token tokenizer and with GPT-4's. Why does GPT-4 need far fewer tokens?"],
        recap=["BPE learns merges from data, starting from 256 bytes.", "A regex pre-split stops merges across word and number boundaries.", "Matching a reference tokenizer token for token is the real test."],
        sources=["[karpathy/minbpe](https://github.com/karpathy/minbpe), MIT licence", "[Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE) (video lecture)", "[lecture.md](https://github.com/karpathy/minbpe/blob/master/lecture.md) in the repo"])
    steps = [
        ("Train the basic tokenizer", ["The training text is the Wikipedia article on Taylor Swift that ships with the repo (about 185 KB). Training finds 256 merges to reach a 512-token vocabulary.",
         fence("python", "from minbpe import BasicTokenizer, RegexTokenizer\nimport time\ntext = open('tests/taylorswift.txt', encoding='utf-8').read()\n\nbasic = BasicTokenizer()\nt0 = time.time()\nbasic.train(text, 512)\nprint(f'trained in {time.time() - t0:.1f} s')\nids = basic.encode(text)\nprint(len(text.encode('utf-8')), 'bytes ->', len(ids), 'tokens')\nprint('round trip ok:', basic.decode(ids) == text)")]),
        ("Look at what it learned", ["Each merge joins two existing tokens. The first merges are the most common byte pairs in English text.",
         fence("python", "for (a, b), idx in list(basic.merges.items())[:12]:\n    print(idx, repr(basic.vocab[a].decode('utf-8', 'replace')), '+', repr(basic.vocab[b].decode('utf-8', 'replace')), '->', repr(basic.vocab[idx].decode('utf-8', 'replace')))")]),
        ("Split with a regex first, as GPT-4 does", ["The regex splits text into words, numbers, punctuation and spaces before merging, so no token spans two words.",
         fence("python", "rt = RegexTokenizer()\nrt.train(text, 512)\nprint(len(rt.encode(text)), 'tokens with the regex split')\nprint([rt.decode([i]) for i in rt.encode('Hello world, 2024!')])")]),
        ("Match GPT-4 token for token", ["`GPT4Tokenizer` loads GPT-4's merges from tiktoken and reproduces its byte shuffle, so the two encodings must be identical.",
         fence("python", "import tiktoken\nfrom minbpe import GPT4Tokenizer\ngpt4 = GPT4Tokenizer()\nenc = tiktoken.get_encoding('cl100k_base')\nsample = text[:2000]\nprint(gpt4.encode(sample) == enc.encode(sample))\nprint(len(gpt4.encode(sample)), 'GPT-4 tokens for the first 2,000 characters')")]),
    ]
    files = _files(R / "minbpe", ["base.py", "basic.py", "regex.py", "gpt4.py"], lambda n: {"base.py": "Shared helpers, save and load", "basic.py": "Byte-level BPE", "regex.py": "BPE with a regex pre-split", "gpt4.py": "GPT-4's merges, loaded from tiktoken"}[n])
    run = fence("bash", "git clone https://github.com/karpathy/minbpe\ncd minbpe\npip install regex tiktoken\npython train.py      # trains both tokenizers and saves them to models/\npython -m pytest tests")
    return meta, page(meta, steps, files, run), wd

def nanogpt():
    R = EXT / "karpathy_nanoGPT"; wd = WORK / "scratch" / "nanogpt"; copy_tree(R, wd / "code")
    meta = dict(title="nanoGPT: Training a Character-Level GPT on Shakespeare", minutes=60, lessons=["a1004", "a0714"], libs="PyTorch, NumPy",
        goals=["Prepare a character-level dataset as token-id binaries", "Train a small GPT on CPU with nanoGPT's training script", "Sample text from the checkpoint and read the loss curve"],
        plain="A 0.8-million-parameter transformer reads Shakespeare one character at a time and learns to write text that looks like it.",
        problem="nanoGPT is the smallest faithful GPT-2 training codebase: about 300 lines of model and 300 of training loop. The same code trains GPT-2 124M on many GPUs; here it trains a tiny model on the 1 MB Tiny Shakespeare text on a laptop CPU, with the settings the README recommends for CPUs, shortened to 2,000 iterations.",
        credit=credit("karpathy/nanoGPT", "MIT", "https://github.com/karpathy/nanoGPT"),
        exercises=["Train for 5,000 iterations instead of 2,000. How far does the validation loss fall, and do the samples improve?",
                   "Double `n_embd` to 256. Compare parameters, time per iteration and final loss.",
                   "Switch to the GPT-2 BPE tokenizer (`data/shakespeare/prepare.py`). Why does the loss number change meaning?"],
        recap=["A GPT is a stack of attention and MLP blocks trained to predict the next token.", "Watch validation loss, not training loss, to judge generalisation.", "The same code scales from a laptop toy to GPT-2 by changing the config."],
        sources=["[karpathy/nanoGPT](https://github.com/karpathy/nanoGPT), MIT licence", "[Let's build GPT: from scratch, in code, spelled out](https://www.youtube.com/watch?v=kCc8FmEb1nY) (video lecture)", "[Tiny Shakespeare](https://github.com/karpathy/char-rnn) dataset"])
    cmd = ("python train.py config/train_shakespeare_char.py --device=cpu --compile=False --eval_iters=20 --log_interval=200 "
           "--block_size=64 --batch_size=12 --n_layer=4 --n_head=4 --n_embd=128 --max_iters=2000 --lr_decay_iters=2000 --dropout=0.0")
    sh = lambda c: f"import subprocess, sys\nr = subprocess.run([sys.executable] + {c.split(' ', 1)[1]!r}.split(), capture_output=True, text=True)\nprint(r.stdout[-3000:] or r.stderr[-2000:])"
    steps = [
        ("Prepare the dataset", ["`prepare.py` downloads Tiny Shakespeare, maps its 65 characters to ids and writes `train.bin` and `val.bin`. The cell runs the script exactly as you would in a terminal.",
         fence("python", sh("python data/shakespeare_char/prepare.py"))]),
        ("Train on the CPU", ["These are the README's CPU settings: 4 layers, 4 heads, 128-dimensional embeddings and a 64-character context. Training takes about a minute and a half here.",
         fence("python", sh(cmd))]),
        ("Sample from the model", ["`sample.py` loads the checkpoint and generates text one character at a time.",
         fence("python", sh("python sample.py --out_dir=out-shakespeare-char --device=cpu --num_samples=2 --max_new_tokens=400"))]),
    ]
    files = _files(R, ["model.py"], lambda n: "The GPT model: attention, MLP, blocks and generate()")
    run = fence("bash", "git clone https://github.com/karpathy/nanoGPT\ncd nanoGPT\npip install torch numpy transformers datasets tiktoken wandb tqdm\npython data/shakespeare_char/prepare.py\n" + cmd + "\npython sample.py --out_dir=out-shakespeare-char --device=cpu")
    return meta, page(meta, steps, files, run), wd

RASBT = [
    ("ch02", "LLMs from Scratch, Part 1: Tokenizing Text and Building a Sliding-Window Data Loader", ["a1002", "a1003"],
     "Turn a short story into token ids with a simple tokenizer and with GPT-2's BPE, then cut it into input-target pairs for next-token prediction.",
     "An LLM trains on pairs of 'these tokens' and 'the same tokens shifted by one'. Getting there takes a tokenizer, a vocabulary, special tokens and a data loader that slides a window over the text. The training text is Edith Wharton's short story 'The Verdict' (public domain).",
     ["Write a regex tokenizer and a vocabulary by hand", "Use GPT-2's BPE through tiktoken", "Build a PyTorch Dataset and DataLoader of input-target windows, then token and position embeddings"],
     ["Change `max_length` and `stride` and print the first batch. What happens to overlap between windows when stride is smaller than max_length?",
      "Encode an invented word with GPT-2's tokenizer and print the pieces. How does BPE handle words it has never seen?",
      "Why does the embedding layer's output shape not depend on the vocabulary size?"],
     ["Text becomes ids through a tokenizer and a vocabulary.", "BPE handles unknown words by splitting them into known pieces.", "Training pairs are windows of tokens and the same windows shifted by one."]),
    ("ch03", "LLMs from Scratch, Part 2: Self-Attention, Causal Masking and Multi-Head Attention", ["a0702", "a0703"],
     "Compute attention by hand on a six-word sentence, then wrap it into trainable, causal, multi-head attention modules.",
     "Attention lets each token build its representation from the tokens that matter to it. The chapter grows the mechanism one piece at a time: plain dot-product weights, trainable query/key/value projections, a causal mask so tokens cannot see the future, dropout, and finally several heads in parallel.",
     ["Compute attention scores, weights and context vectors step by step", "Implement self-attention with trainable weights as a PyTorch module", "Add a causal mask and build efficient multi-head attention"],
     ["Print the attention weights of the causal version for the six-word sentence. Which tokens does the last word attend to most?",
      "Replace the scaling by `sqrt(d_k)` with no scaling and look at the softmax outputs. Why does scaling matter for larger dimensions?",
      "Change `num_heads` from 2 to 4 with the same `d_out`. What is `head_dim`, and how does the parameter count change?"],
     ["Attention weights are a softmax over scaled query-key dot products.", "A causal mask blocks attention to future tokens.", "Multi-head attention splits the projection into heads that attend in parallel."]),
    ("ch04", "LLMs from Scratch, Part 3: Assembling a GPT Model", ["a0714", "a0707"],
     "Put layer norm, GELU feed-forward layers, shortcut connections and attention into a transformer block, stack twelve of them, and generate text with the untrained model.",
     "A GPT model is attention plus a few supporting parts repeated many times. This chapter builds each supporting part, shows why it is there (stable activations, non-linearity, gradient flow), and assembles the 124-million-parameter GPT-2 architecture.",
     ["Implement layer normalization and the GELU activation", "Build a transformer block with shortcut connections", "Assemble GPT-2 124M, count its parameters and generate tokens greedily"],
     ["Print the parameter count with and without weight tying between the token embedding and output layer.",
      "Remove the shortcut connections and compare gradient magnitudes in the first layers.",
      "Build the 'GPT-2 medium' configuration (24 layers, 1024 dimensions, 16 heads). How many parameters does it have?"],
     ["Layer norm keeps activations in a stable range.", "Shortcut connections keep gradients flowing through deep stacks.", "An untrained GPT generates noise; the architecture alone is not the model."]),
    ("ch05", "LLMs from Scratch, Part 4: Pretraining a Small GPT and Decoding Strategies", ["a1004", "a0716"],
     "Train the GPT from Part 3 on a short story, watch training and validation loss, then control its output with temperature and top-k sampling.",
     "Pretraining is next-token prediction at scale. Here the scale is tiny (one short story, ten epochs on a CPU), which is enough to see the training loop, the gap between training and validation loss that signals overfitting, and how decoding settings change the text.",
     ["Compute cross-entropy loss and perplexity for next-token prediction", "Write a training loop with periodic evaluation and sample generation", "Use temperature scaling and top-k sampling, then save and reload model weights"],
     ["Train for 20 epochs instead of 10. What happens to the gap between training and validation loss, and why?",
      "Generate with temperature 0.1, 1 and 5. Describe each result in a sentence.",
      "Load GPT-2's pretrained weights (section 5.5 of the original) and compare its text with your model's. What does that say about data scale?"],
     ["Loss is cross-entropy on the next token; perplexity is its exponential.", "A widening train-validation gap means overfitting.", "Temperature and top-k trade coherence for variety."]),
]

def rasbt(ch, title, rel, plain, problem, goals, exercises, recap):
    R = EXT / "rasbt_LLMs-from-scratch" / ch / "01_main-chapter-code"; wd = WORK / "scratch" / f"rasbt-{ch}"; copy_tree(R, wd / "code")
    base = f"https://github.com/rasbt/LLMs-from-scratch/blob/main/{ch}/01_main-chapter-code/"
    meta = dict(title=title, minutes=90, lessons=rel, libs="PyTorch, tiktoken", goals=goals, plain=plain, problem=problem, exercises=exercises, recap=recap,
                credit=credit("rasbt/LLMs-from-scratch", "Apache-2.0", base + f"{ch}.ipynb", ", the code for Sebastian Raschka's book *Build a Large Language Model (From Scratch)*"),
                sources=[f"[{ch}.ipynb]({base}{ch}.ipynb) in rasbt/LLMs-from-scratch, Apache-2.0 licence", "Sebastian Raschka, *Build a Large Language Model (From Scratch)*, Manning, 2024"])
    skip = ("Loading pretrained weights",) if ch == "ch05" else ()
    st = _auto_steps(R / f"{ch}.ipynb", base, skip_heads=skip, fixes=[(r"^\s*num_epochs = 10\b", "num_epochs = 10")])
    st = [(t, b) for t, b in st if any(x.startswith("```python") for x in b)]
    note = ("Section 5.5 of the original loads OpenAI's GPT-2 weights (a 500 MB download that needs TensorFlow); it is left out here." if ch == "ch05" else "")
    return meta, page(meta, st, "", fence("bash", f"git clone https://github.com/rasbt/LLMs-from-scratch\ncd LLMs-from-scratch/{ch}/01_main-chapter-code\npip install torch tiktoken matplotlib jupyterlab\njupyter lab {ch}.ipynb"), note), wd

def lessons(pno, store):
    out, n = [], 0
    items = [micrograd(), minbpe(), nanogpt()] + [rasbt(*r) for r in RASBT]
    groups = ["Neural networks", "Tokenizers", "Language models"] + ["LLMs from scratch"] * 4
    for (meta, src, wd), g in zip(items, groups):
        n += 1
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        body = conv.body_fixer(wd, f"{pno}.{n}", lstore)(src)
        out.append({"title": meta["title"], "minutes": meta["minutes"], "type": "Project", "num": f"{pno}.{n}", "src": body,
                    "key": f"ext/scratch/{wd.name}", "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(wd), "phase": "ext/scratch",
                    "group": g, "nb": True, "heavy": g == "LLMs from scratch"})
    return out
