
(function () {
  const PYO = new URL("shared/pyodide/", location.href).href;          // Pyodide 0.26.4 core files, published beside the page
  let pyReady = null;
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("could not load " + src)); document.head.appendChild(s); }); }
  function getPy(status) {
    if (!pyReady) pyReady = (async () => {
      status("Loading Python in your browser (about 10 MB, once per visit)…");
      await loadScript("https://cdn.jsdelivr.net/npm/pyodide@0.26.4/pyodide.js");
      // archives are published as base64 text (the host serves no .zip or .whl files)
      const b64 = async (names) => {
        const parts = await Promise.all(names.map(async (n) => { const r = await fetch(PYO + n); if (!r.ok) throw new Error(n + " could not be loaded"); return r.text(); }));
        const bin = atob(parts.join("").replace(/\s+/g, "")), out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      };
      const stdlib = URL.createObjectURL(new Blob([await b64(["python_stdlib.zip.b64.txt"])]));
      const py = await loadPyodide({ indexURL: PYO, stdLibURL: stdlib });
      status("Loading numpy…");
      py.unpackArchive(await b64(["numpy.whl.b64.1.txt", "numpy.whl.b64.2.txt"]), "wheel");
      py.FS.mkdirTree("/px"); py.FS.writeFile("/px/practice_check.py", document.getElementById("px-harness").textContent);
      py.runPython("import sys; sys.path.insert(0, '/px')");
      return py;
    })();
    return pyReady;
  }
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  window.PXBind = function (root) {
  root.querySelectorAll(".px").forEach((box) => {
    if (box.dataset.pxb || box.closest(".stub-meta")) return; box.dataset.pxb = "1";
    const files = JSON.parse(box.querySelector(".px-files").textContent), src = box.querySelector(".px-src"), out = box.querySelector(".px-out");
    const key = "px:" + box.dataset.px;
    try { const saved = localStorage.getItem(key); if (saved) src.value = saved; } catch (e) {}
    src.addEventListener("input", () => { try { localStorage.setItem(key, src.value); } catch (e) {} });
    src.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const p = src.selectionStart; src.setRangeText("    ", p, src.selectionEnd, "end"); } });
    box.querySelector(".px-reset").onclick = () => { src.value = files["starter.py"]; try { localStorage.removeItem(key); } catch (e) {} out.innerHTML = ""; };
    box.querySelector(".px-run").onclick = async () => {
      const status = (t) => (out.innerHTML = '<p class="px-sum">' + esc(t) + "</p>");
      try {
        const py = await getPy(status);
        status("Running the checks…");
        const dir = "/px/" + box.dataset.px; py.FS.mkdirTree(dir);
        py.FS.writeFile(dir + "/tests.py", files["tests.py"]);
        if (files["support.py"]) py.FS.writeFile(dir + "/support.py", files["support.py"]);
        py.globals.set("SRC", src.value); py.globals.set("FIX", files["fixtures.json"]); py.globals.set("DIR", dir);
        const res = JSON.parse(py.runPython("import sys, practice_check as pc\nif DIR not in sys.path: sys.path.insert(0, DIR)\npc.use_problem_dir(DIR)\npc.evaluate_json(SRC, DIR + '/tests.py', FIX)"));
        const s = res.summary;
        let h = '<p class="px-sum ' + (s.ok ? "ok" : "bad") + '">' + (s.ok ? "All " + s.total + " checks pass." : s.passed + " of " + s.total + " checks pass.") + "</p><ul class=\"px-res\">";
        for (const r of res.results) {
          h += '<li class="' + r.status + '"><span class="px-layer">' + esc(r.layer) + "</span>" + esc(r.name);
          if (r.status !== "pass") h += '<div class="px-msg">' + esc(r.message) + (r.expected ? " Expected " + esc(r.expected) + ", got " + esc(r.actual) + "." : "") + '</div><div class="px-why">' + esc(r.explain) + "</div>";
          h += "</li>";
        }
        out.innerHTML = h + "</ul>" + (res.stdout ? "<pre>" + esc(res.stdout) + "</pre>" : "");
        if (s.ok) { const sol = box.querySelector(".px-sol"); sol.hidden = false; }
      } catch (e) { out.innerHTML = '<p class="px-sum bad">Python could not start here: ' + esc(e.message) + ". You can still copy the code and run it on your computer.</p>"; }
    };
  });
  root.querySelectorAll(".cs-code .cs-copy").forEach((b) => { if (b.dataset.pxb) return; b.dataset.pxb = "1"; b.addEventListener("click", () => {
    const done = () => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); };
    try { navigator.clipboard.writeText(b.dataset.copy).then(done, () => {}); } catch (e) {}
  }); });
  };
  window.PXBind(document);
})();
