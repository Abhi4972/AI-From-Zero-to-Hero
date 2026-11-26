
/* Dojo layer: icon rail, command search, theme switch, home and chapter cards with thumbnails drawn from each
   lesson's own diagrams, predict-first exercises, a spaced Review queue for quick checks, an Interview bank built
   from every interview question in the lessons, and a Playground (a network trainer plus every in-lesson lab).
   It only adds and rearranges presentation; every lesson node stays where the course put it. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const DAY = 864e5;
  document.body.classList.add("dj");

  const IC = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    chat: '<path d="M4 5h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M20 9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-3"/>',
    lab: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M8 7l8 4M8 17l8-4"/>',
    review: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  const ic = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + "</svg>";

  /* ---------- what the course contains, read from the page ---------- */
  const arts = $$("article.module");
  const L = {}, CH = {}, chOrder = [];
  arts.forEach(a => {
    const crumbs = $$(".m-head .crumbs a, .crumbs a", a).filter(x => x.getAttribute("href") !== "#home");
    const ca = crumbs[0], chId = ca ? ca.getAttribute("href").slice(1) : "other", chT = ca ? ca.textContent.trim() : "Other";
    const num = (($(".chip-num", a) || {}).textContent || "").replace(/^Lesson\s*/, "").trim();
    const minChip = $$(".m-meta .chip", a).map(c => c.textContent).find(t => /^\d+\s*min$/.test(t.trim()));
    const h1 = $("h1", a);
    L[a.id] = { id: a.id, num: num, title: h1 ? h1.textContent.trim() : a.id, ch: chId, min: minChip ? parseInt(minChip, 10) : 0, art: a };
    if (!CH[chId]) { CH[chId] = { id: chId, title: chT.replace(/^Phase\s+[\w.]+\s*·\s*/, ""), code: (/^Phase\s+([\w.]+)/.exec(chT) || [])[1] || "", label: chT, lessons: [] }; chOrder.push(chId); }
    CH[chId].lessons.push(a.id);
  });

  /* thumbnails: a clone of the first diagram (or open-licence figure) the lesson already contains */
  let thumbN = 0;
  const TH = {}, THP = {}, THD = {};
  function thLoad(ch) { return THP[ch] || (THP[ch] = fetch("meta/th-" + ch + ".json").then(r => r.json()).then(j => { Object.assign(TH, j); }, () => {})); }
  function thSrc(id) {
    const art = L[id] && L[id].art; if (!art) return null; if (!art.dataset.stub) return art;
    if (!TH[id]) return null; if (!THD[id]) { THD[id] = document.createElement("div"); THD[id].innerHTML = TH[id]; } return THD[id];
  }
  function thumb(ids, cls) {
    const box = el("div", "dj-thumb" + (cls ? " " + cls : ""));
    box.setAttribute("aria-hidden", "true");
    const miss = ids.filter(id => L[id] && L[id].art && L[id].art.dataset.stub && !(id in TH));
    if (miss.length) {
      box.classList.add("empty"); box.textContent = (L[ids[0]] && L[ids[0]].num) || "·";
      Promise.all(Array.from(new Set(miss.map(id => L[id].ch))).map(thLoad)).then(() => { miss.forEach(id => { if (!(id in TH)) TH[id] = ""; }); if (box.isConnected) box.replaceWith(thumb(ids, cls)); });
      return box;
    }
    for (const id of ids) {
      const a = thSrc(id); if (!a) continue;
      const all = $$("figure.diagram svg.dg", a), wide = all.find(v => { const b = (v.getAttribute("viewBox") || "").split(/\s+/).map(Number); return b.length === 4 && b[2] >= b[3] * 1.1; }), svg = wide || all[0];
      if (svg) {
        const f = el("figure", "diagram"), c = svg.cloneNode(true);
        c.querySelectorAll("[id]").forEach(n => { if (!n.closest("defs")) n.removeAttribute("id"); });
        if (svg.id && svg.classList.contains("mm")) { const nid = svg.id + "t" + (++thumbN); c.querySelectorAll("style").forEach(s => { s.textContent = s.textContent.split("#" + svg.id).join("#" + nid); }); c.id = nid; } else c.removeAttribute("id");
        c.setAttribute("preserveAspectRatio", "xMidYMid meet"); c.removeAttribute("role");
        f.appendChild(c); box.appendChild(f); return box;
      }
      const img = $("figure.xfig img", a) || $('img[src^="repo-assets/"]', a) || $("img.run-fig", a);
      if (img) { const c = img.cloneNode(true); c.removeAttribute("id"); c.removeAttribute("class"); c.alt = ""; c.loading = "lazy"; box.appendChild(c); return box; }
      const sv = $$("svg.dg, svg.cs-arch, .lesson-figure svg[viewBox]", a).find(v => { const b = (v.getAttribute("viewBox") || "").split(/\s+/).map(Number); return b.length === 4 && b[2] >= 120 && b[2] < 5000; });
      if (sv) { const f = el("figure", "diagram"), c = sv.cloneNode(true); c.querySelectorAll("[id]").forEach(n => { if (!n.closest("defs")) n.removeAttribute("id"); }); c.removeAttribute("id"); c.setAttribute("preserveAspectRatio", "xMidYMid meet"); c.removeAttribute("role"); f.appendChild(c); box.appendChild(f); return box; }
    }
    if (!cls || cls.indexOf("via") < 0) {          // a cheat sheet has no figure of its own: use the lessons it covers
      const via = []; ids.forEach(id => { const a = L[id] && L[id].art; if (a) $$('a[href^="#a"]', a).forEach(x => { const t = x.getAttribute("href").slice(1); if (L[t] && via.indexOf(t) < 0) via.push(t); }); });
      if (via.length) { const b2 = thumb(via, (cls ? cls + " " : "") + "via"); b2.classList.remove("via"); if (!b2.classList.contains("empty")) return b2; }
    }
    box.classList.add("empty"); box.textContent = (L[ids[0]] && L[ids[0]].num) || "·";
    return box;
  }

  /* ---------- rail, search button, theme ---------- */
  const rail = el("nav", "dj-rail");
  rail.setAttribute("aria-label", "Sections");
  const NAV = [["home", "#home", "Home", "home"], ["curriculum", "#curriculum", "Curriculum", "grid"], ["interview", "#interview", "Interview prep", "chat"], ["playground", "#playground", "Playground", "lab"], ["review", "#review", "Review", "review"]];
  rail.innerHTML = '<a class="dj-logo" href="#home" aria-label="AI from Scratch, home">AI<span>·</span>S</a><div class="dj-icons">' +
    NAV.map(n => '<a class="dj-ic" data-k="' + n[0] + '" href="' + n[1] + '" aria-label="' + n[2] + '">' + ic(n[3]) + '<span class="dj-tip">' + n[2] + "</span></a>").join("") + "</div>";
  document.body.appendChild(rail);
  const tb2 = el("button", "dj-ic dj-theme2"); tb2.type = "button"; $(".dj-icons", rail).appendChild(tb2);

  const top = $(".topbar");
  const sb = el("button", "dj-search", ic("search") + "<span>Search lessons, sections, questions</span><kbd>⌘K</kbd>");
  sb.type = "button"; sb.setAttribute("aria-label", "Search");
  const brand = $(".brand", top); (brand || top.firstChild).after(sb);
  const tb = el("button", "dj-theme"); tb.type = "button";
  top.insertBefore(tb, $("#zx-mode") || $("#tb-progress"));
  const dark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; };
  function paintTheme() { const d = dark(); [tb, tb2].forEach(b => { b.innerHTML = ic(d ? "sun" : "moon"); b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); }); }
  const savedTheme = store.get("dj-theme", null); if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  const flip = () => { const t = dark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t); store.set("dj-theme", t); paintTheme(); if (pg.redraw) pg.redraw(); };
  tb.addEventListener("click", flip); tb2.addEventListener("click", flip);
  paintTheme();

  /* ---------- review queue (quick checks you miss come back after 1, 3 and 7 days) ---------- */
  const RKEY = "zero-to-agents-review-v1", GAPS = [1, 3, 7];
  let R = store.get(RKEY, { q: {}, learned: 0 });
  if (!R.q) R = { q: {}, learned: 0 };
  const saveR = () => { store.set(RKEY, R); badge(); };
  const due = () => Object.keys(R.q).filter(k => R.q[k].due <= Date.now() && document.getElementById(k));
  function grade(qid, ok, fromReview) {
    const e = R.q[qid];
    if (!ok) R.q[qid] = { b: 0, due: Date.now() + DAY, n: (e ? e.n : 0) + 1 };
    else if (e && fromReview) { const b = e.b + 1; if (b >= GAPS.length) { delete R.q[qid]; R.learned = (R.learned || 0) + 1; } else R.q[qid] = { b: b, due: Date.now() + GAPS[b] * DAY, n: e.n }; }
    saveR();
  }
  function badge() {
    const a = $('.dj-ic[data-k="review"]', rail); if (!a) return; let bd = $(".dj-badge", a); const n = due().length;
    if (!n) { if (bd) bd.remove(); return; } if (!bd) { bd = el("span", "dj-badge"); a.appendChild(bd); } bd.textContent = n;
  }
  document.addEventListener("click", e => {
    const o = e.target.closest && e.target.closest("article.module .q .opt");
    if (!o || o.disabled) return; const q = o.closest(".q"); if (!q || !q.id) return;
    grade(q.id, o.dataset.correct === "true", false);
  }, true);

  /* ---------- interview bank ---------- */
  const LEVEL = { Junior: "l1", Mid: "l2", Senior: "l3" };
  let QB = null;
  function bank() {
    if (QB) return QB;
    QB = [];
    $$("details.qa").forEach(d => {
      const lv = $(".qa-lvl", d), q = $(".qa-q", d), a = d.closest("article.module");
      if (!lv || !q || !a || lv.classList.contains("qa-sol") || /^Solution/.test(lv.textContent)) return;
      QB.push({ id: d.id, type: lv.textContent.trim(), q: q.textContent.trim(), lid: a.id, ch: L[a.id].ch });
    });
    return QB;
  }
  let TC = null; const tcls = t => { if (!TC) { TC = {}; typeCounts(bank()).forEach((x, i) => { TC[x[0]] = "t" + Math.min(i, 9); }); } return TC[t] || "l0"; };
  function typeCounts(list) { const c = {}; list.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]).map(k => [k, c[k]]); }

  /* ---------- home ---------- */
  const vh = $("#view-home");
  function augHome() {
    if (!vh.children.length || $(".dj-home", vh)) return;
    const kids = Array.from(vh.children), hero = $(".home-hero", vh), dash = $(".dash", vh), cta = dash && $(".dash-actions a.cta", dash);
    const grid = el("div", "dj-home"), hc = el("section", "dj-card dj-hero"), side = el("aside", "dj-side"), rest = el("div", "dj-rest");
    grid.setAttribute("data-dj", "1");
    if (hero) hc.appendChild(hero);
    const nxId = cta ? cta.getAttribute("href").slice(1) : arts[0].id, nx = L[nxId];
    hc.appendChild(el("div", "dj-btns", (cta ? '<a class="dj-btn dark" href="#' + nxId + '">' + esc(cta.textContent.split(":")[0].trim()) + "</a>" : "") +
      '<a class="dj-btn" href="#curriculum">Browse the curriculum</a><a class="dj-btn" href="#interview">Practise interview questions</a><a class="dj-btn" href="#playground">Open the playground</a>'));
    if (nx) {
      const st = el("div", "dj-start"), heads = $$(".prose > h2, .zx-stage", nx.art).length;
      const segN = Math.max(3, Math.min(10, $$(".zx-stage", nx.art).length || $$(".prose > h2", nx.art).length || 5));
      st.innerHTML = '<div><div class="dj-eyebrow">' + (cta && /Continue/.test(cta.textContent) ? "Pick up where you left off" : "Start here") + " · " + esc(CH[nx.ch] ? CH[nx.ch].label : "") + "</div><h3>" + esc(nx.title) + '</h3><div class="dj-segs">' + "<i></i>".repeat(segN) +
        '</div><div class="dj-meta">Lesson ' + esc(nx.num) + (nx.min ? " · " + nx.min + " min" : "") + '</div><div class="dj-btns"><a class="dj-btn dark" href="#' + nx.id + '">Open lesson</a><a class="dj-btn ghost" href="#' + nx.ch + '">Phase outline</a></div></div>';
      st.appendChild(thumb([nx.id].concat(CH[nx.ch] ? CH[nx.ch].lessons : [])));
      void heads; hc.appendChild(st);
    }
    let card = null;
    kids.forEach(k => {
      if (k === hero) return;
      if (k.classList.contains("home-h2")) { card = el("section", "dj-card"); rest.appendChild(card); card.appendChild(k); return; }
      if (k.classList.contains("part") || k.classList.contains("dash") || k.classList.contains("home-foot")) { card = null; rest.appendChild(k); return; }
      (card || rest).appendChild(k);
    });
    // side cards
    const dn = due().length, waiting = Object.keys(R.q).length;
    side.appendChild(el("section", "dj-card", '<h3 class="dj-h">' + ic("review").replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-2px;fill:none;stroke:currentColor;stroke-width:2;margin-right:6px"') + "Review</h3>" +
      '<p class="dj-sub">Quick checks you miss come back on the right day: after 1 day, then 3, then 7, until they stick.</p>' +
      '<div class="dj-boxes"><span><b>' + dn + "</b>due now</span><span><b>" + waiting + "</b>waiting</span><span><b>" + (R.learned || 0) + '</b>learned</span></div><div class="dj-btns" style="margin-top:14px"><a class="dj-btn dark" href="#review">' + (dn ? "Review " + dn + " now" : "Open review") + "</a></div>"));
    side.appendChild(el("section", "dj-card", '<div style="display:flex;gap:14px;align-items:center"><div class="dj-pg-art">' + nnIcon() + '</div><div><h3 class="dj-h">Playground</h3><p class="dj-sub">Train a neural network in your browser, and try all ' + $$("article.module figure.viz").length + ' labs from the lessons in one place.</p></div></div><a class="dj-btn block" style="margin-top:14px" href="#playground">Open the playground</a>'));
    const B = bank(), byCh = {}; B.forEach(x => { byCh[x.ch] = (byCh[x.ch] || 0) + 1; });
    const topCh = chOrder.filter(c => byCh[c]).sort((a, b) => byCh[b] - byCh[a]).slice(0, 4);
    const tc = typeCounts(B).slice(0, 4), mx = tc.length ? tc[0][1] : 1;
    side.appendChild(el("section", "dj-card", '<div style="display:flex;justify-content:space-between;align-items:baseline"><h3 class="dj-h">Interview prep</h3><small style="color:var(--muted)">' + Object.keys(byCh).length + (Object.keys(byCh).length === 1 ? ' phase' : ' phases') + '</small></div><div style="margin-top:10px"><span class="dj-big">' + B.length + "</span><span>questions with model answers</span></div>" +
      '<div class="dj-lvlbar">' + tc.map((t, i) => '<span class="dj-dot ' + tcls(t[0]) + '"></span><span>' + esc(t[0]) + "</span><span>" + t[1] + '</span><u><i style="width:' + (100 * t[1] / mx) + '%;background:var(--accent)"></i></u>').join("") + "</div>" +
      '<div style="margin-top:12px">' + topCh.map(c => '<a class="dj-mini-row" href="#interview" data-djch="' + c + '"><span>' + esc(CH[c].title) + "</span><small>" + byCh[c] + " questions ›</small></a>").join("") + '</div><a class="dj-btn block" style="margin-top:10px" href="#interview">Practise all ' + B.length + "</a>"));
    grid.append(hc, side, rest);
    vh.appendChild(grid);
    // chapter-card thumbnails
    $$(".ch-card", grid).forEach(c => { const id = (c.getAttribute("href") || "").slice(1); if (CH[id]) c.insertBefore(thumb(CH[id].lessons, "sm"), c.firstChild); });
  }
  function nnIcon() {
    let s = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">'; const r = mulberry(7);
    for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = i < 13 ? 5 + r() * 6 : 13 + r() * 5; s += '<circle cx="' + (20 + Math.cos(a) * d).toFixed(1) + '" cy="' + (20 + Math.sin(a) * d).toFixed(1) + '" r="1.8" fill="' + (i < 13 ? "#3f9b78" : "#d4683a") + '"/>'; }
    return s + "</svg>";
  }
  new MutationObserver(augHome).observe(vh, { childList: true });

  /* ---------- chapter page ---------- */
  const vc = $("#view-chapter");
  function augPhase() {
    if (!vc.children.length || vc.querySelector(".dj-thumb")) return;
    const head = $(".chv-head", vc), id = (location.hash || "").slice(1);
    if (head && CH[id]) head.appendChild(thumb(CH[id].lessons));
    $$(".les-row", vc).forEach(r => { const lid = (r.getAttribute("href") || "").slice(1); if (L[lid]) r.insertBefore(thumb([lid], "sm"), r.firstChild); });
  }
  new MutationObserver(augPhase).observe(vc, { childList: true }); augPhase(); window.addEventListener("hashchange", () => setTimeout(augPhase, 0));

  /* ---------- lessons: predict first ---------- */
  const PKEY = "zero-to-agents-predictions-v1", P = store.get(PKEY, {});
  function augLesson(art) {
    $$('.zx-excard[data-k="predict"]', art).forEach((card, i) => {
      if (card.dataset.dj) return; card.dataset.dj = "1";
      const btn = $(".zx-solbtn", card), sol = $(".zx-sol", card); if (!btn || !sol) return;
      const key = art.id + ":" + i, box = el("div", "dj-pred");
      const locked = txt => { box.innerHTML = '<div class="dj-pred-locked"><b>Your prediction</b>' + esc(txt) + "</div>"; card.classList.remove("dj-wait"); };
      if (P[key]) { locked(P[key]); card.insertBefore(box, sol); return; }
      card.classList.add("dj-wait");
      box.innerHTML = '<span class="dj-tag">Predict first</span><textarea placeholder="Write your guess in a line or two, then lock it in." aria-label="Your prediction"></textarea>' +
        '<div class="dj-btns"><button type="button" class="dj-btn dark" disabled>Lock in my prediction</button><button type="button" class="dj-skip">Skip and show the answer</button></div>';
      const ta = $("textarea", box), go = $(".dj-btn", box);
      ta.addEventListener("input", () => { go.disabled = ta.value.trim().length < 2; });
      go.addEventListener("click", () => { P[key] = ta.value.trim(); store.set(PKEY, P); locked(P[key]); if (!sol.classList.contains("open")) btn.click(); });
      $(".dj-skip", box).addEventListener("click", () => { card.classList.remove("dj-wait"); box.remove(); if (!sol.classList.contains("open")) btn.click(); });
      card.insertBefore(box, sol);
    });
    const qh = $("section.quiz .quiz-head", art);
    if (qh && !qh.nextElementSibling.classList.contains("dj-qnote")) qh.after(el("p", "dj-qnote dj-sub", "Any you miss go into your Review queue and come back after 1, 3 and 7 days."));
  }

  /* ---------- pages ---------- */
  const view = el("section", "view dj-view"); view.id = "dj-view"; view.hidden = true;
  $("#main").appendChild(view);
  let ivState = { ch: "", type: "", q: "", open: "" };
  function renderInterview() {
    const B = bank(), byCh = {}; B.forEach(x => { (byCh[x.ch] = byCh[x.ch] || []).push(x); });
    const chs = chOrder.filter(c => byCh[c]);
    if (!ivState.ch && !ivState.q) ivState.ch = chs[0];
    const qn = ivState.q.toLowerCase();
    let list = B.filter(x => (!qn || (x.q + " " + x.type).toLowerCase().indexOf(qn) >= 0) && (qn || x.ch === ivState.ch));
    const typesHere = typeCounts(list);
    if (ivState.type) list = list.filter(x => x.type === ivState.type);
    const groups = {}; list.forEach(x => { (groups[x.lid] = groups[x.lid] || []).push(x); });
    let h = '<div class="dj-3col"><nav class="dj-toc" aria-label="Phases"><h4>Phases</h4>' + chs.map(c => '<button type="button" data-ch="' + c + '" class="' + (c === ivState.ch && !qn ? "on" : "") + '"><span>' + esc(CH[c].code ? CH[c].code + " · " : "") + esc(CH[c].title) + "</span><small>" + byCh[c].length + "</small></button>").join("") + "</nav>";
    h += '<div><h1 class="dj-page-h">Interview prep</h1><p class="dj-sub">' + B.length + " questions across " + chs.length + " phases, each with a model answer. Say your answer out loud first, then open the model answer and compare.</p>" +
      '<div style="margin-top:16px"><input class="dj-input" id="dj-iv-q" type="search" placeholder="Search every question, e.g. KV cache" value="' + esc(ivState.q) + '" aria-label="Search interview questions"></div>' +
      '<div class="dj-chips" style="padding:12px 0 0"><button type="button" class="dj-chip' + (ivState.type ? "" : " on") + '" data-type="">All types</button>' + typesHere.map(t => '<button type="button" class="dj-chip' + (ivState.type === t[0] ? " on" : "") + '" data-type="' + esc(t[0]) + '"><span class="dj-dot ' + tcls(t[0]) + '"></span>' + esc(t[0]) + " <b>" + t[1] + "</b></button>").join("") + "</div>";
    if (!list.length) h += '<p class="dj-empty">No question matches that. Try fewer words.</p>';
    let n = 0;
    Object.keys(groups).forEach(lid => {
      const l = L[lid];
      h += '<div class="dj-group-h"><div class="dj-gt"></div><div><h3 class="dj-h">' + esc(l.title) + '</h3><p class="dj-sub">Lesson ' + esc(l.num) + " · " + groups[lid].length + ' questions · <a href="#' + lid + '">Read the lesson</a></p></div></div>';
      groups[lid].forEach(x => { n++;
        h += '<details class="dj-qcard" data-qid="' + x.id + '"' + (ivState.open === x.id ? " open" : "") + '><summary><span class="dj-qn">Q' + n + '</span><span><span class="dj-qmeta"><span class="dj-dot ' + tcls(x.type) + '"></span>' + esc(x.type) + '</span><span class="dj-qt">' + esc(x.q) + '</span></span><span class="dj-chev">' + ic("chev") + '</span></summary><div class="dj-qbody"></div></details>'; });
    });
    h += "</div>";
    const tcAll = typeCounts(list);
    h += '<aside class="dj-right"><div class="dj-card dj-statcard" style="position:sticky;top:72px"><div class="dj-tag">Practice</div><span class="dj-big">' + list.length + '</span><span style="margin-left:0">questions showing</span><div class="dj-lvlbar">' +
      tcAll.slice(0, 5).map(t => '<span class="dj-dot ' + tcls(t[0]) + '"></span><span>' + esc(t[0]) + "</span><span>" + t[1] + '</span><u><i style="width:' + (100 * t[1] / Math.max(1, list.length)) + '%;background:var(--accent)"></i></u>').join("") +
      '</div><button type="button" class="dj-btn dark block" id="dj-iv-rand" style="margin-top:16px">Random question</button><p class="dj-sub" style="margin-top:10px;font-size:.8rem">Answer out loud in a minute or two, then open the model answer and compare.</p></div></aside></div>';
    view.innerHTML = h;
    $$(".dj-group-h", view).forEach((g, i) => { const lid = Object.keys(groups)[i]; g.replaceChild(thumb([lid]), $(".dj-gt", g)); });
    $$(".dj-qcard", view).forEach(d => { d.addEventListener("toggle", () => { if (d.open) fillAnswer(d); }); if (d.open) { fillAnswer(d); setTimeout(() => d.scrollIntoView({ block: "center" }), 30); } });
    const qi = $("#dj-iv-q"); let t = null;
    qi.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { ivState.q = qi.value.trim(); ivState.type = ""; ivState.open = ""; renderInterview(); const n2 = $("#dj-iv-q"); n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); }, 220); });
    $$(".dj-toc button", view).forEach(b => b.addEventListener("click", () => { ivState = { ch: b.dataset.ch, type: "", q: "", open: "" }; renderInterview(); window.scrollTo(0, 0); }));
    $$(".dj-chip", view).forEach(b => b.addEventListener("click", () => { ivState.type = b.dataset.type; ivState.open = ""; renderInterview(); }));
    $("#dj-iv-rand").addEventListener("click", () => { const cs = $$(".dj-qcard", view); if (!cs.length) return; cs.forEach(c => { c.open = false; }); const c = cs[Math.floor(Math.random() * cs.length)]; c.open = true; c.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }
  function fillAnswer(d) {
    const body = $(".dj-qbody", d); if (body.children.length) return;
    const o = document.getElementById(d.dataset.qid); if (!o) return;
    const host = o.closest("article.module");
    if (host && host.dataset.stub && window.ZHydrate) { body.textContent = "Loading the model answer…"; window.ZHydrate(host.id).then(() => { body.textContent = ""; fillAnswer(d); }, () => { body.textContent = "The answer could not be loaded. Open the lesson instead."; }); return; }
    const a = $(".qa-a", o), c = (a || o).cloneNode(true);
    if (!a) { const s = $("summary", c); if (s) s.remove(); }
    c.removeAttribute("id"); c.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
    c.className = "prose-like prose"; c.style.padding = "0";
    const l = L[o.closest("article.module").id];
    body.appendChild(el("div", "dj-say", "Model answer. Compare it with what you said: the structure matters more than the wording."));
    body.appendChild(c);
    body.appendChild(el("p", "dj-sub", 'From <a href="#' + l.id + '">Lesson ' + esc(l.num) + " · " + esc(l.title) + "</a>"));
    if (window.hljs) c.querySelectorAll("pre code").forEach(x => { try { window.hljs.highlightElement(x); } catch (e) {} });
  }

  /* review page */
  let rvList = null, rvMode = "";
  function qData(id) {
    const q = document.getElementById(id); if (!q) return null; const t = $(".q-text", q).cloneNode(true); const nn = $(".q-num", t); if (nn) nn.remove();
    return { id: id, text: t.innerHTML, opts: $$(".opt", q).map(o => ({ html: ($$("span", o)[1] || o).innerHTML, ok: o.dataset.correct === "true" })), explain: ($(".q-explain", q) || {}).innerHTML || "", lid: q.closest("article.module").id };
  }
  function renderReview() {
    const d = due(), waiting = Object.keys(R.q).length;
    if (!rvList) { rvList = d.slice(); rvMode = "due"; }
    let h = '<div style="max-width:820px;margin:0 auto"><h1 class="dj-page-h">Review</h1><p class="dj-sub">Every quick check you get wrong in a lesson lands here. Get it right and it comes back after 3 days, then 7; after that it counts as learned. Miss it again and it starts over tomorrow.</p>' +
      '<div class="dj-boxes" style="margin-top:16px"><span><b>' + d.length + "</b>due now</span><span><b>" + waiting + "</b>in the queue</span><span><b>" + (R.learned || 0) + "</b>learned</span><span><b>" + $$("article.module .q").length + '</b>quick checks in the course</span></div>' +
      '<div class="dj-btns" style="margin-top:16px"><button type="button" class="dj-btn' + (rvMode === "due" ? " dark" : "") + '" data-rv="due">Due now (' + d.length + ')</button><button type="button" class="dj-btn' + (rvMode === "all" ? " dark" : "") + '" data-rv="all"' + (waiting ? "" : " disabled") + ">Everything in the queue (" + waiting + ')</button><button type="button" class="dj-btn' + (rvMode === "mix" ? " dark" : "") + '" data-rv="mix">Mixed practice: 10 from the whole course</button></div><div id="dj-rv-list"></div></div>';
    view.innerHTML = h;
    $$("[data-rv]", view).forEach(b => b.addEventListener("click", () => {
      rvMode = b.dataset.rv;
      if (rvMode === "due") rvList = due();
      else if (rvMode === "all") rvList = Object.keys(R.q).filter(k => document.getElementById(k));
      else { const all = $$("article.module .q").map(q => q.id).filter(Boolean); rvList = []; while (rvList.length < 10 && all.length) rvList.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]); }
      renderReview();
    }));
    const box = $("#dj-rv-list");
    if (!rvList.length) { box.innerHTML = '<p class="dj-empty">' + (rvMode === "due" ? (waiting ? "Nothing is due yet. The next ones come back " + whenNext() + "." : "Your queue is empty. Answer the quick checks at the end of each lesson, and any you miss will show up here.") : "Nothing here.") + "</p>"; return; }
    rvList.forEach((id, i) => {
      const q = qData(id); if (!q) return; const l = L[q.lid], card = el("div", "dj-rq");
      card.innerHTML = '<div class="dj-qmeta"><span class="dj-tag">Quick check ' + (i + 1) + " of " + rvList.length + '</span><span>· <a href="#' + l.id + '">Lesson ' + esc(l.num) + " · " + esc(l.title) + "</a></span>" + (R.q[id] ? "<span>· missed " + R.q[id].n + "×</span>" : "") + '</div><p class="q-text">' + q.text + '</p><div class="dj-opts">' +
        q.opts.map((o, k) => '<button type="button" class="dj-opt" data-k="' + k + '"><i>' + "ABCDEFG"[k] + "</i><span>" + o.html + "</span></button>").join("") + '</div><div class="dj-btns" style="margin-top:12px"><button type="button" class="dj-btn dark" disabled>Check answer</button></div>';
      let pick = -1; const chk = $(".dj-btn", card);
      $$(".dj-opt", card).forEach(b => b.addEventListener("click", () => { if (chk.dataset.done) return; pick = +b.dataset.k; $$(".dj-opt", card).forEach(x => x.classList.toggle("pick", x === b)); chk.disabled = false; }));
      chk.addEventListener("click", () => {
        if (pick < 0 || chk.dataset.done) return; chk.dataset.done = "1"; const ok = q.opts[pick].ok;
        $$(".dj-opt", card).forEach((x, k) => { x.classList.remove("pick"); if (q.opts[k].ok) x.classList.add("right"); else if (k === pick) x.classList.add("wrong"); x.disabled = true; });
        grade(id, ok, rvMode !== "mix" || !!R.q[id]);
        const e = R.q[id];
        chk.replaceWith(el("div", "dj-explain", "<b>" + (ok ? "Right." : "Not quite.") + "</b> " + q.explain + '<div class="dj-sub" style="margin-top:6px">' + (e ? "Comes back " + rel(e.due) + "." : ok && rvMode !== "mix" ? "Learned. It leaves the queue." : ok ? "" : "") + "</div>"));
      });
      box.appendChild(card);
    });
  }
  const rel = t => { const d = Math.round((t - Date.now()) / DAY); return d <= 0 ? "today" : d === 1 ? "tomorrow" : "in " + d + " days"; };
  function whenNext() { const ts = Object.keys(R.q).map(k => R.q[k].due).sort((a, b) => a - b); return ts.length ? rel(ts[0]) : "soon"; }

  /* playground */
  const pg = {};
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dataset(kind, seed) {
    const r = mulberry(seed), pts = [], g = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 1.2; };
    for (let i = 0; i < 240; i++) {
      let x, y, c;
      if (kind === "xor") { x = r() * 2 - 1; y = r() * 2 - 1; if (Math.abs(x) < .06 || Math.abs(y) < .06) { i--; continue; } c = x * y > 0 ? 1 : 0; }
      else if (kind === "circle") { const rr = i % 2 ? r() * .45 : .62 + r() * .3, a = r() * 6.283; x = Math.cos(a) * rr; y = Math.sin(a) * rr; c = i % 2; }
      else if (kind === "blobs") { c = i % 2; x = (c ? .45 : -.45) + g() * .22; y = (c ? .35 : -.35) + g() * .22; }
      else { c = i % 2; const t = (i >> 1) / 120 * 3.2 + .25, a = t * 2.2 + c * Math.PI; x = Math.cos(a) * t * .28 + g() * .03; y = Math.sin(a) * t * .28 + g() * .03; }
      pts.push([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)), c]);
    }
    return pts;
  }
  function makeNet(sizes, seed) {
    const r = mulberry(seed), W = [], B = [];
    for (let l = 1; l < sizes.length; l++) { const s = Math.sqrt(1 / sizes[l - 1]) * 1.6; W.push(Array.from({ length: sizes[l] }, () => Array.from({ length: sizes[l - 1] }, () => (r() * 2 - 1) * s))); B.push(Array.from({ length: sizes[l] }, () => (r() * 2 - 1) * .1)); }
    return { sizes, W, B };
  }
  function forward(n, x) {
    const acts = [x];
    for (let l = 0; l < n.W.length; l++) { const prev = acts[l], out = n.W[l].map((w, j) => { let s = n.B[l][j]; for (let k = 0; k < w.length; k++) s += w[k] * prev[k]; return l === n.W.length - 1 ? 1 / (1 + Math.exp(-s)) : Math.tanh(s); }); acts.push(out); }
    return acts;
  }
  function epoch(n, pts, lr) {
    const gW = n.W.map(m => m.map(r => r.map(() => 0))), gB = n.B.map(b => b.map(() => 0)); let loss = 0, right = 0;
    pts.forEach(p => {
      const acts = forward(n, [p[0], p[1]]), y = acts[acts.length - 1][0], t = p[2];
      loss += -(t * Math.log(y + 1e-9) + (1 - t) * Math.log(1 - y + 1e-9)); if ((y > .5) === (t === 1)) right++;
      let delta = [y - t];
      for (let l = n.W.length - 1; l >= 0; l--) {
        const prev = acts[l]; delta.forEach((d, j) => { gB[l][j] += d; for (let k = 0; k < prev.length; k++) gW[l][j][k] += d * prev[k]; });
        if (l > 0) delta = prev.map((a, k) => { let s = 0; delta.forEach((d, j) => { s += d * n.W[l][j][k]; }); return s * (1 - a * a); });
      }
    });
    const m = pts.length;
    n.W.forEach((M, l) => M.forEach((r, j) => r.forEach((_, k) => { r[k] -= lr * gW[l][j][k] / m; })));
    n.B.forEach((b, l) => b.forEach((_, j) => { b[j] -= lr * gB[l][j] / m; }));
    return { loss: loss / m, acc: right / m };
  }
  function renderPlayground() {
    const vizzes = $$("article.module figure.viz");
    view.innerHTML = '<h1 class="dj-page-h">Playground</h1><p class="dj-sub">Learn by poking at things. Everything here runs in your browser, with no setup and no code.</p>' +
      '<section class="dj-card" style="margin-top:16px"><div class="dj-eyebrow">Neural network trainer</div><h2 class="dj-h" style="font-size:1.3rem;margin-top:4px">Watch a small network learn to separate two colours</h2><p class="dj-sub">Each dot is a training example. The shading is what the network currently predicts for every point on the square. Press Train and watch gradient descent bend the boundary. The ideas behind it are in <a href="#l2401">Lesson ' + esc((L.l2401 || {}).num || "") + ' · Neurons and layers</a> and <a href="#l2302">' + esc((L.l2302 || {}).title || "Fitting a line with gradient descent") + "</a>.</p>" +
      '<div class="dj-lab" style="margin-top:16px"><div class="dj-canvas-wrap"><canvas id="dj-nn" width="720" height="720" aria-label="Decision boundary and training points"></canvas><canvas id="dj-loss" width="720" height="150" aria-label="Loss curve"></canvas><div class="dj-stats" id="dj-nn-stats"></div></div>' +
      '<div class="dj-ctl"><div><div class="dj-sub" style="margin:0 0 6px;font-weight:600;color:var(--ink)">Data</div><div class="dj-chips" style="padding:0" id="dj-ds"></div></div>' +
      '<label><span>Hidden neurons per layer <em id="dj-hv"></em></span><input type="range" id="dj-h" min="1" max="8" step="1"></label>' +
      '<label><span>Hidden layers <em id="dj-lv"></em></span><input type="range" id="dj-l" min="1" max="3" step="1"></label>' +
      '<label><span>Learning rate <em id="dj-rv"></em></span><input type="range" id="dj-r" min="0" max="100" step="1"></label>' +
      '<div class="dj-btns"><button type="button" class="dj-btn dark" id="dj-go">Train</button><button type="button" class="dj-btn" id="dj-step">One step</button><button type="button" class="dj-btn" id="dj-reset">New weights</button></div>' +
      '<p class="dj-sub" id="dj-arch" style="margin:0"></p></div></div>' +
      '<h3 class="dj-h" style="margin-top:22px">Things to try</h3><div class="dj-try" id="dj-try"></div></section>' +
      '<section class="dj-card"><div class="dj-eyebrow">From the lessons</div><h2 class="dj-h" style="font-size:1.3rem;margin-top:4px">All ' + vizzes.length + ' labs in one place</h2><p class="dj-sub">These are the interactive figures inside the lessons. Pick one to play with it here, or open its lesson for the full explanation.</p><div id="dj-stage" class="dj-stage" style="margin-top:14px"></div><div class="dj-labgrid" id="dj-labs"></div></section>';
    // trainer
    const S = { ds: "xor", h: 4, l: 1, lr: .5, run: false, ep: 0, hist: [], seed: 3 };
    const lrOf = v => +(0.01 * Math.pow(300, v / 100)).toFixed(3), vOf = lr => Math.round(100 * Math.log(lr / 0.01) / Math.log(300));
    let pts = dataset(S.ds, 11), net = null, last = { loss: 0, acc: 0 }, raf = 0;
    const cv = $("#dj-nn"), cx = cv.getContext("2d"), lc = $("#dj-loss"), lx = lc.getContext("2d");
    function reset() { S.seed++; net = makeNet([2].concat(Array(S.l).fill(S.h)).concat([1]), S.seed); S.ep = 0; S.hist = []; last = epoch(cloneNet(net), pts, 0); draw(); }
    function cloneNet(n) { return { sizes: n.sizes, W: n.W.map(m => m.map(r => r.slice())), B: n.B.map(b => b.slice()) }; }
    function col(p, d) { const A = d ? [212, 104, 58] : [226, 132, 92], Bc = d ? [63, 155, 120] : [86, 170, 136], bg = d ? [29, 26, 22] : [250, 247, 242]; const t = Math.abs(p - .5) * 2 * (d ? .55 : .6), c = p > .5 ? Bc : A; return "rgb(" + c.map((v, i) => Math.round(bg[i] + (v - bg[i]) * t)).join(",") + ")"; }
    function draw() {
      const d = dark(), N = 48, W = cv.width, cs = W / N;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = (i + .5) / N * 2 - 1, y = 1 - (j + .5) / N * 2, a = forward(net, [x, y]); cx.fillStyle = col(a[a.length - 1][0], d); cx.fillRect(i * cs, j * cs, cs + 1, cs + 1); }
      pts.forEach(p => { cx.beginPath(); cx.arc((p[0] + 1) / 2 * W, (1 - p[1]) / 2 * W, 7, 0, 6.283); cx.fillStyle = p[2] ? (d ? "#6fcf98" : "#2f7d55") : (d ? "#f0915f" : "#b5521b"); cx.fill(); cx.lineWidth = 2; cx.strokeStyle = d ? "#13110e" : "#ffffff"; cx.stroke(); });
      const H = lc.height, Wl = lc.width; lx.clearRect(0, 0, Wl, H); lx.fillStyle = d ? "#1d1a16" : "#ffffff"; lx.fillRect(0, 0, Wl, H);
      if (S.hist.length > 1) { const mx = Math.max(.8, Math.max.apply(null, S.hist)); lx.beginPath(); S.hist.forEach((v, i) => { const x = 10 + i / (S.hist.length - 1) * (Wl - 20), y = H - 12 - v / mx * (H - 30); i ? lx.lineTo(x, y) : lx.moveTo(x, y); }); lx.strokeStyle = d ? "#f0915f" : "#b5521b"; lx.lineWidth = 3; lx.stroke(); }
      lx.fillStyle = d ? "#a99f90" : "#6c6357"; lx.font = "600 22px ui-monospace, monospace"; lx.fillText("loss over training", 14, 26);
      $("#dj-nn-stats").innerHTML = "<span>epoch <b>" + S.ep + "</b></span><span>loss <b>" + last.loss.toFixed(3) + "</b></span><span>accuracy <b>" + Math.round(last.acc * 100) + "%</b></span><span>parameters <b>" + net.W.reduce((a, m, l) => a + m.length * m[0].length + net.B[l].length, 0) + "</b></span>";
    }
    pg.redraw = () => { if ($("#dj-nn") === cv && net) draw(); };
    function tick() { if (!document.body.contains(cv)) return stop(); for (let i = 0; i < 6; i++) { last = epoch(net, pts, S.lr); S.ep++; if (S.ep % 2 === 0) S.hist.push(last.loss); if (S.hist.length > 600) S.hist = S.hist.filter((_, k) => k % 2 === 0); } draw(); if (S.run && document.body.contains(cv)) raf = requestAnimationFrame(tick); else stop(); }
    function stop() { S.run = false; cancelAnimationFrame(raf); const g = $("#dj-go"); if (g) g.textContent = "Train"; }
    function sync() {
      $("#dj-h").value = S.h; $("#dj-hv").textContent = S.h; $("#dj-l").value = S.l; $("#dj-lv").textContent = S.l; $("#dj-r").value = vOf(S.lr); $("#dj-rv").textContent = S.lr;
      $("#dj-ds").innerHTML = [["xor", "XOR corners"], ["circle", "Circle"], ["blobs", "Two blobs"], ["spiral", "Spiral"]].map(x => '<button type="button" class="dj-chip' + (S.ds === x[0] ? " on" : "") + '" data-ds="' + x[0] + '">' + x[1] + "</button>").join("");
      $("#dj-arch").textContent = "Shape: 2 inputs → " + Array(S.l).fill(S.h).join(" → ") + " → 1 output (tanh hidden layers, sigmoid output, cross-entropy loss, full-batch gradient descent).";
      $$("#dj-ds .dj-chip").forEach(b => b.addEventListener("click", () => { S.ds = b.dataset.ds; pts = dataset(S.ds, 11); stop(); sync(); reset(); }));
    }
    $("#dj-h").addEventListener("input", e => { S.h = +e.target.value; stop(); sync(); reset(); });
    $("#dj-l").addEventListener("input", e => { S.l = +e.target.value; stop(); sync(); reset(); });
    $("#dj-r").addEventListener("input", e => { S.lr = lrOf(+e.target.value); $("#dj-rv").textContent = S.lr; });
    $("#dj-go").addEventListener("click", () => { if (S.run) return stop(); S.run = true; $("#dj-go").textContent = "Pause"; raf = requestAnimationFrame(tick); });
    $("#dj-step").addEventListener("click", () => { stop(); last = epoch(net, pts, S.lr); S.ep++; S.hist.push(last.loss); draw(); });
    $("#dj-reset").addEventListener("click", () => { stop(); reset(); });
    const TRY = [
      ["One neuron cannot do XOR", "XOR needs two cuts. With one hidden neuron the boundary is a single line, so accuracy stalls near 75%.", { ds: "xor", h: 1, l: 1, lr: .5 }],
      ["Three neurons crack it", "Give the hidden layer three neurons and the same data becomes easy. Hidden units are what let a network bend its boundary.", { ds: "xor", h: 3, l: 1, lr: .5 }],
      ["A learning rate that is too big", "At 3.0 each step overshoots: watch the loss curve jump around instead of sliding down.", { ds: "circle", h: 4, l: 1, lr: 3 }],
      ["A learning rate that is too small", "At 0.01 every step is tiny. The network is learning, just far too slowly to notice.", { ds: "circle", h: 4, l: 1, lr: .01 }],
      ["Depth for a spiral", "Two interleaved spirals defeat one small layer. Stack three layers of eight and give it time.", { ds: "spiral", h: 8, l: 3, lr: .3 }],
      ["Easy data, tiny model", "Two separate blobs need only one neuron: one straight line is the whole answer.", { ds: "blobs", h: 1, l: 1, lr: .5 }]
    ];
    $("#dj-try").innerHTML = TRY.map((t, i) => '<button type="button" data-i="' + i + '"><b>' + esc(t[0]) + "</b>" + esc(t[1]) + "</button>").join("");
    $$("#dj-try button").forEach(b => b.addEventListener("click", () => { const c = TRY[+b.dataset.i][2]; stop(); Object.assign(S, c); pts = dataset(S.ds, 11); sync(); reset(); S.run = true; $("#dj-go").textContent = "Pause"; raf = requestAnimationFrame(tick); cv.scrollIntoView({ block: "center", behavior: "smooth" }); }));
    sync(); reset();
    // labs from lessons
    const grid = $("#dj-labs");
    vizzes.forEach((f, i) => {
      const a = f.closest("article.module"), l = L[a.id], b = el("button", "dj-labcard"); b.type = "button";
      const th = el("div", "dj-thumb"), s = $("svg", f);
      if (s) { const fig = el("figure", "diagram"), c = s.cloneNode(true); c.removeAttribute("id"); c.querySelectorAll("[id]").forEach(n => n.removeAttribute("id")); fig.appendChild(c); th.appendChild(fig); }
      b.appendChild(th); b.appendChild(el("b", "", esc(($(".viz-head", f) || {}).textContent || "Lab"))); b.appendChild(el("small", "", "Lesson " + esc(l.num) + " · " + esc(l.title)));
      b.addEventListener("click", () => openLab(f, l, i, b)); grid.appendChild(b);
    });
  }
  let labN = 0;
  function openLab(f, l, i, card) {
    const stage = $("#dj-stage"), sc = f.nextElementSibling;
    $$(".dj-labcard").forEach(c => c.classList.toggle("on", c === card));
    stage.innerHTML = "";
    const c = f.cloneNode(true), nid = "dj-lab-" + (++labN);
    $("svg", c) && ($("svg", c).innerHTML = ""); const ctl = $(".viz-ctl", c), out = $(".viz-out", c); if (ctl) ctl.innerHTML = ""; if (out) out.innerHTML = "";
    c.id = nid; c.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
    const wrap = el("div", "dj-card"); wrap.style.background = "var(--surface-2)"; wrap.appendChild(c);
    wrap.appendChild(el("p", "dj-sub", 'This lab is from <a href="#' + l.id + '">Lesson ' + esc(l.num) + " · " + esc(l.title) + "</a>, which explains what you are seeing."));
    stage.appendChild(wrap);
    if (sc && sc.tagName === "SCRIPT") { const s = document.createElement("script"); s.textContent = sc.textContent.split(f.id).join(nid); stage.appendChild(s); }
    wrap.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* ---------- command search ---------- */
  const K = el("div", "dj-k"); K.hidden = true; K.setAttribute("role", "dialog"); K.setAttribute("aria-label", "Search");
  K.innerHTML = '<div class="dj-kbox"><div class="dj-kin">' + ic("search") + '<input type="search" placeholder="Search lessons, sections, interview questions, labs" aria-label="Search"><kbd>Esc</kbd></div><div class="dj-klist"></div><div class="dj-kfoot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>/</kbd> or <kbd>⌘K</kbd> to search anywhere</span></div></div>';
  document.body.appendChild(K);
  const kin = $("input", K), klist = $(".dj-klist", K);
  let IDX = null, kSel = 0, kItems = [], TXT = null;
  function buildIdx() {
    IDX = [];
    Object.keys(L).forEach(id => { const l = L[id]; IDX.push({ g: "Lessons", k: l.num, t: l.title, s: CH[l.ch] ? CH[l.ch].label : "", go: "#" + id }); });
    Object.keys(L).forEach(id => { $$("h2, h3", L[id].art).forEach(h => { if (h.closest(".quiz-head, .zx-ui, .dj-pred")) return; const t = h.textContent.trim(); if (t.length > 2) IDX.push({ g: "Sections", k: L[id].num, t: t, s: L[id].title, go: "#" + id, h: h }); }); });
    bank().forEach(x => IDX.push({ g: "Interview questions", k: x.type.split(" ")[0], t: x.q, s: "Lesson " + L[x.lid].num, iv: x }));
    $$("article.module figure.viz").forEach(f => { const l = L[f.closest("article.module").id]; IDX.push({ g: "Labs", k: "Lab", t: ($(".viz-head", f) || {}).textContent || "", s: "Lesson " + l.num + " · " + l.title, go: "#" + l.id }); });
    [["Interview prep", "#interview"], ["Playground", "#playground"], ["Review", "#review"], ["Curriculum", "#curriculum"]].forEach(p => IDX.push({ g: "Pages", k: "Page", t: p[0], s: "", go: p[1] }));
  }
  const SUGG = ["KV cache", "tool calling", "MCP", "RAG evaluation", "LangGraph", "guardrails", "embeddings", "prompt injection"];
  function kRender() {
    if (!IDX) buildIdx();
    const q = kin.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    if (!words.length) {
      klist.innerHTML = '<div class="dj-kgroup">Try</div><div class="dj-chips">' + SUGG.map(s => '<button type="button" class="dj-chip" data-s="' + s + '">' + s + "</button>").join("") + '</div><div class="dj-kgroup">Go to</div>' +
        ["Interview prep|#interview", "Playground|#playground", "Review|#review", "Curriculum|#curriculum"].map(x => { const p = x.split("|"); return '<a class="dj-kit" href="' + p[1] + '"><small>Page</small><span>' + p[0] + "</span></a>"; }).join("");
      $$(".dj-chip", klist).forEach(b => b.addEventListener("click", () => { kin.value = b.dataset.s; kRender(); kin.focus(); }));
      kItems = $$(".dj-kit", klist); kSel = 0; mark(); return;
    }
    const score = it => { const t = it.t.toLowerCase(), all = (t + " " + it.s).toLowerCase(); if (!words.every(w => all.indexOf(w) >= 0)) return -1; return (t.indexOf(q) >= 0 ? 4 : 0) + (t.indexOf(q) === 0 ? 2 : 0) + words.filter(w => t.indexOf(w) >= 0).length; };
    const hits = IDX.map(it => [score(it), it]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0]);
    const order = ["Pages", "Lessons", "Sections", "Labs", "Interview questions"], by = {};
    hits.forEach(x => { (by[x[1].g] = by[x[1].g] || []).push(x[1]); });
    let h = "", n = 0;
    order.forEach(g => { if (!by[g]) return; h += '<div class="dj-kgroup">' + g + " · " + by[g].length + "</div>"; by[g].slice(0, g === "Interview questions" ? 6 : 8).forEach(it => { h += '<a class="dj-kit" href="' + (it.go || "#interview") + '" data-n="' + (n++) + '"><small>' + esc(it.k) + "</small><span>" + esc(it.t) + (it.s ? "<em>" + esc(it.s) + "</em>" : "") + "</span></a>"; kItems.push(it); }); });
    const flat = []; order.forEach(g => { if (by[g]) by[g].slice(0, g === "Interview questions" ? 6 : 8).forEach(it => flat.push(it)); });
    // full-text fallback: lessons that mention the words in their body
    if (!TXT) { TXT = {}; Object.keys(L).forEach(id => { TXT[id] = L[id].art.textContent.replace(/\s+/g, " "); }); }
    const body = Object.keys(L).filter(id => { const t = TXT[id].toLowerCase(); return t.indexOf(q) >= 0; }).slice(0, 8);
    if (body.length) { h += '<div class="dj-kgroup">Mentioned inside lessons</div>'; body.forEach(id => { const t = TXT[id], p = t.toLowerCase().indexOf(q), a = Math.max(0, p - 50); h += '<a class="dj-kit" href="#' + id + '" data-n="' + (n++) + '"><small>' + esc(L[id].num) + "</small><span>" + esc(L[id].title) + "<em>…" + esc(t.slice(a, p)) + "<b>" + esc(t.slice(p, p + q.length)) + "</b>" + esc(t.slice(p + q.length, p + q.length + 70)) + "…</em></span></a>"; flat.push({ go: "#" + id, txt: q }); }); }
    klist.innerHTML = h || '<p class="dj-empty">Nothing matches. Try fewer or different words.</p>';
    kItems = $$(".dj-kit", klist); kItems.forEach((a, i) => { a._it = flat[i]; }); kSel = 0; mark();
  }
  function mark() { kItems.forEach((a, i) => a.classList.toggle("sel", i === kSel)); const s = kItems[kSel]; if (s) s.scrollIntoView({ block: "nearest" }); }
  function kOpen() { K.hidden = false; kin.value = ""; kRender(); setTimeout(() => kin.focus(), 0); }
  function kClose() { K.hidden = true; }
  function kGo(a) {
    const it = a._it; kClose();
    if (it && it.iv) { ivState = { ch: it.iv.ch, type: "", q: "", open: it.iv.id }; if (location.hash === "#interview") djRoute(); else location.hash = "interview"; return; }
    const href = a.getAttribute("href"); if (location.hash !== href) location.hash = href.slice(1); else djRoute();
    if (it && (it.h || it.txt)) (window.ZHydrate ? window.ZHydrate(href.slice(1)) : Promise.resolve()).then(() => new Promise(r => setTimeout(r, 160))).then(() => {
      const art = $(href); if (!art) return; let tg = it.h && it.h.isConnected && art.contains(it.h) ? it.h : null;
      if (!tg && it.h) { const want = it.h.textContent.trim(); tg = $$("h2, h3", art).find(x => x.textContent.trim() === want && !x.closest(".stub-meta")) || null; }
      if (!tg && it.txt) { const w = document.createTreeWalker(art, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.toLowerCase().indexOf(it.txt) >= 0 && !n.parentNode.closest(".zx-ui")) { tg = n.parentNode; break; } }
      if (!tg) return; const st = tg.closest(".zx-stage");
      if (st && st.hidden) { const b = $('.zx-step[data-i="' + st.dataset.i + '"]', art) || $('.zx-seg button[data-i="' + st.dataset.i + '"]', art); if (b) b.click(); }
      setTimeout(() => { tg.scrollIntoView({ block: "center" }); tg.classList.add("flash"); setTimeout(() => tg.classList.remove("flash"), 1800); }, 60);
    });
  }
  sb.addEventListener("click", kOpen);
  K.addEventListener("click", e => { if (e.target === K) return kClose(); const a = e.target.closest(".dj-kit"); if (a) { e.preventDefault(); kGo(a); } });
  let kt = null; kin.addEventListener("input", () => { clearTimeout(kt); kt = setTimeout(kRender, 120); });
  kin.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); kSel = Math.min(kItems.length - 1, kSel + 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); kSel = Math.max(0, kSel - 1); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); if (kItems[kSel]) kGo(kItems[kSel]); }
    else if (e.key === "Escape") kClose();
  });
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); K.hidden ? kOpen() : kClose(); return; }
    if (e.key === "/" && K.hidden && !(e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"))) { e.preventDefault(); kOpen(); }
    if (e.key === "Escape" && !K.hidden) kClose();
  });

  /* ---------- routing for the new pages ---------- */
  const PAGES = { interview: [renderInterview, "Interview prep"], playground: [renderPlayground, "Playground"], review: [renderReview, "Review"] };
  function djRoute() {
    const id = (location.hash || "").slice(1), page = PAGES[id];
    const kind = page ? "page" : L[id] ? "lesson" : CH[id] ? "chapter" : "home";
    document.body.classList.toggle("dj-wide", kind !== "lesson");
    const k = page ? id : kind === "home" ? (id === "curriculum" ? "curriculum" : "home") : "curriculum";
    $$(".dj-ic", rail).forEach(a => { a.classList.toggle("on", a.dataset.k === k); if (a.dataset.k === k) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (page) {
      $("#view-home").hidden = true; $("#view-chapter").hidden = true; $("#lesson-wrap").hidden = true; view.hidden = false;
      if (id !== "review") rvList = null; if (id === "review") { rvList = null; }
      page[0](); $("#tb-where").textContent = page[1]; document.title = page[1] + " · AI from Scratch"; window.scrollTo(0, 0);
    } else {
      view.hidden = true; if (view.innerHTML) { view.innerHTML = ""; }
      if (kind === "lesson") augLesson(L[id].art);
      if (kind === "home") augHome();
      if (id === "curriculum") setTimeout(() => { const p = $("#view-home .part"); if (p) window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - 76); }, 40);
    }
  }
  window.addEventListener("hashchange", djRoute);
  document.addEventListener("click", e => { const a = e.target.closest && e.target.closest("[data-djch]"); if (a) ivState = { ch: a.dataset.djch, type: "", q: "", open: "" }; });
  badge(); djRoute();
  window.DJ = { bank: bank, R: () => R, route: djRoute };
})();

/* Motion layer for every diagram in the course. When a diagram first scrolls into view it builds itself:
   boxes rise in, arrows draw, and a dot travels each arrow, in the order the diagram was drawn (or in the beats an
   isometric plate declares with data-b). Each diagram gets Replay and Step through (one part highlighted, the rest
   greyed, Back and Next). Reduced-motion readers get the still picture and can still step through. */
(function () {
  "use strict";
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const isArrow = n => (n.tagName === "path" || n.tagName === "line" || n.tagName === "polyline") && (n.hasAttribute("marker-end") || n.hasAttribute("marker-start"));
  const isText = n => n.tagName === "text" || (n.tagName === "a" && n.querySelector && n.querySelector("text") && !n.querySelector("rect,circle,path"));
  const MAXB = 12;

  function beats(svg) {
    const kids = Array.from(svg.children).filter(n => n.tagName !== "defs" && n.tagName !== "title" && n.tagName !== "desc" && n.tagName !== "style");
    if (svg.classList.contains("mm")) {                   // a Mermaid diagram: boxes first, then the arrows and their labels
      const nodes = Array.from(svg.querySelectorAll("g.cluster, g.node, g.actor, g.note"));
      const edges = Array.from(svg.querySelectorAll("path.flowchart-link, g.edgePaths > path, g.edgeLabels > g, g.edgeLabel, line.messageLine0, line.messageLine1, text.messageText"));
      if (nodes.length + edges.length < 3) return [];
      const flow = mmFlow(svg);
      if (flow) { if (flow.length > MAXB) { const k = Math.ceil(flow.length / MAXB), m = []; for (let i = 0; i < flow.length; i += k) m.push({ nodes: [].concat.apply([], flow.slice(i, i + k).map(b => b.nodes)) }); return m; } return flow; }
      const out = nodes.map(n => ({ nodes: [n] }));
      const per = Math.max(1, Math.ceil(edges.length / 4));
      for (let i = 0; i < edges.length; i += per) out.push({ nodes: edges.slice(i, i + per) });
      if (out.length > MAXB) { const k = Math.ceil(out.length / MAXB), m = []; for (let i = 0; i < out.length; i += k) m.push({ nodes: [].concat.apply([], out.slice(i, i + k).map(b => b.nodes)) }); return m; }
      return out;
    }
    if (svg.querySelector("[data-b]")) {
      const m = {}; kids.forEach(n => { const b = +(n.getAttribute("data-b") || 0); (m[b] = m[b] || []).push(n); });
      return Object.keys(m).map(Number).sort((a, b) => a - b).map(k => ({ base: k === 0, nodes: m[k], n: k }));
    }
    const out = []; let cur = null, kind = "", box = null;
    const bb = n => { try { const b = n.getBBox(); return b.width || b.height ? b : null; } catch (e) { return null; } };
    const inside = (b, o) => b && o && b.x >= o.x - 1 && b.y >= o.y - 1 && b.x + b.width <= o.x + o.width + 1 && b.y + b.height <= o.y + o.height + 1;
    kids.forEach(n => {
      const k = isArrow(n) ? "arrow" : isText(n) ? "text" : "shape";
      if (k === "text") { if (!cur) { cur = { nodes: [] }; out.push(cur); kind = "shape"; } cur.nodes.push(n); return; }
      if (k === "shape") {
        const b = bb(n);
        if (cur && kind === "shape" && box && inside(b, box)) { cur.nodes.push(n); return; }
        if (cur && kind === "shape" && !cur.nodes.some(isText) && !box) { cur.nodes.push(n); box = b; return; }
        cur = { nodes: [n] }; out.push(cur); kind = "shape"; box = b; return;
      }
      if (!cur || kind !== "arrow") { cur = { nodes: [] }; out.push(cur); kind = "arrow"; box = null; }
      cur.nodes.push(n);
    });
    // a backdrop drawn first (a frame covering most of the picture) stays as the base
    const vb = svg.viewBox && svg.viewBox.baseVal, f0 = out[0] && bb(out[0].nodes[0]);
    if (vb && f0 && out.length > 2 && f0.width * f0.height > 0.5 * vb.width * vb.height) out[0].base = true;
    // merge down to at most MAXB beats
    const moving = out.filter(b => !b.base), base = out.filter(b => b.base);
    if (moving.length > MAXB) {
      const per = Math.ceil(moving.length / MAXB), merged = [];
      for (let i = 0; i < moving.length; i += per) merged.push({ nodes: [].concat.apply([], moving.slice(i, i + per).map(b => b.nodes)) });
      return base.concat(merged);
    }
    return base.concat(moving);
  }

  function arrowsIn(nodes) { const a = []; nodes.forEach(n => { if (isArrow(n)) a.push(n); else if (n.querySelectorAll) n.querySelectorAll("path, line, polyline").forEach(x => { if (isArrow(x)) a.push(x); }); }); return a; }
  function travel(svg, path, ms) {
    let len = 0; try { len = path.getTotalLength(); } catch (e) { return; } if (!len) return;
    const dot = document.createElementNS(NS, "circle"); dot.setAttribute("r", "4.5"); dot.setAttribute("class", "mo-dot"); svg.appendChild(dot);
    const t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, p = path.getPointAtLength(e * len);
      dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); dot.style.opacity = k > .85 ? (1 - k) / .15 : 1;
      if (k < 1) requestAnimationFrame(step); else dot.remove(); })(t0);
  }
  function drawArrow(svg, a, delay) {
    let len = 0; try { len = a.getTotalLength(); } catch (e) {}
    const dashed = /\b(d|dash)\b/.test(a.getAttribute("class") || "") || a.getAttribute("stroke-dasharray");
    const mk = a.getAttribute("marker-end");
    if (len && !dashed) {
      if (mk) { a.setAttribute("data-mo-mk", mk); a.removeAttribute("marker-end"); }
      a.style.strokeDasharray = len; a.style.strokeDashoffset = len;
      const an = a.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 520, delay: delay, easing: "ease-out", fill: "forwards" });
      an.onfinish = () => { a.style.strokeDasharray = ""; a.style.strokeDashoffset = ""; an.cancel(); if (a.hasAttribute("data-mo-mk")) { a.setAttribute("marker-end", a.getAttribute("data-mo-mk")); a.removeAttribute("data-mo-mk"); } travel(svg, a, 700); };
    } else { a.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: delay, fill: "backwards" }); setTimeout(() => travel(svg, a, 700), delay + 300); }
  }

  // A Mermaid flowchart, walked in the order the arrows run: each step shows one box with the arrows (and their labels)
  // that arrive at it from boxes already shown. Returns null when the drawing is not a flowchart it can read.
  function mmFlow(svg) {
    const nodeEls = Array.from(svg.querySelectorAll("g.node")), byName = {};
    nodeEls.forEach(n => { const m = /flowchart-(.+)-\d+$/.exec(n.id || ""); if (m) byName[m[1]] = n; });
    const names = Object.keys(byName); if (!names.length) return null;
    const paths = Array.from(svg.querySelectorAll("g.edgePaths > path, path.flowchart-link")).filter((x, i, a) => a.indexOf(x) === i);
    const labs = Array.from(svg.querySelectorAll("g.edgeLabels > g.edgeLabel"));
    const E = [];
    paths.forEach((pth, i) => {
      const m = /L_(.+)_\d+$/.exec(pth.id || ""); if (!m) return;
      const parts = m[1].split("_"); let a = null, b = null;
      for (let k = 1; k < parts.length; k++) { const x = parts.slice(0, k).join("_"), y = parts.slice(k).join("_"); if (byName[x] && byName[y]) { a = x; b = y; break; } }
      if (!a) return;
      const lab = labs.length === paths.length ? labs[i] : null;
      E.push({ a, b, els: lab ? [pth, lab] : [pth] });
    });
    if (!E.length) return null;
    const indeg = {}; names.forEach(n => { indeg[n] = 0; }); E.forEach(e => { if (e.a !== e.b) indeg[e.b]++; });
    const order = [], seen = new Set(), queue = names.filter(n => !indeg[n]);
    while (order.length < names.length) {
      if (!queue.length) queue.push(names.find(n => !seen.has(n)));
      const n = queue.shift(); if (seen.has(n)) continue; seen.add(n); order.push(n);
      E.forEach(e => { if (e.a === n && !seen.has(e.b) && --indeg[e.b] <= 0) queue.push(e.b); });
    }
    const shown = new Set(), used = new Set(), out = [];
    const clusters = Array.from(svg.querySelectorAll("g.cluster")); if (clusters.length) out.push({ nodes: clusters });
    const roots = names.filter(n => !E.some(e => e.b === n && e.a !== n));
    if (roots.length > 1 && roots.length < names.length) { roots.forEach(n => shown.add(n)); out.push({ nodes: roots.map(n => byName[n]) }); }
    order.forEach(n => {
      if (shown.has(n) && roots.length > 1 && roots.indexOf(n) >= 0 && roots.length < names.length) return;
      shown.add(n); const step = [byName[n]];
      E.forEach((e, i) => { if (!used.has(i) && shown.has(e.a) && shown.has(e.b)) { used.add(i); step.push.apply(step, e.els); } });
      out.push({ nodes: step });
    });
    const rest = []; E.forEach((e, i) => { if (!used.has(i)) rest.push.apply(rest, e.els); }); if (rest.length) out.push({ nodes: rest });
    return out;
  }

  const ST = new WeakMap();
  function setup(fig) {
    if (ST.has(fig)) return ST.get(fig);
    const svg = fig.querySelector("svg.dg"); if (!svg) return null;
    const s = { fig, svg, B: null, moving: [], step: -1, played: false, timers: [], t: 0 };
    ST.set(fig, s);
    if ((svg.classList.contains("mm") ? svg.querySelectorAll("g.node, g.actor, g.cluster").length + 1 : Array.from(svg.children).filter(n => n.tagName !== "defs").length) < 4) return s;
    const bar = document.createElement("div"); bar.className = "mo-bar zx-ui";
    bar.innerHTML = '<button type="button" class="mo-replay" aria-label="Replay this diagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>Replay</button>' +
      '<button type="button" class="mo-stepbtn" aria-pressed="false">Step through</button><span class="mo-nav" hidden><button type="button" class="mo-prev" aria-label="Previous part">‹</button><span class="mo-count" aria-live="polite"></span><button type="button" class="mo-next" aria-label="Next part">›</button></span>';
    const head = fig.querySelector(".xplate-head"); if (head) head.appendChild(bar); else fig.insertBefore(bar, fig.firstChild);
    bar.querySelector(".mo-replay").addEventListener("click", () => { exitStep(s); play(s); });
    bar.querySelector(".mo-stepbtn").addEventListener("click", () => { s.step >= 0 ? exitStep(s) : enterStep(s); });
    bar.querySelector(".mo-prev").addEventListener("click", () => goStep(s, s.step - 1));
    bar.querySelector(".mo-next").addEventListener("click", () => goStep(s, s.step + 1));
    s.bar = bar; s.hasBar = true;
    if (svg.classList.contains("plate2")) {
      try { s.steps = JSON.parse(svg.getAttribute("data-steps") || "[]"); } catch (e) { s.steps = []; }
      const n = Array.from(new Set(Array.from(svg.querySelectorAll("[data-b]")).map(x => +x.getAttribute("data-b")))).filter(x => x > 0).length;
      const say = document.createElement("div"); say.className = "mo-say zx-ui"; say.setAttribute("aria-live", "polite"); say.innerHTML = "<b>\u2022</b><span></span>";
      const pips = document.createElement("div"); pips.className = "mo-pips zx-ui";
      for (let k = 0; k < n; k++) { const p = document.createElement("button"); p.type = "button"; p.setAttribute("aria-label", "Show step " + k); p.addEventListener("click", () => { if (s.step < 0) enterStep(s); goStep(s, k); }); pips.appendChild(p); }
      const sc = fig.querySelector(".dg-scroll"); sc.after(say); say.after(pips); s.sayEl = say; s.pips = pips;
      say.querySelector("span").textContent = s.steps[1] || "";
    }
    return s;
  }
  function ensure(s) { if (!s.B || !s.okB) { s.B = beats(s.svg); s.moving = s.B.filter(b => !b.base); s.okB = s.svg.getBoundingClientRect().width > 0; } }
  function clear(s) { if (!s.B) return; s.timers.forEach(clearTimeout); s.timers = []; s.svg.querySelectorAll(".mo-dot").forEach(d => d.remove()); s.svg.getAnimations ? s.svg.querySelectorAll("*").forEach(n => n.getAnimations && n.getAnimations().forEach(a => a.cancel())) : 0; s.B.forEach(b => b.nodes.forEach(n => { n.style.opacity = ""; n.style.transform = ""; n.style.strokeDasharray = ""; n.style.strokeDashoffset = ""; if (n.querySelectorAll) n.querySelectorAll("[style]").forEach(x => { x.style.strokeDasharray = ""; x.style.strokeDashoffset = ""; }); n.classList && n.classList.remove("mo-dim", "mo-on"); })); s.svg.querySelectorAll("[data-mo-mk]").forEach(a => { a.setAttribute("marker-end", a.getAttribute("data-mo-mk")); a.removeAttribute("data-mo-mk"); }); }
  const EASE = "cubic-bezier(.2,.75,.25,1)", POP = "cubic-bezier(.3,1.6,.5,1)";
  function enter(n, i, plate) {
    if (isArrow(n)) return;
    const c = n.getAttribute && (n.getAttribute("class") || "");
    if (/\bpop\b/.test(c)) return n.animate([{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1)" }], { duration: 520, delay: i, easing: POP, fill: "backwards" });
    if (/\bdrop\b/.test(c)) return n.animate([{ opacity: 0, transform: "translateY(-26px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 640, delay: i, easing: POP, fill: "backwards" });
    if (plate && n.querySelector && !n.querySelector("polygon,path,ellipse,rect,circle")) return n.animate([{ opacity: 0, transform: "translateX(-6px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: i + 160, easing: EASE, fill: "backwards" });
    return n.animate([{ opacity: 0, transform: "translateY(" + (plate ? 12 : 6) + "px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: plate ? 560 : 380, delay: i, easing: EASE, fill: "backwards" });
  }
  function narrate(s, k) {
    if (!s.sayEl) return; const b = s.moving[k]; if (!b) return;
    const txt = (s.steps || [])[b.n] || ""; const bt = b.nodes.map(x => x.querySelector && x.querySelector(".badge text")).find(Boolean); s.sayEl.querySelector("b").textContent = bt ? bt.textContent : "\u2022";
    const sp = s.sayEl.querySelector("span"); sp.textContent = txt;
    if (!calm) sp.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE });
    Array.from(s.pips.children).forEach((p, j) => { p.classList.toggle("done", j < k); p.classList.toggle("now", j === k); });
  }
  function play(s) {
    if (!s) return; if (performance.now() - s.t < 600 && s.played) return; ensure(s); if (s.moving.length < 2) return; clear(s); s.played = true; s.t = performance.now();
    const plate = s.svg.classList.contains("plate2");
    if (plate) { s.svg.classList.remove("mo-done"); s.moving.forEach(b => b.nodes.forEach(n => { n.style.opacity = "0"; }));
      let t = 250;
      s.moving.forEach((b, k) => {
        const t0 = t;
        s.timers.push(setTimeout(() => { narrate(s, k); b.nodes.forEach((n, i) => { n.style.opacity = ""; enter(n, k === 0 ? i * 45 : 0, true); }); arrowsIn(b.nodes).forEach((a, i) => drawArrow(s.svg, a, 120 + i * 260)); }, t0));
        t += k === 0 ? Math.min(2600, 700 + b.nodes.length * 45) : 1700 + arrowsIn(b.nodes).length * 200;
      });
      s.timers.push(setTimeout(() => s.svg.classList.add("mo-done"), t));
      return;
    }
    const gap = Math.max(260, Math.min(650, 5200 / s.moving.length));
    s.moving.forEach(b => b.nodes.forEach(n => { n.style.opacity = "0"; }));
    s.moving.forEach((b, i) => {
      const t = 200 + i * gap;
      s.timers.push(setTimeout(() => {
        b.nodes.forEach(n => {
          n.style.opacity = "";
          if (isArrow(n)) return;
          n.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" });
        });
        arrowsIn(b.nodes).forEach(a => drawArrow(s.svg, a, 0));
      }, t));
    });
  }
  function enterStep(s) { ensure(s); clear(s); s.bar.querySelector(".mo-stepbtn").setAttribute("aria-pressed", "true"); s.bar.querySelector(".mo-stepbtn").textContent = "Show all"; s.bar.querySelector(".mo-nav").hidden = false; s.fig.classList.add("mo-stepping"); goStep(s, 0); }
  function exitStep(s) { if (!s.bar) return; s.step = -1; clear(s); s.bar.querySelector(".mo-stepbtn").setAttribute("aria-pressed", "false"); s.bar.querySelector(".mo-stepbtn").textContent = "Step through"; s.bar.querySelector(".mo-nav").hidden = true; s.fig.classList.remove("mo-stepping"); }
  function goStep(s, i) {
    const n = s.moving.length; i = Math.max(0, Math.min(n - 1, i)); s.step = i; clear(s);
    s.moving.forEach((b, k) => b.nodes.forEach(x => { if (k > i) x.style.opacity = "0"; else if (k < i) x.classList.add("mo-dim"); else x.classList.add("mo-on"); }));
    s.B.filter(b => b.base).forEach(b => b.nodes.forEach(x => x.classList.add("mo-dim")));
    s.bar.querySelector(".mo-count").textContent = (i + 1) + " of " + n;
    s.bar.querySelector(".mo-prev").disabled = i === 0; s.bar.querySelector(".mo-next").disabled = i === n - 1;
    narrate(s, i);
    if (!calm) { s.moving[i].nodes.forEach(x => { if (!isArrow(x)) x.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 260 }); }); arrowsIn(s.moving[i].nodes).forEach(a => drawArrow(s.svg, a, 0)); }
  }

  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const s = setup(e.target); io.unobserve(e.target);
    if (s && !calm && !s.played) play(s);
  }), { threshold: 0.35 }) : null;
  function scan(root) {
    (root || document).querySelectorAll("article.module figure.diagram").forEach(f => {
      if (f.dataset.mo || f.closest(".dj-thumb") || f.closest(".stub-meta")) return; f.dataset.mo = "1";
      if (calm || !io) setup(f); else { setup(f); io.observe(f); }
    });
  }
  scan(document);
  window.addEventListener("hashchange", () => setTimeout(() => scan(document), 80));
  document.addEventListener("keydown", e => {
    const f = e.target.closest && e.target.closest("figure.mo-stepping"); if (!f) return; const s = ST.get(f);
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); goStep(s, s.step + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); goStep(s, s.step - 1); } else if (e.key === "Escape") exitStep(s);
  }, true);
  window.ZMO = { play: f => play(setup(f)), setup, beats, scan };
})();

