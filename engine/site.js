/* One site now: fold the progress each volume kept separately (vol1: ... vol5:) into the shared keys, once. */
(function () { try {
  var ls = window.localStorage; if (!ls || ls.getItem("site-merged-v1")) return;
  var J = function (k) { try { return JSON.parse(ls.getItem(k) || "null"); } catch (e) { return null; } };
  for (var v = 1; v <= 5; v++) {
    var pre = "vol" + v + ":";
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i); if (!k || k.indexOf(pre) !== 0) continue;
      var base = k.slice(pre.length), val = ls.getItem(k), cur = ls.getItem(base);
      if (base === "ai-from-scratch-progress-v1") {
        var A = J(base) || { d: {}, q: {}, tasks: {}, last: "", path: "all", t: 0 }, B = J(k) || {};
        ["d", "q"].forEach(function (f) { A[f] = A[f] || {}; var src = B[f] || {}; for (var id in src) { var r = src[id], o = A[f][id]; if (!o || (r && o && (r[1] || 0) > (o[1] || 0)) || (f === "q")) A[f][id] = r; } });
        A.tasks = A.tasks || {}; for (var t in (B.tasks || {})) A.tasks[t] = true;
        if ((B.t || 0) > (A.t || 0)) { A.t = B.t; if (B.last) A.last = B.last; }
        ls.setItem(base, JSON.stringify(A));
      } else if (base === "zero-to-agents-review-v1") {
        var R = J(base) || { q: {}, learned: 0 }, Q = J(k) || {}; R.q = R.q || {};
        for (var id2 in (Q.q || {})) if (!R.q[id2]) R.q[id2] = Q.q[id2];
        R.learned = (R.learned || 0) + (Q.learned || 0); ls.setItem(base, JSON.stringify(R));
      } else if (base === "zero-to-agents-predictions-v1" || base === "zx-pos") {
        var P = J(base) || {}, N = J(k) || {}; for (var x in N) if (!(x in P)) P[x] = N[x]; ls.setItem(base, JSON.stringify(P));
      } else if (cur === null) ls.setItem(base, val);
    }
  }
  ls.setItem("site-merged-v1", "1");
} catch (e) {} })();
/* Export / import: one small JSON file with everything this browser remembers about the course. */
window.ZXfer = (function () {
  var KEYS = ["ai-from-scratch-progress-v1", "zero-to-agents-review-v1", "zero-to-agents-predictions-v1", "zx-pos"];
  function msg(t) { var m = document.getElementById("xfer-msg"); if (m) m.textContent = t; }
  function J(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function save() {
    var code = {}; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("px:") === 0) code[k] = localStorage.getItem(k); } } catch (e) {}
    var data = { kind: "ai-from-scratch-progress", version: 1, saved: new Date().toISOString(),
      progress: window.ZProgress ? window.ZProgress() : J(KEYS[0]), review: J(KEYS[1]), predictions: J(KEYS[2]), positions: J(KEYS[3]), code: code };
    var blob = new Blob([JSON.stringify(data)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "ai-from-scratch-progress-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    msg("Saved. Open this file with Import progress on your other device.");
  }
  function load(file, mergeProgress) {
    var r = new FileReader();
    r.onload = function () {
      var D; try { D = JSON.parse(r.result); } catch (e) { msg("That file is not a progress file."); return; }
      if (!D || D.kind !== "ai-from-scratch-progress") { msg("That file is not a progress file from this course."); return; }
      try {
        var R = J(KEYS[1]) || { q: {}, learned: 0 }; R.q = R.q || {};
        if (D.review) { for (var q in (D.review.q || {})) if (!R.q[q]) R.q[q] = D.review.q[q]; R.learned = Math.max(R.learned || 0, D.review.learned || 0); localStorage.setItem(KEYS[1], JSON.stringify(R)); }
        [[KEYS[2], D.predictions], [KEYS[3], D.positions]].forEach(function (p) { if (!p[1]) return; var cur = J(p[0]) || {}; for (var x in p[1]) if (!(x in cur)) cur[x] = p[1][x]; localStorage.setItem(p[0], JSON.stringify(cur)); });
        for (var c in (D.code || {})) if (localStorage.getItem(c) === null) localStorage.setItem(c, D.code[c]);
      } catch (e) {}
      var n = D.progress && D.progress.d ? Object.keys(D.progress.d).filter(function (k) { return D.progress.d[k] && D.progress.d[k][0] === 1; }).length : 0;
      mergeProgress(D);
      msg("Imported: " + n + " completed lesson" + (n === 1 ? "" : "s") + " merged with what this browser had. Nothing was overwritten.");
      setTimeout(function () { location.reload(); }, 1400);
    };
    r.readAsText(file);
  }
  return { save: save, load: load };
})();
