
(function () {
  "use strict";
  const COURSE = /*@@COURSE@@*/;
  const OLD_IDS = {};
  const CONCEPTS = {};
  const KEY = "ai-from-scratch-progress-v1", OLD_KEY = "agentic-start-to-ship-v1";
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- course data ---------- */
  const phases = [], lessons = [], byId = {}, chById = {};
  COURSE.forEach((part, pi) => part.chapters.forEach(ch => {
    ch.part = part.title; ch.partNo = pi + 1; phases.push(ch); chById[ch.id] = ch;
    ch.lessons.forEach(l => { l.ch = ch; lessons.push(l); byId[l.id] = l; });
  }));
  const PATHS = {
    all: ["Everything", "Every lesson in the course", "Counts every lesson in the course."],
    A: ["Everything", "Every lesson in the course", "Counts every lesson in the course."]
  };

  /* ---------- progress state: saved on this device, and to the viewer's account when allowed ---------- */
  let S = { d: {}, q: {}, tasks: {}, last: "", path: "all", t: 0 };
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S = Object.assign(S, JSON.parse(raw));
      else {
        const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
        if (old && Array.isArray(old.done)) { old.done.forEach(id => { if (byId[id]) S.d[id] = [1, 1]; }); S.tasks = old.tasks || {}; }
      }
    } catch (e) {}
    if (!PATHS[S.path]) S.path = "all";
  }
  const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const isDone = id => !!(S.d[id] && S.d[id][0] === 1);
  const onPath = l => S.path === "all" || l.paths.indexOf(S.path) >= 0;
  function merge(R) {
    if (!R || typeof R !== "object") return false;
    let changed = false;
    Object.keys(R.d || {}).forEach(id => { const r = R.d[id]; if (Array.isArray(r) && (!S.d[id] || r[1] > S.d[id][1])) { S.d[id] = r; changed = true; } });
    Object.keys(R.q || {}).forEach(id => { const r = R.q[id]; if (Array.isArray(r) && (!S.q[id] || r[0] > S.q[id][0])) { S.q[id] = r; changed = true; } });
    Object.keys(R.tasks || {}).forEach(k => { if (R.tasks[k] && !S.tasks[k]) { S.tasks[k] = true; changed = true; } });
    if ((R.t || 0) > (S.t || 0)) { if (R.last) S.last = R.last; if (PATHS[R.path]) S.path = R.path; S.t = R.t; changed = true; }
    return changed;
  }

  let remote = null, syncState = "local", pushTimer = null, pushing = false, dirty = false;
  function queuePush() { if (!remote) return; dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
  async function push() {
    if (!remote || pushing) return;
    pushing = true; dirty = false;
    try { await remote.set(JSON.parse(JSON.stringify(S))); }
    catch (e) { if (e && e.code !== "unavailable") { remote = null; syncState = "local"; renderSync(); } }
    pushing = false;
    if (dirty) queuePush();
  }
  async function initRemote(interactive) {
    try {
      if (!window.claude || typeof window.claude.use !== "function") return;
      const perms = await window.claude.use("permissions");
      let st = "prompt";
      if (perms) { try { st = await perms.state("db"); } catch (e) {} }
      if (st === "unavailable" || st === "denied") { syncState = "local"; renderSync(); return; }
      if (st !== "granted" && !interactive) { syncState = "ask"; renderSync(); return; }
      syncState = "working"; renderSync();
      const db = await window.claude.use("db"), user = await window.claude.use("user");
      const uid = db && user ? await user.id() : null;
      if (!uid) { syncState = "local"; renderSync(); return; }
      const ref = db.doc("data/users/" + uid + "/progress");
      const before = JSON.stringify(S);
      const snap = await ref.get();
      if (snap.exists) merge(snap.data());
      remote = ref; syncState = "synced";
      saveLocal(); refresh();
      if (!snap.exists || JSON.stringify(snap.data()) !== JSON.stringify(S) || before !== JSON.stringify(S)) queuePush();
    } catch (e) { syncState = "local"; renderSync(); }
  }
  function touch() { S.t = Date.now(); saveLocal(); queuePush(); refresh(); }

  /* ---------- numbers ---------- */
  function tally(list) {
    const ls = list.filter(onPath);
    const done = ls.filter(l => isDone(l.id));
    return { n: ls.length, done: done.length, min: ls.reduce((a, l) => a + l.min, 0), doneMin: done.reduce((a, l) => a + l.min, 0) };
  }
  const hrs = m => { const h = m / 60; return h >= 10 ? Math.round(h) : Math.round(h * 10) / 10; };
  function nextLesson() {
    const pool = lessons.filter(onPath);
    const start = Math.max(0, pool.findIndex(l => l.id === S.last));
    if (S.last && byId[S.last] && !isDone(S.last) && onPath(byId[S.last])) return byId[S.last];
    for (let i = start; i < pool.length; i++) if (!isDone(pool[i].id)) return pool[i];
    return pool.find(l => !isDone(l.id)) || null;
  }
  function ringSvg(frac, cls) {
    const c = 94.25, off = c * (1 - Math.max(0, Math.min(1, frac)));
    return '<svg class="ring' + (frac >= 1 ? " full" : "") + (cls ? " " + cls : "") + '" viewBox="0 0 36 36" aria-hidden="true"><circle class="trk" cx="18" cy="18" r="15"/>' +
      '<circle class="val" cx="18" cy="18" r="15" stroke-dasharray="' + c + '" stroke-dashoffset="' + off.toFixed(2) + '"/></svg>';
  }

  /* ---------- sections inside a phase: its own lessons, cheat sheets, and companion lessons by topic ---------- */
  function groupLabel(g) {
    if (!g) return "Lessons";
    const k = g.indexOf(" · ");
    return k < 0 ? esc(g) : '<small>' + esc(g.slice(0, k)) + "</small>" + esc(g.slice(k + 3));
  }

  /* ---------- sidebar ---------- */
  const openCh = {};
  function renderNav(currentCh, currentLesson) {
    let h = "", lastPart = "";
    phases.forEach(ch => {
      if (ch.part !== lastPart) { lastPart = ch.part; h += '<div class="nav-part-title">Part ' + ch.partNo + " · " + esc(ch.part) + "</div>"; }
      const t = tally(ch.lessons), open = !!openCh[ch.id];
      h += '<button type="button" class="nav-ch' + (currentCh === ch.id ? " current" : "") + '" data-ch="' + ch.id + '" aria-expanded="' + open + '">' +
        ringSvg(t.n ? t.done / t.n : 0) + '<span class="nav-ch-code">' + esc(ch.code) + '</span><span class="nav-ch-title">' + esc(ch.title) +
        '</span><span class="nav-ch-count">' + t.done + "/" + t.n + "</span></button>";
      if (open) {
        h += '<ol class="nav-lessons"><li><a class="nav-ch-open" href="#' + ch.id + '">Phase overview</a></li>';
        let grp = null; const grouped = ch.lessons.some(x => x.group);
        ch.lessons.forEach(l => {
          const lg = l.group || "";
          if (grouped && lg !== grp) { grp = lg; h += '<li class="nav-group" aria-hidden="true">' + groupLabel(lg) + "</li>"; }
          h += '<li><a class="nav-link' + (isDone(l.id) ? " done" : "") + (l.id === currentLesson ? " active" : "") + (onPath(l) ? "" : " off") + '" href="#' + l.id + '" data-id="' + l.id + '">' +
            '<span class="nav-done" aria-hidden="true"></span><span class="nav-title"><span class="nav-num">' + esc(l.num) + "</span>" + esc(l.title) +
            '</span><span class="nav-min">' + l.min + "m</span></a></li>";
        });
        h += "</ol>";
      }
    });
    $("nav-chapters").innerHTML = h;
  }

  /* ---------- home ---------- */
  function renderSync() {
    const el = $("sync"); if (!el) return;
    const msg = { synced: "Saved to your Claude account, so it follows you to any device.", working: "Connecting…",
      ask: "Progress is saved in this browser.", local: "Progress is saved in this browser." }[syncState];
    el.className = "sync" + (syncState === "synced" ? " on" : "");
    el.innerHTML = '<span class="dotc"></span><span>' + msg + "</span>" + (syncState === "ask" ? '<button type="button" id="sync-btn">Keep it on every device</button>' : "") +
      '<span class="xfer"><button type="button" id="xfer-out">Export progress</button><button type="button" id="xfer-in">Import progress</button><input type="file" id="xfer-file" accept="application/json,.json" hidden></span>' +
      '<span class="xfer-msg" id="xfer-msg" role="status"></span>';
  }
  let resetArmed = false;
  function renderHome() {
    const all = tally(lessons), nx = nextLesson(), frac = all.n ? all.done / all.n : 0;
    const chDone = phases.filter(c => { const t = tally(c.lessons); return t.n && t.done === t.n; }).length;
    const chWith = phases.filter(c => tally(c.lessons).n).length;
    const quizzes = Object.keys(S.q).length;
    let h = '<header class="home-hero"><div class="eyebrow"><span>A complete course</span><span class="dot">·</span><span>' + lessons.length + " lessons</span><span class=\"dot\">·</span><span>about " + hrs(lessons.reduce((a, l) => a + l.min, 0)) + " hours</span></div>" +
      "<h1>AI from Zero to Hero</h1><p class=\"lede\">From a dev environment and a little linear algebra to agents that plan, use tools and work in teams, and on to serving, safety, capstones, guided projects, interview case files, a project library, forward deployed engineering, and MLOps and LLMOps, in ten parts. Every lesson has its code run, its figures live, and quick checks, exercises and interview questions to make it stick.</p></header>";
    h += '<section class="dash" aria-label="Your progress"><div class="dash-ring">' + ringSvg(frac) + '<div class="dash-pct"><b>' + Math.round(frac * 100) + "%</b><span>complete</span></div></div>" +
      '<div class="dash-body"><div class="dash-line">' + (all.done === 0 ? "You have not started yet." : all.done === all.n ? "You have finished this path. Well done." : all.done + " of " + all.n + " lessons finished") +
      "<small>" + (all.done ? "About " + hrs(all.min - all.doneMin) + " hours left of " + hrs(all.min) : "About " + hrs(all.min) + " hours, at your own pace") + (S.path !== "all" ? " on the “" + PATHS[S.path][0] + "” path" : "") + ".</small></div>" +
      '<div class="dash-actions">' + (nx ? '<a class="cta" href="#' + nx.id + '">' + (all.done ? "Continue" : "Start") + ": " + esc(nx.num) + " · " + esc(nx.title) + " →</a>" : "") + "</div>" +
      '<div class="dash-stats"><span><b>' + chDone + "</b> of " + chWith + " phases complete</span><span><b>" + hrs(all.doneMin) + "</b> hours studied</span><span><b>" + quizzes + "</b> quizzes answered</span></div>" +
      '<div class="sync" id="sync"></div></div></section>';
    h += '<div class="home-h2">Choose your path</div><div class="paths" role="group" aria-label="Learning path">';
    Object.keys(PATHS).forEach(k => {
      const ls = k === "all" ? lessons : lessons.filter(l => l.paths.indexOf(k) >= 0);
      h += '<button type="button" class="path-btn" data-path="' + k + '" aria-pressed="' + (S.path === k) + '"><b>' + (k === "all" ? "" : k + " · ") + PATHS[k][0] + "</b><span>" + PATHS[k][1] + " · " + ls.length + " lessons · " + hrs(ls.reduce((a, l) => a + l.min, 0)) + " h</span></button>";
    });
    h += '</div><p class="path-note">' + PATHS[S.path][2] + (S.path !== "all" ? " Lessons outside your path stay available and are shown faded." : "") + "</p>";
    h += '<div class="home-h2">The route</div><div class="route">';
    phases.forEach(ch => { const t = tally(ch.lessons); if (!t.n) return;
      h += '<a href="#' + ch.id + '" style="flex-grow:' + Math.max(1, Math.round(t.min / 30)) + '" class="' + (t.done === t.n ? "full" : "") + '" title="Phase ' + esc(ch.code) + " · " + esc(ch.title) + ": " + t.done + " of " + t.n + '"><i><u style="width:' + (100 * t.done / t.n) + '%"></u></i><span>' + esc(ch.code) + "</span></a>"; });
    h += '</div><div class="route-legend"><span>One segment per chapter, as wide as its hours</span><span>' + hrs(all.doneMin) + " / " + hrs(all.min) + " h</span></div>";
    COURSE.forEach((part, pi) => {
      const pl = [].concat.apply([], part.chapters.map(c => c.lessons)), pt = tally(pl);
      const pst = pt.n && pt.done === pt.n ? "done" : (pt.done || (nx && pl.some(l => l.id === nx.id))) ? "now" : "todo";
      h += '<section class="part" data-state="' + pst + '"><span class="part-node" aria-hidden="true">' + (pst === "done" ? '<svg class="zx-ic" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11"/></svg>' : (pi + 1)) + '</span><div class="part-head"><span class="eyebrow">Part ' + (pi + 1) + "</span><h2>" + esc(part.title) + "</h2><small>" + part.chapters.length + (part.chapters.length === 1 ? " chapter" : " phases") + " · " + hrs(pl.reduce((a, l) => a + l.min, 0)) + " h" + (pt.done ? " · " + pt.done + "/" + pt.n + " done" : "") + '</small></div><div class="ch-grid">';
      part.chapters.forEach(ch => {
        const t = tally(ch.lessons), full = t.n && t.done === t.n;
        h += '<a class="ch-card' + (full ? " full" : t.done ? " started" : "") + '" href="#' + ch.id + '"><div class="ch-top"><span class="ch-code">Phase ' + esc(ch.code) + '</span><span class="ch-state">' +
          (!t.n ? "Not on your path" : full ? "Complete" : t.done ? t.done + " of " + t.n : "Not started") + '</span></div><div class="ch-title">' + esc(ch.title) + '</div><div class="ch-desc">' + esc(ch.desc) + '</div><div class="ch-foot">' +
          ch.lessons.length + " lessons · " + hrs(ch.lessons.reduce((a, l) => a + l.min, 0)) + ' h</div><div class="ch-bar"><i style="width:' + (t.n ? 100 * t.done / t.n : 0) + '%"></i></div></a>';
      });
      h += "</div></section>";
    });
    h += '<div class="home-foot"><span>Tick “Mark complete” at the end of each lesson and this page keeps score.</span><button type="button" class="ghost" id="reset-btn">' + (resetArmed ? "Click again to erase all progress" : "Reset my progress") + "</button></div>";
    $("view-home").innerHTML = h;
    renderSync();
  }

  /* ---------- chapter page ---------- */
  function renderChapter(ch) {
    const t = tally(ch.lessons), idx = phases.indexOf(ch), nx = ch.lessons.filter(onPath).find(l => !isDone(l.id)) || null;
    const prev = phases[idx - 1], next = phases[idx + 1];
    let h = '<header class="chv-head"><nav class="crumbs" aria-label="Where you are"><a href="#home">Course home</a><span aria-hidden="true">/</span><span>Part ' + ch.partNo + " · " + esc(ch.part) + "</span></nav>" +
      '<div class="eyebrow"><span>Phase ' + esc(ch.code) + "</span></div><h1>" + esc(ch.title) + '</h1><p class="lede">' + esc(ch.desc) + "</p>" +
      '<div class="chv-prog"><div class="chv-bar' + (t.n && t.done === t.n ? " full" : "") + '"><i style="width:' + (t.n ? 100 * t.done / t.n : 0) + '%"></i></div><span>' + t.done + " of " + t.n + " lessons · " + hrs(ch.lessons.reduce((a, l) => a + l.min, 0)) + " h</span>" +
      (nx ? '<a class="cta" href="#' + nx.id + '">' + (t.done ? "Continue" : "Start") + " with " + esc(nx.num) + " →</a>" : t.n ? '<span class="chip chip-done">Phase complete</span>' : "") + "</div></header>";
    h += '<ol class="les-list">';
    let grp = null; const grouped = ch.lessons.some(x => x.group);
    ch.lessons.forEach(l => {
      const lg = l.group || "";
      if (grouped && lg !== grp) {
        grp = lg; const n = ch.lessons.filter(x => (x.group || "") === lg).length;
        h += '<li class="les-group"><span class="les-group-t">' + groupLabel(lg) + '</span><span class="les-group-n">' + n + (n === 1 ? " item" : " items") + "</span></li>";
      }
      const q = S.q[l.id];
      h += '<li><a class="les-row' + (isDone(l.id) ? " done" : "") + (nx && nx.id === l.id ? " here" : "") + (onPath(l) ? "" : " off") + '" href="#' + l.id + '"><span class="les-check" aria-hidden="true"></span><span class="les-num">' + esc(l.num) + '</span><span class="les-title">' + esc(l.title) +
        (isDone(l.id) ? "<small>Completed</small>" : nx && nx.id === l.id ? "<small>Up next</small>" : "") + '</span><span class="les-meta">' + (q ? '<span class="chip chip-done">Quiz ' + q[0] + "/" + q[1] + "</span>" : "") + (l.depth ? '<span class="chip chip-depth">' + esc(l.depth) + "</span>" : "") + "<span>" + l.min + " min</span></span></a></li>";
    });
    h += '</ol><footer class="m-foot"><div class="pn-row">' +
      (prev ? '<a class="pn prev" href="#' + prev.id + '"><span class="pn-dir">Previous chapter</span><span class="pn-t">' + esc(prev.code) + " · " + esc(prev.title) + "</span></a>" : "<span></span>") +
      (next ? '<a class="pn next" href="#' + next.id + '"><span class="pn-dir">Next chapter</span><span class="pn-t">' + esc(next.code) + " · " + esc(next.title) + "</span></a>" : "<span></span>") + "</div></footer>";
    $("view-chapter").innerHTML = h;
  }

  /* ---------- lesson ---------- */
  const modules = Array.from(document.querySelectorAll("article.module"));
  const artById = {}; modules.forEach(m => { artById[m.id] = m; });
  const highlighted = new Set();
  const loading = {};
  function hydrate(art) {
    if (!art.dataset.stub) return Promise.resolve(art);
    if (loading[art.id]) return loading[art.id];
    return loading[art.id] = fetch("lessons/" + art.id + ".html").then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => {
      art.innerHTML = t; delete art.dataset.stub;
      art.querySelectorAll("script").forEach(old => {
        const ty = (old.getAttribute("type") || "").toLowerCase();
        if (ty && ty !== "text/javascript" && ty !== "module") return;
        const s = document.createElement("script"); s.textContent = old.textContent; old.replaceWith(s);
      });
      try { if (window.mountLessonFigures) window.mountLessonFigures(art); } catch (e) {}
      try { if (window.XV && window.XV.mountAll) window.XV.mountAll(art); } catch (e) {}
      try { if (window.PXBind) window.PXBind(art); } catch (e) {}
      art.querySelectorAll("input.dod").forEach(cb => {
        cb.checked = !!S.tasks[cb.id];
        cb.addEventListener("change", () => { if (cb.checked) S.tasks[cb.id] = true; else delete S.tasks[cb.id]; S.t = Date.now(); saveLocal(); queuePush(); });
      });
      return art;
    }).catch(e => { delete loading[art.id]; throw e; });
  }
  window.ZHydrate = id => artById[id] ? hydrate(artById[id]) : Promise.resolve(null);
  function highlight(art) {
    if (highlighted.has(art.id) || !window.hljs) return;
    window.hljs.configure({ ignoreUnescapedHTML: true });
    art.querySelectorAll("pre code").forEach(el => { try { window.hljs.highlightElement(el); } catch (e) {} });
    highlighted.add(art.id);
  }
  let heads = [];
  function renderOnPage(art) {
    heads = Array.from(art.querySelectorAll(".prose > h2"));
    const box = $("onpage");
    if (heads.length < 2) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="onpage-title">On this page</div>' + heads.map((h, i) => '<button type="button" data-i="' + i + '">' + esc(h.textContent) + "</button>").join("");
  }
  function lessonButtons() {
    document.querySelectorAll(".done-btn").forEach(b => {
      const d = isDone(b.dataset.id);
      b.classList.toggle("is-done", d);
      b.textContent = d ? "Completed · go to the next lesson" : "Mark complete and continue";
      const u = $("undo-" + b.dataset.id); if (u) u.hidden = !d;
    });
    document.querySelectorAll("[data-done-chip]").forEach(c => { c.hidden = !isDone(c.dataset.doneChip); });
  }

  /* ---------- routing ---------- */
  let view = { kind: "home", id: "" };
  function setView(kind) {
    $("view-home").hidden = kind !== "home"; $("view-chapter").hidden = kind !== "chapter"; $("lesson-wrap").hidden = kind !== "lesson";
    $("rail-home").classList.toggle("active", kind === "home"); document.body.classList.toggle("in-lesson", kind === "lesson");
    document.body.classList.remove("nav-open"); $("menu-btn").setAttribute("aria-expanded", "false");
  }
  function route(scroll) {
    let id = (location.hash || "").slice(1);
    if (OLD_IDS[id]) id = OLD_IDS[id];
    if (chById[id]) {
      view = { kind: "chapter", id: id }; openCh[id] = true;
      setView("chapter"); renderChapter(chById[id]); renderNav(id, ""); if (window.ZXP) window.ZXP.enter("chapter");
      $("tb-where").textContent = "Phase " + chById[id].code + " · " + chById[id].title;
      document.title = chById[id].title + " · AI from Zero to Hero";
    } else if (artById[id]) {
      const l = byId[id], art = artById[id];
      if (art.dataset.stub) {
        setView("lesson"); modules.forEach(m => { m.hidden = true; });
        $("tb-where").textContent = l.num + " · " + l.title;
        let wait = $("lesson-loading");
        if (!wait) { wait = document.createElement("div"); wait.id = "lesson-loading"; wait.className = "lesson-loading"; art.parentNode.insertBefore(wait, art.parentNode.firstChild); }
        wait.hidden = false; wait.textContent = "Loading " + l.num + " · " + l.title + "…";
        hydrate(art).then(() => {
          wait.hidden = true;
          let cur = (location.hash || "").slice(1); if (OLD_IDS[cur]) cur = OLD_IDS[cur];
          if (cur === id) { route(scroll); if (window.DJ) window.DJ.route(); if (window.ZMO && window.ZMO.scan) window.ZMO.scan(art); }
        }, () => { wait.textContent = "This lesson could not be loaded. Check your connection and reload the page."; });
        return;
      }
      view = { kind: "lesson", id: id }; openCh[l.ch.id] = true;
      modules.forEach(m => { m.hidden = m !== art; });
      setView("lesson"); if (window.ZXP) window.ZXP.lesson(art, l); highlight(art); renderOnPage(art); renderNav(l.ch.id, id); lessonButtons();
      $("tb-where").textContent = l.num + " · " + l.title;
      document.title = l.title + " · AI from Zero to Hero";
      if (S.last !== id) { S.last = id; S.t = Date.now(); saveLocal(); queuePush(); }
      const a = document.querySelector(".nav-link.active"), rail = $("rail");
      if (a && rail) { const top = a.offsetTop; if (top < rail.scrollTop + 60 || top > rail.scrollTop + rail.clientHeight - 60) rail.scrollTop = Math.max(0, top - rail.clientHeight / 3); }
    } else {
      view = { kind: "home", id: "" };
      setView("home"); renderHome(); renderNav("", ""); if (window.ZXP) window.ZXP.enter("home");
      $("tb-where").textContent = ""; document.title = "AI from Zero to Hero";
    }
    if (scroll !== false) window.scrollTo(0, 0);
    onScroll();
  }
  function refresh() {
    const all = tally(lessons), frac = all.n ? all.done / all.n : 0;
    $("tb-pct").textContent = Math.round(frac * 100) + "%";
    $("tb-count").textContent = all.done + " / " + all.n;
    const ring = $("tb-ring"); ring.classList.toggle("full", frac >= 1);
    ring.querySelector(".val").setAttribute("stroke-dashoffset", (94.25 * (1 - frac)).toFixed(2));
    if (view.kind === "home") renderHome();
    if (view.kind === "chapter") renderChapter(chById[view.id]);
    renderNav(view.kind === "chapter" ? view.id : view.kind === "lesson" ? byId[view.id].ch.id : "", view.kind === "lesson" ? view.id : "");
    lessonButtons();
  }

  /* ---------- search (index built from the page the first time it is used) ---------- */
  let INDEX = null;
  let PARTS_DONE = 0;
  function buildIndex() {        // the lesson text arrives one part at a time; results fill in as each part lands
    INDEX = {};
    COURSE.forEach((p, k) => fetch("search/p" + (k + 1) + ".json").then(r => r.json()).then(j => { Object.assign(INDEX, j); }, () => {})
      .then(() => { PARTS_DONE++; if (search.value.trim().length >= 2) runSearch(); }));
  }
  const search = $("search"), note = $("search-note"), results = $("search-results");
  function runSearch() {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; $("nav-chapters").hidden = false; note.textContent = ""; return; }
    if (!INDEX) buildIndex();
    const hits = [];
    lessons.forEach(l => {
      const text = INDEX[l.id] || "", inTitle = l.title.toLowerCase().indexOf(q) >= 0, pos = text.toLowerCase().indexOf(q);
      if (inTitle || pos >= 0) hits.push({ l: l, inTitle: inTitle, pos: pos, text: text });
    });
    hits.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
    note.textContent = (hits.length ? hits.length + " lesson" + (hits.length === 1 ? "" : "s") + " mention “" + search.value.trim() + "”" : "No lesson mentions that") +
      (PARTS_DONE < COURSE.length ? " so far · searching part " + (PARTS_DONE + 1) + " of " + COURSE.length + "…" : "");
    results.innerHTML = hits.slice(0, 40).map(h => {
      let snip = "";
      if (h.pos >= 0) { const a = Math.max(0, h.pos - 40), b = Math.min(h.text.length, h.pos + q.length + 60);
        snip = (a ? "…" : "") + esc(h.text.slice(a, h.pos)) + "<b>" + esc(h.text.slice(h.pos, h.pos + q.length)) + "</b>" + esc(h.text.slice(h.pos + q.length, b)) + "…"; }
      return '<a class="sr" href="#' + h.l.id + '"><span class="sr-t"><span>' + esc(h.l.num) + "</span>" + esc(h.l.title) + "</span>" + (snip ? '<span class="sr-s">' + snip + "</span>" : "") + "</a>";
    }).join("");
    results.hidden = false; $("nav-chapters").hidden = true;
  }
  let searchTimer = null;
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 160); });

  /* ---------- events ---------- */
  /* ---------- concept pointers ---------- */
  let cxPop = null, cxFor = null;
  function closeCx() { if (cxPop) { cxPop.remove(); cxPop = null; cxFor = null; } }
  function openCx(el) {
    const c = CONCEPTS[el.dataset.c]; if (!c) return;
    closeCx();
    const les = byId[c[2]];
    const cur = (view.kind === "lesson" && byId[view.id]) ? lessons.indexOf(byId[view.id]) : -1;
    const later = les && cur >= 0 && lessons.indexOf(les) > cur;
    cxPop = document.createElement("div"); cxPop.id = "cx-pop"; cxPop.setAttribute("role", "dialog");
    cxPop.innerHTML = "<b>" + esc(c[0]) + "</b>" + esc(c[1]) +
      '<span class="cx-where">' + (later ? "Taught later, in " : "Taught in ") + '<a href="#' + c[2] + '">Lesson ' + esc(c[3]) + (les ? " · " + esc(les.title) : "") + "</a></span>" +
      (later ? '<span class="cx-note">You do not need more than this line yet.</span>' : "");
    document.body.appendChild(cxPop);
    const r = el.getBoundingClientRect(), pw = cxPop.offsetWidth, ph = cxPop.offsetHeight;
    let left = r.left + window.scrollX, top = r.bottom + window.scrollY + 6;
    left = Math.max(12 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - pw - 12));
    if (r.bottom + ph + 12 > window.innerHeight && r.top - ph - 6 > 0) top = r.top + window.scrollY - ph - 6;
    cxPop.style.left = left + "px"; cxPop.style.top = top + "px"; cxFor = el;
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeCx();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("cx")) { e.preventDefault(); cxFor === e.target ? closeCx() : openCx(e.target); }
  });
  window.addEventListener("hashchange", closeCx);
  let cxTimer = null;
  if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("mouseover", e => {
      const cx = e.target.closest && e.target.closest(".cx");
      if (cx) { clearTimeout(cxTimer); if (cxFor !== cx) cxTimer = setTimeout(() => openCx(cx), 220); }
      else if (e.target.closest && e.target.closest("#cx-pop")) clearTimeout(cxTimer);
      else if (cxPop) { clearTimeout(cxTimer); cxTimer = setTimeout(closeCx, 260); }
    });
  }

  document.addEventListener("click", e => {
    const t = e.target;
    const cx = t.closest(".cx");
    if (cx) { cxFor === cx ? closeCx() : openCx(cx); return; }
    if (cxPop && !t.closest("#cx-pop")) closeCx();
    const jump = t.closest('a[href^="#term-"], a.term-jump');
    if (jump) {
      e.preventDefault();
      if (jump.dataset.mod && jump.dataset.mod !== view.id) { try { history.replaceState(null, "", "#" + jump.dataset.mod); } catch (err) {} route(false); }
      const el = document.getElementById(jump.getAttribute("href").slice(1));
      if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
      return;
    }
    const chBtn = t.closest(".nav-ch");
    if (chBtn) { const id = chBtn.dataset.ch; openCh[id] = !openCh[id]; renderNav(view.kind === "chapter" ? view.id : view.kind === "lesson" ? byId[view.id].ch.id : "", view.kind === "lesson" ? view.id : ""); return; }
    const pb = t.closest(".path-btn");
    if (pb) { S.path = pb.dataset.path; touch(); return; }
    if (t.closest("#sync-btn")) { initRemote(true); return; }
    if (t.closest("#xfer-out")) { window.ZXfer.save(); return; }
    if (t.closest("#xfer-in")) { const f = $("xfer-file"); if (f) { f.value = ""; f.click(); } return; }
    if (t.closest("#reset-btn")) {
      if (!resetArmed) { resetArmed = true; renderHome(); setTimeout(() => { if (resetArmed) { resetArmed = false; if (view.kind === "home") renderHome(); } }, 5000); return; }
      resetArmed = false; const now = Date.now();
      Object.keys(S.d).forEach(id => { S.d[id] = [0, now]; }); S.q = {}; S.tasks = {}; S.last = "";
      document.querySelectorAll("input.dod").forEach(cb => { cb.checked = false; });
      touch(); return;
    }
    const op = t.closest("#onpage button");
    if (op) { const h = heads[+op.dataset.i]; if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 76 }); return; }
    const qaAll = t.closest(".qa-all");
    if (qaAll) {
      const open = qaAll.getAttribute("aria-pressed") !== "true";
      qaAll.closest("article").querySelectorAll("details.qa").forEach(d => { d.open = open; });
      qaAll.setAttribute("aria-pressed", String(open)); qaAll.textContent = open ? "Close all answers" : "Open all answers";
      return;
    }
    const done = t.closest(".done-btn");
    if (done) {
      const id = done.dataset.id;
      if (!isDone(id)) { S.d[id] = [1, Date.now()]; touch(); }
      const i = lessons.indexOf(byId[id]), nx = lessons[i + 1];
      location.hash = nx ? (nx.ch !== byId[id].ch ? nx.ch.id : nx.id) : "home";
      return;
    }
    const undo = t.closest(".undo-btn");
    if (undo) { S.d[undo.dataset.id] = [0, Date.now()]; touch(); return; }
    const copy = t.closest(".copy");
    if (copy) {
      const code = copy.parentElement.querySelector("code"), text = code ? code.innerText : "";
      const ok = () => { copy.textContent = "Copied"; setTimeout(() => copy.textContent = "Copy", 1400); };
      const fallback = () => { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = "Selected"; setTimeout(() => copy.textContent = "Copy", 1400); };
      try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (err) { fallback(); }
      return;
    }
    const opt = t.closest(".opt");
    if (opt && !opt.disabled) {
      const q = opt.closest(".q");
      q.querySelectorAll(".opt").forEach(o => { o.disabled = true; if (o.dataset.correct === "true") o.classList.add("right"); });
      if (opt.dataset.correct !== "true") opt.classList.add("wrong");
      q.dataset.answered = opt.dataset.correct;
      q.querySelector(".q-explain").hidden = false;
      const quiz = q.closest(".quiz"), all = quiz.querySelectorAll(".q"), answered = quiz.querySelectorAll(".q[data-answered]");
      const right = quiz.querySelectorAll('.q[data-answered="true"]').length;
      quiz.querySelector(".quiz-score").textContent = right + " of " + answered.length + " correct" + (answered.length === all.length ? " · saved to your progress" : "");
      if (answered.length === all.length) { const art = q.closest("article"); S.q[art.id] = [right, all.length]; S.t = Date.now(); saveLocal(); queuePush(); }
    }
  });
  document.querySelectorAll("input.dod").forEach(cb => {
    cb.addEventListener("change", () => { if (cb.checked) S.tasks[cb.id] = true; else delete S.tasks[cb.id]; S.t = Date.now(); saveLocal(); queuePush(); });
  });
  const menuBtn = $("menu-btn");
  menuBtn.addEventListener("click", () => { const open = document.body.classList.toggle("nav-open"); menuBtn.setAttribute("aria-expanded", String(open)); });
  $("scrim").addEventListener("click", () => { document.body.classList.remove("nav-open"); menuBtn.setAttribute("aria-expanded", "false"); });
  window.addEventListener("hashchange", () => { if ((location.hash || "").indexOf("#term-") === 0) return; route(); });

  let ticking = false;
  function onScroll() {
    const bar = $("readbar");
    if (view.kind !== "lesson") { bar.style.width = "0"; return; }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? Math.min(100, 100 * window.scrollY / max) : 0) + "%";
    if (heads.length > 1) {
      let cur = 0;
      for (let i = 0; i < heads.length; i++) if (heads[i].getBoundingClientRect().top < 120) cur = i;
      $("onpage").querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === cur));
    }
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });

  document.addEventListener("change", e => {
    if (e.target && e.target.id === "xfer-file" && e.target.files && e.target.files[0]) {
      window.ZXfer.load(e.target.files[0], R => { const ch = merge(R && R.progress); if (ch) { saveLocal(); queuePush(); } refresh(); return ch; });
    }
  });
  window.ZProgress = () => S;
  /* ---------- start ---------- */
  loadLocal();
  document.querySelectorAll("input.dod").forEach(cb => { cb.checked = !!S.tasks[cb.id]; });
  refresh();
  route(false);
  try { history.scrollRestoration = "manual"; } catch (e) {}
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 0);                 // undo the browser's jump to the #anchor
  window.addEventListener("load", () => { if (window.scrollY < 400) window.scrollTo(0, 0); });
  initRemote(false);
})();
