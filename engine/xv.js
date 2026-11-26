
/* xv.js: animated step-through diagrams for AI from Zero to Hero.
   Two styles:
     iso   - an isometric plate: blocks on a gridded base, packets travelling along wires, live counters,
             a side panel per step and a numbered step rail. Plays by itself (Pause, Replay, Back, Next).
     strip - a short beige step-through (3 to 5 steps): the figure builds up as you press Next, with a
             caption per step. Plays only when clicked.
   A lesson places one with  <figure class="xv" data-xv="name"></figure>; diagrams register with XV.reg(name, def).
   def: { style, title, meas, chips:[label], fmt:[fn], legend:[[colour,label]], steps:[{n,t,x,ch}], build(ctx), enter(ctx,i) } */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var REG = {};
  var XV = window.XV = { reg: function (n, d) { REG[n] = d; } };
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function mk(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function h(t, cls, p, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; }
  var ease = function (k) { return 1 - Math.pow(1 - k, 3); };
  function tween(ctx, dur, fn, done) {
    var t0 = performance.now(), id = {};
    id.f = function (now) { var k = Math.min(1, (now - t0) / dur); fn(ease(k)); if (k < 1) id.r = requestAnimationFrame(id.f); else if (done) done(); };
    if (reduce) { fn(1); if (done) done(); return; }
    id.r = requestAnimationFrame(id.f); ctx._tw.push(id);
  }
  function mixc(c, p) { return 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--xv-face))'; }

  /* ------------------------------------------------------------ geometry helpers bound to one figure */
  function makeCtx(fig, def, svg) {
    var ctx = { fig: fig, def: def, svg: svg, _tw: [], flights: [], ext: [1e9, 1e9, -1e9, -1e9], u: def.u || 17, OX: 0, OY: 0, data: def.data || {} };
    ctx.mk = function (t, a, p) { return mk(t, a, p || svg); };
    ctx.grow = function (x, y, pad) { pad = pad || 0; var e = ctx.ext; e[0] = Math.min(e[0], x - pad); e[1] = Math.min(e[1], y - pad); e[2] = Math.max(e[2], x + pad); e[3] = Math.max(e[3], y + pad); };
    var C = Math.cos(Math.PI / 6);
    ctx.P = function (x, y, z) { var p = [ctx.OX + (x - y) * C * ctx.u, ctx.OY + (x + y) * 0.5 * ctx.u - (z || 0) * ctx.u]; ctx.grow(p[0], p[1]); return p; };
    var pts = function (a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); };
    ctx.box = function (x, y, z, w, d, hh, col, g, o) {
      o = o || {}; var P = ctx.P, G = mk('g', {}, g || svg), sw = o.sw == null ? 1.2 : o.sw, st = o.stroke || col;
      var faces = [[[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + hh], [x, y + d, z + hh], o.l || 42],
                   [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + hh], [x + w, y, z + hh], o.r || 28],
                   [[x, y, z + hh], [x + w, y, z + hh], [x + w, y + d, z + hh], [x, y + d, z + hh], o.t || 16]];
      faces.forEach(function (f) { mk('polygon', { points: pts(f.slice(0, 4).map(function (q) { return P(q[0], q[1], q[2]); })), fill: mixc(col, f[4]), stroke: st, 'stroke-width': sw, 'stroke-linejoin': 'round' }, G); });
      return G;
    };
    ctx.cyl = function (cx, cy, z, r, hh, col, g) {
      var G = mk('g', {}, g || svg), b = ctx.P(cx, cy, z), t = ctx.P(cx, cy, z + hh), rx = r * ctx.u * 1.22, ry = r * ctx.u * 0.7;
      ctx.grow(b[0], b[1], rx); ctx.grow(t[0], t[1] - ry, rx);
      mk('path', { d: 'M' + (b[0] - rx) + ',' + b[1] + ' L' + (t[0] - rx) + ',' + t[1] + ' A' + rx + ',' + ry + ' 0 0 0 ' + (t[0] + rx) + ',' + t[1] + ' L' + (b[0] + rx) + ',' + b[1] + ' A' + rx + ',' + ry + ' 0 0 1 ' + (b[0] - rx) + ',' + b[1] + 'Z', fill: mixc(col, 40), stroke: col, 'stroke-width': 1.2 }, G);
      mk('ellipse', { cx: t[0], cy: t[1], rx: rx, ry: ry, fill: mixc(col, 16), stroke: col, 'stroke-width': 1.2 }, G);
      [0.35, 0.65].forEach(function (k) { var l = ctx.P(cx, cy, z + hh * k); mk('path', { d: 'M' + (l[0] - rx) + ',' + l[1] + ' A' + rx + ',' + ry + ' 0 0 0 ' + (l[0] + rx) + ',' + l[1], fill: 'none', stroke: col, 'stroke-width': 0.8, opacity: 0.6 }, G); });
      return G;
    };
    ctx.text = function (sx, sy, s, cls, anchor, g) {
      var t = mk('text', { x: sx, y: sy, 'text-anchor': anchor || 'middle', class: cls || 'xv-t' }, g || svg); t.textContent = s;
      var w = s.length * (cls === 'xv-ts' ? 6.6 : 7.8), x0 = anchor === 'end' ? sx - w : anchor === 'start' ? sx : sx - w / 2;
      ctx.grow(x0, sy - 12); ctx.grow(x0 + w, sy + 4); return t;
    };
    ctx.label = function (x, y, z, lines, g, anchor) {
      var p = ctx.P(x, y, z), G = mk('g', {}, g || svg);
      lines.forEach(function (l, i) { ctx.text(p[0], p[1] + i * 15, l, i ? 'xv-ts' : 'xv-tb', anchor, G); });
      return G;
    };
    ctx.floor = function (x0, y0, x1, y1) {
      var G = mk('g', {}, svg), P = ctx.P, i;
      for (i = x0; i <= x1; i += 2) { var a = P(i, y0), b = P(i, y1); mk('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'xv-grid' }, G); }
      for (i = y0; i <= y1; i += 2) { var c = P(x0, i), dd = P(x1, i); mk('line', { x1: c[0], y1: c[1], x2: dd[0], y2: dd[1], class: 'xv-grid' }, G); }
      ctx.box(x0, y0, -0.6, x1 - x0, y1 - y0, 0.6, 'var(--line-strong)', G, { t: 6, l: 22, r: 14, sw: 1 });
      return G;
    };
    ctx.wire = function (a, b, dash, g) {
      var A = ctx.P(a[0], a[1], a[2]), B = ctx.P(b[0], b[1], b[2]);
      return mk('path', { d: 'M' + A + ' L' + B, class: 'xv-edge xv-fade' + (dash ? ' xv-dash' : '') }, g || svg);
    };
    ctx.wireP = function (ps, dash, g) {   // a polyline of iso points
      return mk('path', { d: 'M' + ps.map(function (q) { return ctx.P(q[0], q[1], q[2]).join(','); }).join(' L'), class: 'xv-edge xv-fade' + (dash ? ' xv-dash' : '') }, g || svg);
    };
    ctx.fly = function (path, col, dur, delay, loop, iso) {
      if (!ctx.PK) ctx.PK = mk('g', {}, svg);
      var c = mk('circle', { r: ctx.def.style === 'iso' ? 5 : 4.5, fill: col, stroke: 'var(--xv-face)', 'stroke-width': 1.5, opacity: 0 }, ctx.PK);
      var ps = iso === false ? path : path.map(function (q) { return ctx.P(q[0], q[1], q[2]); });
      ctx.flights.push({ c: c, path: ps, dur: dur, delay: delay || 0, loop: loop !== false, t0: performance.now() });
      return c;
    };
    ctx.clearFlights = function () { ctx.flights.forEach(function (f) { f.c.remove(); }); ctx.flights = []; };
    ctx.tween = function (dur, fn, done) { tween(ctx, dur, fn, done); };
    ctx.show = function (el, on, dim) { if (!el) return; el.style.transition = 'opacity .45s'; el.style.opacity = on ? 1 : (dim == null ? 0.22 : dim); };
    return ctx;
  }
  function lerpPath(ps, t) {
    var segs = [], tot = 0, i;
    for (i = 1; i < ps.length; i++) { var d = Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1]); segs.push(d); tot += d; }
    var s = t * tot;
    for (i = 0; i < segs.length; i++) { if (s <= segs[i]) { var k = segs[i] ? s / segs[i] : 0; return [ps[i][0] + (ps[i + 1][0] - ps[i][0]) * k, ps[i][1] + (ps[i + 1][1] - ps[i][1]) * k]; } s -= segs[i]; }
    return ps[ps.length - 1];
  }
  var LIVE = [];
  function frame(now) {
    LIVE.forEach(function (ctx) {
      if (!ctx.visible) return;
      ctx.flights.forEach(function (f) {
        var t = (now - f.t0 - f.delay) / f.dur;
        if (t < 0) { f.c.setAttribute('opacity', 0); return; }
        if (f.loop) t = t % 1.3; else if (t > 1) t = 1;
        if (t > 1) { f.c.setAttribute('opacity', 0); return; }
        var p = lerpPath(f.path, t); f.c.setAttribute('cx', p[0]); f.c.setAttribute('cy', p[1]); f.c.setAttribute('opacity', 1);
      });
      if (ctx.tick) ctx.tick(now);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------ the two shells */
  function countTo(ctx, b, v, fmt) {
    var from = parseFloat(b.dataset.v || 0); b.dataset.v = v;
    if (reduce || from === v) { b.textContent = fmt(v); return; }
    tween(ctx, 650, function (k) { b.textContent = fmt(from + (v - from) * k); });
  }
  function mount(fig) {
    var name = fig.getAttribute('data-xv'), def = REG[name];
    if (!def || fig._xv) return; fig._xv = 1;
    var iso = def.style === 'iso';
    fig.classList.add(iso ? 'xv-iso' : 'xv-strip');
    var head = h('div', 'xv-head', fig);
    h('span', 'xv-plate', head, iso ? 'Plate' : 'Step through');
    h('b', null, head, def.title);
    if (def.meas) h('span', 'xv-meas', head, def.meas);
    var chips = [];
    if (def.chips) { var cr = h('div', 'xv-chips', fig); def.chips.forEach(function (c) { var d = h('div', 'xv-chip', cr); h('span', null, d, c); var b = h('b', null, d, '–'); chips.push([d, b]); }); }
    var body = h('div', 'xv-body', fig), stage = h('div', 'xv-stage', body);
    var svg = mk('svg', { role: 'img', 'aria-label': def.title }, stage);
    var side = h('div', 'xv-side', iso ? body : fig);
    var stepno = h('div', 'xv-stepno', side), ttl = iso ? h('div', 'xv-ttl', side) : null, txt = h('p', 'xv-txt', side), extra = h('div', 'xv-extra', side);
    var ctl = h('div', 'xv-ctl', side);
    var bBack = h('button', null, ctl, '← Back'), bNext = h('button', 'xv-pri', ctl, 'Next →'), bRe = h('button', null, ctl, 'Replay');
    var bPause = iso ? h('button', null, ctl, 'Pause') : null;
    [bBack, bNext, bRe, bPause].forEach(function (b) { if (b) b.type = 'button'; });
    if (def.legend) { var lg = h('div', 'xv-legend', fig); def.legend.forEach(function (l) { var s = h('span', null, lg); var i = h('i', null, s); i.style.background = l[0]; s.appendChild(document.createTextNode(l[1])); }); }
    var rail = h('div', 'xv-rail', fig), dots = [];
    var ctx = makeCtx(fig, def, svg); ctx.extra = extra; ctx.side = side;
    def.build(ctx);
    var e = ctx.ext, pad = 12;
    if (e[2] > e[0]) svg.setAttribute('viewBox', (e[0] - pad) + ' ' + (e[1] - pad) + ' ' + (e[2] - e[0] + 2 * pad) + ' ' + (e[3] - e[1] + 2 * pad));
    if (def.minw) svg.style.minWidth = def.minw + 'px';
    var cur = -1, playing = iso && !reduce, timer = null, started = false;
    function go(i) {
      if (i < 0 || i >= def.steps.length) return;
      ctx._tw.forEach(function (a) { cancelAnimationFrame(a.r); }); ctx._tw = []; ctx.clearFlights(); ctx.tick = null;
      cur = i; var s = def.steps[i];
      stepno.textContent = 'Step ' + (i + 1) + ' / ' + def.steps.length;
      if (ttl) ttl.textContent = s.t;
      txt.textContent = iso ? s.x : (s.t ? s.t + '. ' : '') + s.x;
      dots.forEach(function (d, j) { d.className = 'xv-dot' + (j < i ? ' done' : j === i ? ' on' : ''); });
      if (s.ch) s.ch.forEach(function (v, j) { if (chips[j]) { var old = chips[j][1].dataset.v; countTo(ctx, chips[j][1], v, (def.fmt && def.fmt[j]) || String); chips[j][0].classList.toggle('hot', old != null && +old !== v); } });
      extra.innerHTML = '';
      def.enter(ctx, i);
      bBack.disabled = i === 0; bNext.disabled = i === def.steps.length - 1;
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (playing && ctx.visible && cur < def.steps.length - 1) timer = setTimeout(function () { go(cur + 1); }, def.hold || 6500);
      if (bPause) bPause.textContent = playing ? 'Pause' : 'Play';
    }
    var user = function (i) { playing = false; go(i); };
    bNext.onclick = function () { user(Math.min(cur + 1, def.steps.length - 1)); };
    bBack.onclick = function () { user(Math.max(cur - 1, 0)); };
    bRe.onclick = function () { playing = iso && !reduce; go(0); };
    if (bPause) bPause.onclick = function () { playing = !playing; if (playing && cur === def.steps.length - 1) go(0); else schedule(); };
    def.steps.forEach(function (s, i) {
      var b = h('button', 'xv-dot', rail); b.type = 'button';
      var c = h('i', null, b, String(i + 1)); if (iso || s.n) h('small', null, b, s.n || '');
      b.onclick = function () { user(i); }; dots.push(b);
    });
    fig.tabIndex = 0;
    fig.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); bNext.onclick(); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); bBack.onclick(); }
      else if (ev.key === 'r' || ev.key === 'R') bRe.onclick(); else if (ev.key === ' ' && bPause) { ev.preventDefault(); bPause.onclick(); }
    });
    LIVE.push(ctx);
    var start = function () { if (!started) { started = true; go(0); } else schedule(); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (en) { ctx.visible = en.isIntersecting; if (ctx.visible) start(); else clearTimeout(timer); }); }, { threshold: 0.35 }).observe(fig);
    } else { ctx.visible = true; start(); }
  }
  XV.mountAll = function (root) { (root || document).querySelectorAll('figure.xv[data-xv]').forEach(mount); };
  XV.mk = mk; XV.h = h; XV.mixc = mixc;
  if (document.readyState !== 'loading') XV.mountAll(); else document.addEventListener('DOMContentLoaded', function () { XV.mountAll(); });
})();

/* Phase 10 diagrams, part A: MoE routing (iso), differential attention (strip) */
(function () {
  'use strict';
  var XV = window.XV;

  /* ---------------------------------------------------------------- 10.20 one token through a DeepSeek-V3 MoE layer */
  var M = {"s":[0.51,0.836,0.813,0.352,0.412,0.347,0.665,0.483,0.71,0.098,0.868,0.471,0.693,0.459,0.388,0.635,0.729,0.44,0.454,0.695,0.26,0.14,0.616,0.309,0.091,0.274,0.363,0.193,0.143,0.511,0.746,0.431,0.291,0.613,0.703,0.411,0.658,0.778,0.438,0.274,0.603,0.574,0.789,0.176,0.311,0.268,0.111,0.538,0.653,0.292,0.841,0.728,0.68,0.618,0.759,0.168,0.676,0.673,0.107,0.603,0.425,0.719,0.371,0.495,0.601,0.259,0.672,0.469,0.644,0.348,0.786,0.674,0.447,0.681,0.819,0.896,0.131,0.743,0.636,0.472,0.23,0.819,0.18,0.664,0.827,0.128,0.41,0.172,0.573,0.86,0.919,0.106,0.334,0.699,0.869,0.624,0.29,0.588,0.495,0.439,0.293,0.614,0.591,0.472,0.434,0.176,0.358,0.81,0.443,0.151,0.832,0.654,0.926,0.519,0.365,0.15,0.83,0.956,0.272,0.315,0.672,0.27,0.42,0.397,0.557,0.788,0.507,0.751,0.377,0.597,0.071,0.149,0.722,0.33,0.667,0.657,0.83,0.726,0.772,0.467,0.302,0.294,0.358,0.205,0.341,0.472,0.575,0.4,0.09,0.478,0.567,0.786,0.667,0.316,0.296,0.918,0.713,0.9,0.928,0.273,0.614,0.634,0.662,0.657,0.56,0.552,0.141,0.451,0.29,0.538,0.363,0.677,0.728,0.592,0.594,0.528,0.369,0.451,0.356,0.614,0.504,0.668,0.169,0.744,0.286,0.293,0.441,0.337,0.586,0.334,0.217,0.266,0.828,0.513,0.198,0.503,0.134,0.895,0.138,0.64,0.658,0.149,0.589,0.768,0.637,0.578,0.757,0.548,0.6,0.462,0.681,0.244,0.721,0.353,0.213,0.608,0.884,0.76,0.35,0.698,0.367,0.463,0.527,0.058,0.557,0.225,0.302,0.146,0.139,0.244,0.729,0.881,0.492,0.788,0.421,0.092,0.545,0.631,0.374,0.59,0.665,0.262,0.145,0.434,0.437,0.396,0.766,0.888,0.378,0.698,0.756,0.702,0.779,0.385,0.708,0.919],"groups":[3,4,2,7],"gscore":[1.704,1.63,1.815,1.882,1.846,1.471,1.78,1.807],"chosen":[117,158,112,255,90,155,157,75],"gate":[0.325,0.315,0.315,0.312,0.312,0.312,0.306,0.304]};
  XV.reg('moe-token', {
    style: 'iso', title: 'One token through a DeepSeek-V3 MoE layer',
    meas: 'sizes from the deepseek-ai/DeepSeek-V3 config · real routing rule, random scores',
    chips: ['active in this layer', 'experts used', 'nodes contacted', 'KV cache · token · layer'],
    fmt: [function (x) { return x >= 1000 ? (x / 1000).toFixed(2) + 'B' : Math.round(x) + 'M'; }, function (x) { return Math.round(x) + ' / 256'; },
          function (x) { return Math.round(x) + ' / 8'; }, function (x) { return Math.round(x).toLocaleString('en') + ' B'; }],
    legend: [['var(--accent)', 'token (hidden state)'], ['var(--warn)', 'router'], ['var(--prod)', 'routed expert'], ['var(--ok)', 'shared expert'], ['var(--ag)', 'latent KV cache']],
    steps: [
      { n: 'Arrives', t: 'A token arrives', x: 'The token is a vector of 7,168 numbers, the hidden state from the previous layer. It goes to this layer’s attention block first.', ch: [0, 0, 0, 0] },
      { n: 'Attention', t: 'Attention reads the latent cache', x: 'MLA writes 576 numbers for this token into the cache (a 512-number latent plus a 64-number RoPE key) and reads every earlier token’s latent back. 187M parameters work on it here.', ch: [187, 0, 0, 1152] },
      { n: 'Score', t: 'The router scores all 256 experts', x: 'One sigmoid score per expert: how well this token matches it. The cubes’ brightness shows the scores. Scoring is cheap: a single 7,168 × 256 matrix.', ch: [189, 0, 0, 1152] },
      { n: 'Pick 4 nodes', t: 'First, 4 of the 8 nodes', x: 'The experts sit in 8 groups, one per GPU node. Each group is scored by its two best experts and only the top 4 groups stay in play, so this token’s data crosses the network to at most 4 nodes.', ch: [189, 0, 4, 1152] },
      { n: 'Pick 8', t: 'Then the best 8 experts inside them', x: 'Within the 4 chosen nodes, the 8 highest-scoring experts rise. Their gate weights are their scores, normalised to sum to 1 and scaled by 2.5.', ch: [189, 8, 4, 1152] },
      { n: 'Combine', t: 'Dispatch, compute, combine', x: 'The token is copied to the 8 experts and the always-on shared expert, and their outputs come back weighted by the gates and summed. 9 of 257 expert MLPs ran: about 0.59B of this layer’s 11.5B parameters.', ch: [586, 8, 4, 1152] }
    ],
    build: function (c) {
      c.OX = 420; c.OY = 70;
      c.floor(-2, -3, 34, 21);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.node = { tok: [1, 10, 1.4], att: [7.5, 9, 3.6], cache: [7.5, 15.5, 2.4], rt: [13.6, 9.6, 2.4], sh: [21.5, 17, 3], sum: [28.4, 16.6, 1.8], out: [33, 17.6, 0.2] };
      var n = c.node;
      c.wires = { ta: c.wire(n.tok, n.att, 0, W), ac: c.wire(n.att, n.cache, 1, W), ar: c.wire(n.att, n.rt, 0, W), rs: c.wire(n.rt, n.sh, 0, W), ss: c.wire(n.sh, n.sum, 0, W), so: c.wire(n.sum, n.out, 0, W) };
      c.tok = c.box(0, 9, 0, 2, 2, 1.4, 'var(--accent)', N);
      c.att = c.box(5.5, 7, 0, 4, 4, 3.6, 'var(--prod)', N, { t: 12 });
      c.cache = c.cyl(7.5, 15.5, 0, 1.4, 2.4, 'var(--ag)', N);
      c.rt = c.box(12.4, 8.4, 0, 2.4, 2.4, 2.4, 'var(--warn)', N);
      c.sh = c.box(20.2, 15.7, 0, 2.6, 2.6, 3, 'var(--ok)', N);
      c.sum = c.box(27.4, 15.6, 0, 2, 2, 1.8, 'var(--ink)', N, { t: 8, l: 20, r: 12 });
      var pitch = 0.62, cs = 0.46; c.cubes = []; c.slabs = []; var sxy = [];
      for (var k = 0; k < 8; k++) {
        var col = k % 2, row = Math.floor(k / 2), x0 = 17.4 + col * 6.1, y0 = -2.2 + row * 3.65; sxy.push([x0, y0]);
        var g = c.mk('g', { class: 'xv-fade' }, N); c.slabs.push(g);
        c.box(x0 - 0.2, y0 - 0.2, 0, 8 * pitch + 0.22, 4 * pitch + 0.22, 0.14, 'var(--line-strong)', g, { t: 10, l: 22, r: 14, sw: 0.8 });
        var lp = c.P(x0 + 0.1, y0 + 4 * pitch + 0.55, 0); c.text(lp[0], lp[1] + 4, 'node ' + (k + 1), 'xv-ts', 'end', g);
      }
      for (var e = 0; e < 256; e++) {
        var nd = Math.floor(e / 32), kk = e % 32, r = Math.floor(kk / 8), cc = kk % 8;
        var cube = c.box(sxy[nd][0] + cc * pitch, sxy[nd][1] + r * pitch, 0.14, cs, cs, 0.42, 'var(--prod)', c.slabs[nd], { t: 12, l: 32, r: 20, sw: 0.7 });
        cube.classList.add('xv-rise'); c.cubes.push(cube);
      }
      c.etop = function (e) { var nd = Math.floor(e / 32), kk = e % 32, r = Math.floor(kk / 8), cc = kk % 8; return [sxy[nd][0] + cc * pitch + cs / 2, sxy[nd][1] + r * pitch + cs / 2, 0.56]; };
      c.label(-0.4, 11.2, 1.0, ['token', '7,168 numbers'], T, 'end');
      c.label(7.5, 9, 5.1, ['attention · MLA', '187M parameters'], T);
      c.label(7.5, 15.5, -1.4, ['latent KV cache', '576 numbers per token'], T);
      c.label(15.2, 8.2, 2.2, ['router', '256 sigmoid scores'], T, 'start');
      c.label(23.4, -4.2, 1.3, ['256 routed experts', '8 nodes × 32 · 44M each'], T);
      c.label(19.9, 18.5, 1.2, ['shared expert', 'runs for every token'], T, 'end');
      c.label(29.6, 15.4, 1.6, ['Σ gᵢ·Eᵢ + shared', 'weighted sum'], T, 'start');
      c.label(33, 17.6, -1.4, ['to the next layer'], T);
      var mx = Math.max.apply(null, M.s), mn = Math.min.apply(null, M.s); c.sc = function (e) { return (M.s[e] - mn) / (mx - mn); };
    },
    enter: function (c, i) {
      var n = c.node;
      c.show(c.cache, i >= 1); c.show(c.rt, i >= 2); c.show(c.sh, i >= 5); c.show(c.sum, i >= 5);
      var wo = { ta: 1, ac: i >= 1, ar: i >= 2, rs: i >= 5, ss: i >= 5, so: i >= 5 };
      for (var w in c.wires) c.wires[w].style.opacity = wo[w] ? 1 : 0.18;
      c.cubes.forEach(function (g, e) {
        var nd = Math.floor(e / 32), inG = M.groups.indexOf(nd) >= 0, ch = M.chosen.indexOf(e) >= 0, op = 0.5;
        if (i === 2) op = 0.25 + 0.75 * c.sc(e);
        if (i === 3) op = inG ? 0.25 + 0.75 * c.sc(e) : 0.1;
        if (i >= 4) op = ch ? 1 : (inG ? 0.2 : 0.07);
        g.style.opacity = op; g.classList.toggle('up', i >= 4 && ch);
      });
      if (i >= 4) c.extra.innerHTML = M.chosen.map(function (e, k) { return '<span>expert #' + e + ' · node ' + (Math.floor(e / 32) + 1) + '<b>g = ' + M.gate[k].toFixed(2) + '</b></span>'; }).join('');
      var A = 'var(--accent)';
      if (i === 0) c.fly([n.tok, n.att], A, 1500);
      if (i === 1) { c.fly([n.tok, n.att], A, 1300); c.fly([n.att, n.cache], 'var(--ag)', 1300, 300); c.fly([n.cache, n.att], 'var(--ag)', 1300, 1000); }
      if (i === 2) { c.fly([n.att, n.rt], A, 1200); [0, 40, 90, 130, 170, 220, 250].forEach(function (e, k) { c.fly([n.rt, c.etop(e)], 'var(--warn)', 1100, 500 + k * 90); }); }
      if (i === 3) { c.fly([n.att, n.rt], A, 1200); M.groups.forEach(function (g, k) { c.fly([n.rt, c.etop(g * 32 + 12)], 'var(--warn)', 1000, 400 + k * 160); }); }
      if (i === 4) M.chosen.forEach(function (e, k) { c.fly([n.rt, c.etop(e)], A, 1100, k * 110); });
      if (i === 5) {
        M.chosen.forEach(function (e, k) { c.fly([n.rt, c.etop(e)], A, 900, k * 60); c.fly([c.etop(e), n.sum], 'var(--prod)', 1200, 1000 + k * 60); });
        c.fly([n.rt, n.sh], A, 900, 0); c.fly([n.sh, n.sum], 'var(--ok)', 1000, 1000); c.fly([n.sum, n.out], A, 900, 2300);
      }
    }
  });

  /* ---------------------------------------------------------------- 10.16 two maps, one subtraction */
  var DF = {"N":48,"pos":31,"lam":0.8,"a1":[0.00756,0.00994,0.01071,0.00072,0.06611,0.04967,0.00862,0.03264,0.0316,0.00736,0.02642,0.00667,0.01026,0.00506,0.01662,0.01005,0.02353,0.00458,0.00794,0.00227,0.03707,0.01397,0.02519,0.01681,0.00346,0.02793,0.07844,0.00162,0.00167,0.00479,0.02838,0.13913,0.02911,0.01822,0.01849,0.01447,0.00765,0.02495,0.00294,0.00813,0.02055,0.04842,0.00869,0.00332,0.00703,0.02199,0.00852,0.04072],"a2":[0.01429,0.00668,0.00747,0.00104,0.046,0.03734,0.01143,0.03806,0.02196,0.01763,0.03832,0.00884,0.01813,0.00464,0.02866,0.00922,0.02571,0.00413,0.02054,0.00559,0.02242,0.02785,0.02389,0.02052,0.00415,0.02842,0.09156,0.00364,0.00342,0.00266,0.02559,0.01309,0.02488,0.02256,0.01625,0.02232,0.01771,0.02419,0.00559,0.00798,0.03326,0.07454,0.00778,0.00366,0.00621,0.03664,0.00971,0.05383],"b2":[0.00325,0.03004,0.0063,0.08675,0.01161,0.04643,0.00384,0.0238,0.00638,0.00952,0.01588,0.01129,0.02018,0.03273,0.02977,0.0142,0.00396,0.00693,0.01274,0.00186,0.03287,0.01219,0.01205,0.04,0.03022,0.01933,0.00569,0.02114,0.02191,0.0064,0.04399,0.02575,0.00216,0.01751,0.00438,0.04828,0.03473,0.00514,0.0064,0.01716,0.0122,0.07122,0.03251,0.01168,0.02761,0.00203,0.02113,0.03686],"d":[-0.00387,0.00459,0.00473,-0.00011,0.02931,0.0198,-0.00052,0.0022,0.01404,-0.00674,-0.00423,-0.0004,-0.00424,0.00135,-0.00631,0.00268,0.00296,0.00128,-0.00849,-0.0022,0.01913,-0.00831,0.00608,0.00039,0.00014,0.00519,0.00519,-0.00129,-0.00106,0.00266,0.00791,0.12866,0.0092,0.00018,0.00549,-0.00339,-0.00652,0.0056,-0.00153,0.00174,-0.00606,-0.0112,0.00247,0.00039,0.00205,-0.00732,0.00075,-0.00234],"d2":[0.00496,-0.0141,0.00566,-0.06868,0.05682,0.01252,0.00555,0.01361,0.0265,-0.00025,0.01372,-0.00236,-0.00589,-0.02112,-0.0072,-0.0013,0.02036,-0.00096,-0.00225,0.00078,0.01077,0.00422,0.01555,-0.01519,-0.02071,0.01246,0.07389,-0.01529,-0.01585,-0.00033,-0.00681,0.11853,0.02738,0.00422,0.01499,-0.02415,-0.02014,0.02084,-0.00218,-0.0056,0.01079,-0.00855,-0.01732,-0.00602,-0.01506,0.02036,-0.00838,0.01124],"m":{"snr":[7.6,24.8,8.0],"sig":[0.139,0.129,0.119],"floor":[0.861,0.244,0.693]}};
  XV.reg('diff-attn', {
    style: 'strip', title: 'Two maps, one subtraction', minw: 600,
    meas: 'computed · softmax over 48 positions, λ = 0.8',
    steps: [
      { t: 'One softmax map', x: 'Query 1 scores 48 earlier tokens. The one that matters (position 31) wins, but softmax gives every other token a little weight, and together that floor holds ' + Math.round(DF.m.floor[0] * 100) + '% of the attention.' },
      { t: 'A second map', x: 'Query 2 has its own projection. Trained well, it picks up the same distractions as query 1 but not the signal: its bars rise and fall where map 1’s floor does.' },
      { t: 'Subtract 0.8 × map 2', x: 'Map 2 drops onto the result row and is subtracted. Where the maps agree, the floor cancels (' + Math.round(DF.m.floor[0] * 100) + '% → ' + Math.round(DF.m.floor[1] * 100) + '%); position 31 keeps its weight. Signal over average noise: ' + DF.m.snr[0] + '× → ' + DF.m.snr[1] + '×.' },
      { t: 'If the maps share nothing', x: 'With an independent map 2, subtraction removes only the average level; its own wiggles add to map 1’s. The ratio barely moves (' + DF.m.snr[0] + '× → ' + DF.m.snr[2] + '×): the trick needs maps that share their distractions.' }
    ],
    build: function (c) {
      var X0 = 118, Wd = 12.4, BW = 9, H = 420, rows = [118, 248, 378];
      c.rows = rows; c.H = H; c.grow(0, 0); c.grow(760, 418);
      var names = [['map 1', 'softmax(q₁·K)'], ['map 2', 'softmax(q₂·K)'], ['map 1 − 0.8·map 2', 'what attends']];
      rows.forEach(function (y, r) {
        c.mk('line', { x1: X0 - 6, x2: X0 + 48 * Wd, y1: y, y2: y, stroke: 'var(--line-strong)' });
        c.text(8, y - 34, names[r][0], 'xv-tb', 'start'); c.sub2 = c.sub2 || []; c.sub2.push(c.text(8, y - 19, names[r][1], 'xv-ts', 'start'));
      });
      c.text(X0 + 48 * Wd + 8, rows[2] + 4, '0', 'xv-ts', 'start');
      var bars = function (col) { return DF.a1.map(function (_, i) { return c.mk('rect', { x: X0 + i * Wd, width: BW, rx: 1.5, fill: col, y: 0, height: 0 }); }); };
      c.A = bars('var(--accent)'); c.B = bars('var(--prod)'); c.G = bars('var(--prod)'); c.C = bars('var(--ok)');
      c.G.forEach(function (r) { r.setAttribute('opacity', 0); });
      var px = X0 + DF.pos * Wd + BW / 2;
      c.mk('path', { d: 'M' + px + ' 24 l-5 -8 h10z', fill: 'var(--accent)' });
      c.text(px, 12, 'the token that matters', 'xv-ts');
      c.st = { a: DF.a1.map(function () { return 0; }), b: DF.a1.map(function () { return 0; }), c: DF.a1.map(function () { return 0; }) };
      c.set = function (r, v, base) { var hh = Math.abs(v) * H; r.setAttribute('height', Math.max(hh, 0.001)); r.setAttribute('y', v >= 0 ? base - hh : base); };
      c.row = function (arr, key, target, base, dur, stg) {
        var from = c.st[key].slice(), T = dur + stg * 48;
        if (key === 'c') arr.forEach(function (r, i) { r.setAttribute('fill', target[i] < 0 ? 'var(--bad)' : 'var(--ok)'); });
        c.tween(T, function (k) { arr.forEach(function (r, i) { var kk = Math.max(0, Math.min(1, (k * T - i * stg) / dur)), v = from[i] + (target[i] - from[i]) * kk; c.st[key][i] = v; c.set(r, v, base); }); });
      };
    },
    enter: function (c, i) {
      var z = DF.a1.map(function () { return 0; }), R = c.rows;
      c.sub2[1].textContent = i === 3 ? 'independent noise' : 'softmax(q₂·K)';
      if (i === 0) { c.row(c.A, 'a', DF.a1, R[0], 700, 14); c.row(c.B, 'b', z, R[1], 300, 0); c.row(c.C, 'c', z, R[2], 300, 0); }
      if (i === 1) { c.row(c.A, 'a', DF.a1, R[0], 400, 0); c.row(c.B, 'b', DF.a2, R[1], 700, 14); c.row(c.C, 'c', z, R[2], 300, 0); }
      if (i >= 2) {
        var m2 = i === 2 ? DF.a2 : DF.b2, res = i === 2 ? DF.d : DF.d2;
        c.row(c.A, 'a', DF.a1, R[0], 400, 0); c.row(c.B, 'b', m2, R[1], 500, 0); c.row(c.C, 'c', z, R[2], 250, 0);
        c.G.forEach(function (r, j) { c.set(r, -m2[j] * DF.lam, R[2]); r.setAttribute('opacity', 0); });
        c.tween(900, function (k) { c.G.forEach(function (r) { r.setAttribute('opacity', 0.55 * (1 - Math.max(0, k - 0.75) * 4)); r.setAttribute('transform', 'translate(0,' + (R[1] - R[2]) * (1 - k) + ')'); }); },
          function () { c.G.forEach(function (r) { r.setAttribute('opacity', 0); }); c.row(c.C, 'c', res, R[2], 800, 10); });
      }
    }
  });
})();

/* Phase 10 diagrams, part B: short beige step-throughs */
(function () {
  'use strict';
  var XV = window.XV;
  function chip(c, x, y, s, o) {           // a rounded token chip; returns {g, w}
    o = o || {}; var w = o.w || Math.max(24, s.length * 8.2 + 14), g = c.mk('g', { class: 'xv-fade' }, o.g);
    var r = c.mk('rect', { x: x, y: y, width: w, height: o.h || 26, rx: 6, fill: o.fill || 'var(--xv-face)', stroke: o.stroke || 'var(--line-strong)', 'stroke-width': 1.1 }, g);
    var t = c.text(x + w / 2, y + (o.h || 26) / 2 + 4.5, s, o.cls || 'xv-t', 'middle', g);
    if (o.tfill) t.setAttribute('fill', o.tfill);
    c.grow(x, y); c.grow(x + w, y + (o.h || 26));
    return { g: g, w: w, r: r, t: t };
  }
  var vis = function (s) { return s.replace(/ /g, '␣').replace(/\n/g, '↵'); };
  function seq(c, fns, gap) {               // run fns one after another, gap ms apart, cancelled on step change
    var i = 0; (function next() { if (i >= fns.length) return; fns[i++](); c.tween(gap, function () {}, next); })();
  }

  /* ---------------------------------------------------------------- 10.1 BPE merges, real GPT-2 ranks */
  var B = {"word":" tokenization","hist":[[" ","t","o","k","e","n","i","z","a","t","i","o","n"],[" t","o","k","e","n","i","z","a","t","i","o","n","@0:256"],[" t","o","k","e","n","i","z","a","t","i","on","@10:261"],[" t","o","k","e","n","i","z","at","i","on","@7:265"],[" t","o","k","en","i","z","at","i","on","@3:268"],[" to","k","en","i","z","at","i","on","@0:284"],[" to","k","en","i","z","at","ion","@6:295"],[" to","k","en","i","z","ation","@5:341"],[" to","k","en","iz","ation","@3:528"],[" to","k","en","ization","@3:1634"],[" to","ken","ization","@1:3464"],[" token","ization","@0:11241"]],"ids":[11241,1634],"sent":"Tokenizers turn text into integers.","gpt2":[["Token",30642],["izers",11341],[" turn",1210],[" text",2420],[" into",656],[" integers",37014],[".",13]],"o200k":[["Token",4421],["izers",24223],[" turn",3716],[" text",2201],[" into",1511],[" integers",54912],[".",13]]};
  XV.reg('bpe-merges', {
    style: 'strip', title: 'GPT-2 tokenizes “ tokenization”', minw: 560,
    meas: 'real merge ranks · tiktoken gpt2',
    steps: [
      { t: 'Start from bytes', x: 'The word with its leading space is 13 bytes, so 13 one-byte tokens. Everything below happens inside this one pre-tokenised chunk.' },
      { t: 'Apply the earliest-learned merges', x: 'Repeatedly join the adjacent pair whose merge was learned first (lowest rank). ␣+t is rank 256, the very first merge GPT-2 learned; then o+n, a+t, e+n.' },
      { t: 'Keep merging', x: 'Merges learned later join larger pieces: ␣t+o, i+on, at+ion, i+z. Each pass picks the lowest-ranked pair still present.' },
      { t: 'Stop when no pair has a merge', x: 'After 11 merges two pieces remain, ␣token and ization, and no merge joins them. Their ranks are the token IDs: 11241 and 1634.' }
    ],
    build: function (c) {
      c.G = c.mk('g', {}); c.grow(0, 0); c.grow(700, 150);
      c.cap = c.text(350, 128, '', 'xv-ts');
      c.draw = function (k, hi) {
        while (c.G.firstChild) c.G.removeChild(c.G.firstChild);
        var parts = B.hist[k].filter(function (p) { return p[0] !== '@'; }), ws = parts.map(function (p) { return Math.max(26, vis(p).length * 9 + 14); });
        var tot = ws.reduce(function (a, b) { return a + b; }, 0) + 6 * (parts.length - 1), x = 350 - tot / 2;
        var mark = B.hist[k].filter(function (p) { return p[0] === '@'; })[0], at = mark ? +mark.slice(1).split(':')[0] : -1;
        parts.forEach(function (p, i) {
          var on = hi && i === at;
          chip(c, x, 40, vis(p), { w: ws[i], g: c.G, fill: on ? 'color-mix(in srgb, var(--accent) 18%, var(--xv-card))' : 'var(--xv-card)', stroke: on ? 'var(--accent)' : 'var(--line-strong)' });
          if (k === B.hist.length - 1) c.text(x + ws[i] / 2, 92, String(B.ids[i]), 'xv-tb', 'middle', c.G);
          x += ws[i] + 6;
        });
        c.cap.textContent = mark ? 'merge ' + k + ' of ' + (B.hist.length - 1) + ' · rank ' + mark.split(':')[1] : (k === 0 ? '13 bytes' : '');
        if (k === B.hist.length - 1) c.cap.textContent = 'merge 11 of 11 · token IDs = merge ranks';
      };
    },
    enter: function (c, i) {
      var ranges = [[0, 0], [1, 4], [5, 8], [9, 11]], r = ranges[i];
      if (i === 0) { c.draw(0); return; }
      c.draw(r[0] - 1);
      var fns = []; for (var k = r[0]; k <= r[1]; k++) (function (k) { fns.push(function () { c.draw(k, true); }); })(k);
      seq(c, fns, 900);
    }
  });

  /* ---------------------------------------------------------------- 10.11 one outlier, one scale */
  var Q = {"w":[0.03735,0.01056,0.02173,0.01178,0.02808,0.02148,-0.09082,-0.06299,0.00083,-0.0564,-0.02539,-0.01215,-0.08691,-0.09326,-0.07471,0.12695],"tmax":2.3281,"gmax":0.12695,"qt":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"qg":[2,1,1,1,2,1,-5,-3,0,-3,-1,-1,-5,-5,-4,7],"dt":[0.0,0.0,0.0,0.0,0.0,0.0,-0.0,-0.0,0.0,-0.0,-0.0,-0.0,-0.0,-0.0,-0.0,0.0],"dg":[0.03627,0.01814,0.01814,0.01814,0.03627,0.01814,-0.09068,-0.05441,0.0,-0.05441,-0.01814,-0.01814,-0.09068,-0.09068,-0.07254,0.12695],"et":0.05995,"eg":0.00489,"shape":[576,1536]};
  XV.reg('quant-scale', {
    style: 'strip', title: 'Rounding 16 real weights to 4 bits', minw: 560,
    meas: 'SmolLM2-135M · layer 6 down_proj · row 100, weights 0–15',
    steps: [
      { t: 'Sixteen real weights', x: 'Weights from SmolLM2-135M, all between −0.093 and 0.127. INT4 has 16 levels, −8 to 7, so each weight becomes an integer times one scale.' },
      { t: 'One scale for the whole matrix', x: 'The matrix’s largest weight is ' + Q.tmax + ', so the scale is ' + Q.tmax + '/7 = ' + (Q.tmax / 7).toFixed(3) + ' and the levels sit far apart. Every one of these 16 weights rounds to 0: error ' + Q.et + ' (RMS), the weights are simply gone.' },
      { t: 'One scale per group of 16', x: 'Here the group’s largest weight is ' + Q.gmax + ', scale ' + (Q.gmax / 7).toFixed(4) + '. The levels are 18× finer, every weight lands near its value, and the error drops to ' + Q.eg + ', 12× smaller.' },
      { t: 'What the scales cost', x: 'Sixteen 4-bit integers plus one 16-bit scale: 80 bits for 16 weights, 5 bits each instead of 4, against 256 bits in BF16. Group scaling is why INT4 works at all (Lesson 10.11’s perplexity table: 26.8 with groups of 32).' }
    ],
    build: function (c) {
      var X0 = 70, Wd = 38, base = 150, H = 900; c.base = base; c.H = H; c.grow(0, 0); c.grow(700, 300);
      c.mk('line', { x1: X0 - 10, x2: X0 + 16 * Wd, y1: base, y2: base, stroke: 'var(--line-strong)' });
      c.text(X0 - 16, base + 4, '0', 'xv-ts', 'end');
      c.gridG = c.mk('g', {}); c.bars = Q.w.map(function (v, i) { return c.mk('rect', { x: X0 + i * Wd + 6, width: Wd - 12, rx: 2, fill: 'var(--accent)' }); });
      c.ghost = Q.w.map(function (v, i) { return c.mk('rect', { x: X0 + i * Wd + 6, width: Wd - 12, rx: 2, fill: 'none', stroke: 'var(--muted)', 'stroke-dasharray': '3 3', opacity: 0 }); });
      c.vals = Q.w.map(function (v, i) { return c.text(X0 + i * Wd + Wd / 2, 285, '', 'xv-ts'); });
      c.set = function (r, v) { var hh = Math.abs(v) * H; r.setAttribute('height', Math.max(hh, 0.5)); r.setAttribute('y', v >= 0 ? base - hh : base); };
      c.cur = Q.w.map(function () { return 0; });
      c.anim = function (tgt, dur) { var from = c.cur.slice(); c.tween(dur, function (k) { c.bars.forEach(function (r, i) { c.cur[i] = from[i] + (tgt[i] - from[i]) * k; c.set(r, c.cur[i]); }); }); };
      c.levels = function (s) {
        while (c.gridG.firstChild) c.gridG.removeChild(c.gridG.firstChild);
        if (!s) return;
        for (var q = -8; q <= 7; q++) { var y = base - q * s * H; if (y < 8 || y > 292) continue; c.mk('line', { x1: X0 - 10, x2: X0 + 16 * Wd, y1: y, y2: y, stroke: 'var(--prod)', 'stroke-dasharray': '2 4', opacity: 0.55 }, c.gridG); }
      };
      c.bits = c.mk('g', { opacity: 0, class: 'xv-fade' });
      [['BF16', 256, 'var(--line-strong)'], ['INT4 + scale', 80, 'var(--ok)']].forEach(function (b, i) {
        c.mk('rect', { x: X0, y: 196 + i * 26, width: b[1] * 2, height: 16, rx: 3, fill: b[2] }, c.bits);
        c.text(X0 + b[1] * 2 + 8, 208 + i * 26, b[0] + ' · ' + b[1] + ' bits', 'xv-ts', 'start', c.bits);
      });
    },
    enter: function (c, i) {
      var s = i === 1 ? Q.tmax / 7 : i >= 2 ? Q.gmax / 7 : 0;
      c.levels(i === 3 ? 0 : s);
      c.ghost.forEach(function (r, j) { c.set(r, Q.w[j]); r.setAttribute('opacity', i === 1 || i === 2 ? 1 : 0); });
      c.anim(i === 0 ? Q.w : i === 1 ? Q.dt : Q.dg, i === 0 ? 900 : 1100);
      c.vals.forEach(function (t, j) { t.textContent = i === 0 ? '' : i === 1 ? String(Q.qt[j]) : i === 2 ? String(Q.qg[j]) : ''; });
      c.bars.forEach(function (r) { r.setAttribute('fill', i === 1 ? 'var(--bad)' : i >= 2 ? 'var(--ok)' : 'var(--accent)'); r.style.opacity = i === 3 ? 0.25 : 1; });
      c.bits.style.opacity = i === 3 ? 1 : 0;
    }
  });

  /* ---------------------------------------------------------------- 10.17 what NSA reads at 64K tokens */
  XV.reg('nsa-reads', {
    style: 'strip', title: 'What one NSA query reads at 64K tokens', minw: 560,
    meas: 'paper settings · stride 16 · 16 blocks of 64 · window 512',
    steps: [
      { t: 'Full attention', x: 'The newest token’s query reads the keys of all 65,536 earlier tokens. Decoding is memory-bound, so this read is the cost.' },
      { t: 'Compressed branch', x: 'A learned MLP squeezes every 32 tokens (overlapping, stride 16) into one summary key: 4,096 summaries cover the whole context coarsely.' },
      { t: 'Selected branch', x: 'The summaries’ attention scores rank 64-token blocks; the top 16, always including the first block and the two newest, are read in full: 1,024 tokens.' },
      { t: 'Window, and the total', x: 'Plus the newest 512 tokens. Total 4,096 + 1,024 + 512 = 5,632 reads instead of 65,536: 11.6× fewer, the paper’s decoding speed-up at 64K.' }
    ],
    build: function (c) {
      var X0 = 40, Wd = 620, y = 90; c.grow(0, 0); c.grow(700, 210);
      c.text(X0, y - 46, 'token 0', 'xv-ts', 'start'); c.text(X0 + Wd, y - 46, '65,536', 'xv-ts', 'end');
      c.full = c.mk('rect', { x: X0, y: y, width: Wd, height: 22, rx: 3, fill: 'var(--accent)', class: 'xv-fade' });
      c.frame = c.mk('rect', { x: X0, y: y, width: Wd, height: 22, rx: 3, fill: 'none', stroke: 'var(--line-strong)' });
      c.sum = c.mk('g', { class: 'xv-fade' }); var hs = [];
      var rnd = function (k) { var s = Math.sin(k * 12.9898) * 43758.5453; return s - Math.floor(s); };
      for (var k = 0; k < 128; k++) { var hh = 4 + 22 * Math.pow(rnd(k), 3); hs.push(hh); c.mk('rect', { x: X0 + k * Wd / 128 + 0.6, y: y - 8 - hh, width: Wd / 128 - 1.2, height: hh, fill: 'var(--prod)', opacity: 0.75 }, c.sum); }
      var top = hs.map(function (h, k) { return [h, k]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 13).map(function (a) { return a[1]; }).concat([0, 126, 127]);
      c.sel = c.mk('g', { class: 'xv-fade' });
      top.forEach(function (k) { c.mk('rect', { x: X0 + k * Wd / 128, y: y, width: Wd / 128, height: 22, fill: 'var(--ok)' }, c.sel); });
      c.win = c.mk('rect', { x: X0 + Wd - Wd / 128, y: y, width: Wd / 128, height: 22, fill: 'var(--warn)', class: 'xv-fade' });
      c.read = c.text(X0, y + 56, '', 'xv-tb', 'start'); c.read2 = c.text(X0, y + 76, '', 'xv-ts', 'start');
      c.meter = c.mk('rect', { x: X0, y: y + 92, height: 10, rx: 3, fill: 'var(--accent)', width: Wd });
      c.mk('rect', { x: X0, y: y + 92, width: Wd, height: 10, rx: 3, fill: 'none', stroke: 'var(--line-strong)' });
    },
    enter: function (c, i) {
      c.full.style.opacity = i === 0 ? 0.85 : 0.08; c.sum.style.opacity = i >= 1 ? 1 : 0; c.sel.style.opacity = i >= 2 ? 1 : 0; c.win.style.opacity = i >= 3 ? 1 : 0;
      var n = [65536, 4096, 5120, 5632][i], w0 = +c.meter.getAttribute('width'), w1 = 620 * n / 65536;
      c.read.textContent = 'keys read: ' + n.toLocaleString('en');
      c.read2.textContent = ['all of them', 'summaries (one per 16 tokens)', 'summaries + 16 selected blocks', 'summaries + selected + window · 11.6× fewer'][i];
      c.meter.setAttribute('fill', i ? 'var(--ok)' : 'var(--accent)');
      c.tween(800, function (k) { c.meter.setAttribute('width', w0 + (w1 - w0) * k); });
    }
  });

  /* ---------------------------------------------------------------- 10.19 PyTorch's DualPipeV schedule, as computed */
  var DP = {"grid":[["0F0","1F0","2F0","3F0"],["0F1","1F1","2F1","4F0"],["0F2","1F2","2F2","3F1"],["0F3","1F3","5F0","4F1"],["0F4","1F4","2F3","3F2"],["0F5","6F0","5F1","4F2"],["0F6","1F5","2F4","3F3"],["7F0","6F1","5F2","4F3"],["7I0","6I0","5I0","3F4"],["7W0","6W0","5W0","4B0"],["7F1","6F2","5F3","(4F4;3B0)OVERLAP_F_B"],["7I1","6I1","(2F5;5B1)OVERLAP_F_B","(3F5;4B1)OVERLAP_F_B"],["7W1","6W1","(5F4;2B0)OVERLAP_F_B","(4F5;3B1)OVERLAP_F_B"],["7F2","6F3","(2F6;5B2)OVERLAP_F_B","(3F6;4B2)OVERLAP_F_B"],["7I2","(1F6;6B2)OVERLAP_F_B","(5F5;2B1)OVERLAP_F_B","(4F6;3B2)OVERLAP_F_B"],["7W2","(6F4;1B0)OVERLAP_F_B","(2F7;5B3)OVERLAP_F_B","(3F7;4B3)OVERLAP_F_B"],["7F3","(1F7;6B3)OVERLAP_F_B","(5F6;2B2)OVERLAP_F_B","(4F7;3B3)OVERLAP_F_B"],["(0F7;7B3)OVERLAP_F_B","(6F5;1B1)OVERLAP_F_B","5B4","4B4"],["(7F4;0B0)OVERLAP_F_B","6B4","(5F7;2B3)OVERLAP_F_B","3B4"],["7B4","(6F6;1B2)OVERLAP_F_B","5B5","4B5"],["(7F5;0B1)OVERLAP_F_B","6B5","2B4","3B5"],["7B5","(6F7;1B3)OVERLAP_F_B","5B6","4I6"],["(7F6;0B2)OVERLAP_F_B","6B6","2I5","3I6"],["7B6","1B4","5I7","4I7"],["(7F7;0B3)OVERLAP_F_B","6I7","2I6","3I7"],["7B7","1I5","2W5","4W6"],["0I4","6W7","2I7","3W6"],["0W4","1I6","5W7","4W7"],["0I5","1W5","2W6","3W7"],["0W5","1I7","2W7",""],["0I6","1W6","",""],["0W6","1W7","",""],["0I7","","",""],["0W7","","",""]]};
  XV.reg('dualpipev-grid', {
    style: 'strip', title: 'DualPipeV on 4 ranks, 8 micro-batches', minw: 640,
    meas: 'the schedule PyTorch computed in this lesson’s run',
    steps: [
      { t: 'Warm-up', x: 'Each rank holds two stages: rank 0 holds stages 0 and 7, rank 3 holds 3 and 4, a V. Rank 0 starts forwards of stage 0 while the first micro-batches travel down the V and back.' },
      { t: 'Steady state', x: 'Purple cells split in two are DualPipe’s move: the forward of one micro-batch and the backward of another run together, so one’s compute hides the other’s communication.' },
      { t: 'Cool-down', x: 'Backward passes are split into input gradients (I) and weight gradients (W). The weight gradients, which nothing waits for, fill the slots that would otherwise be the end-of-step bubble.' }
    ],
    build: function (c) {
      var X0 = 64, Y0 = 40, cw = 17.5, ch = 30; c.cells = []; c.grow(0, 0); c.grow(X0 + 34 * cw + 10, Y0 + 4 * ch + 52);
      for (var r = 0; r < 4; r++) c.text(X0 - 10, Y0 + r * ch + ch / 2 + 4, 'rank ' + r, 'xv-ts', 'end');
      c.text(X0, Y0 + 4 * ch + 20, 'step 0', 'xv-ts', 'start'); c.text(X0 + 34 * cw, Y0 + 4 * ch + 20, 'step 33', 'xv-ts', 'end');
      var col = { F: 'var(--accent)', B: 'var(--prod)', I: 'var(--ag)', W: 'var(--ok)' };
      DP.grid.forEach(function (row, s) {
        row.forEach(function (cell, r) {
          if (!cell) return; var x = X0 + s * cw, y = Y0 + r * ch, g = c.mk('g', { opacity: 0 });
          var m = cell.match(/\((\d+)([A-Z])(\d+);(\d+)([A-Z])(\d+)\)/);
          if (m) { c.mk('rect', { x: x + 1, y: y + 1, width: cw - 2, height: ch / 2 - 1, fill: col[m[2]] }, g); c.mk('rect', { x: x + 1, y: y + ch / 2, width: cw - 2, height: ch / 2 - 1, fill: col[m[5]] }, g); }
          else { var mm = cell.match(/(\d+)([A-Z])(\d+)/); c.mk('rect', { x: x + 1, y: y + 1, width: cw - 2, height: ch - 2, rx: 2, fill: mm ? col[mm[2]] || 'var(--muted)' : 'var(--muted)', opacity: 0.85 }, g); if (mm) c.text(x + cw / 2, y + ch / 2 + 4, mm[3], 'xv-ts', 'middle', g).setAttribute('style', 'fill:var(--surface);stroke:none;font-size:9.5px'); }
          c.cells.push([s, g]);
        });
      });
      var lg = [['F forward', 'var(--accent)'], ['B backward', 'var(--prod)'], ['I input grad', 'var(--ag)'], ['W weight grad', 'var(--ok)']];
      lg.forEach(function (l, i) { c.mk('rect', { x: X0 + i * 132, y: Y0 + 4 * ch + 30, width: 10, height: 10, rx: 2, fill: l[1] }); c.text(X0 + i * 132 + 16, Y0 + 4 * ch + 39, l[0], 'xv-ts', 'start'); });
    },
    enter: function (c, i) {
      var upto = [10, 25, 34][i], from = i ? [0, 10, 25][i] : 0;
      c.cells.forEach(function (p) { p[1].setAttribute('opacity', p[0] < from ? 1 : 0); });
      c.tween(1800, function (k) { var s = from + (upto - from) * k; c.cells.forEach(function (p) { if (p[0] >= from && p[0] < upto) p[1].setAttribute('opacity', p[0] < s ? 1 : 0); }); });
    }
  });

  /* ---------------------------------------------------------------- 10.25 one tree, one target pass (real) */
  var TR = {"prefix":"The sky is blue because of","nodes":[" the"," a"," how"," way"," collision"," process"," phenomenon"," our"," the"," the"," of"," called"," known"," eyes"," human"],"parents":[-1,-1,-1,0,0,1,1,2,2,3,4,5,6,7,8],"path":[1,6,12],"bonus":" as"};
  XV.reg('spec-tree', {
    style: 'strip', title: 'One draft tree, one target pass', minw: 600,
    meas: 'SmolLM2-135M drafts for SmolLM2-360M · greedy · real tokens',
    steps: [
      { t: 'The draft proposes a tree', x: 'After “The sky is blue because of”, the small model offers its top 3 next tokens, its top 2 after each, and its top 1 after those: 15 nodes.' },
      { t: 'The target checks all of them at once', x: 'One forward pass of the big model over all 15 nodes. A tree mask lets each node see only the prefix and its own ancestors, so every branch is scored as if alone.' },
      { t: 'Walk down the accepted path', x: 'The target’s own next token is “ a”, the draft’s second guess, then “ phenomenon”, then “ known”. All three are in the tree; its next choice “ as” is a free bonus.' },
      { t: 'What a chain would have got', x: 'A chain would have drafted only the top guesses, “ the way of”. The first is wrong, so one pass yields one token. The tree turns the same pass into four.' }
    ],
    build: function (c) {
      c.grow(0, 0); c.grow(720, 270);
      var px = 14; chip(c, px, 112, TR.prefix, { w: 214, fill: 'var(--xv-card)', cls: 'xv-ts' });
      var depth = TR.parents.map(function (p, i) { var d = 0, j = i; while (j !== -1) { d++; j = TR.parents[j]; } return d; });
      var colX = [0, 250, 400, 560], y = {}, cnt = {};
      // leaves get evenly spaced rows; parents centre on their children
      var order = [], kids = function (p) { return TR.parents.map(function (q, i) { return q === p ? i : -1; }).filter(function (i) { return i >= 0; }); };
      (function walk(p) { kids(p).forEach(function (k) { if (!kids(k).length) order.push(k); walk(k); }); })(-1);
      order.forEach(function (k, r) { y[k] = 10 + r * 36; });
      for (var d = 3; d >= 1; d--) TR.parents.forEach(function (p, i) { if (depth[i] === d && y[i] == null) { var ks = kids(i); y[i] = (y[ks[0]] + y[ks[ks.length - 1]]) / 2; } });
      c.edges = []; c.nodes = [];
      TR.nodes.forEach(function (s, i) {
        var x = colX[depth[i]], yy = y[i], p = TR.parents[i], x0 = p < 0 ? px + 214 : colX[depth[p]] + 110, y0 = (p < 0 ? 112 : y[p]) + 13;
        c.edges.push(c.mk('path', { d: 'M' + x0 + ' ' + y0 + ' C ' + (x0 + 30) + ' ' + y0 + ', ' + (x - 30) + ' ' + (yy + 13) + ', ' + x + ' ' + (yy + 13), class: 'xv-edge xv-fade', 'stroke-width': 1 }));
        c.nodes.push(chip(c, x, yy, vis(s), { w: 110, fill: 'var(--xv-card)' }));
      });
      c.bonus = chip(c, colX[3] + 124, y[TR.path[2]], vis(TR.bonus) + ' bonus', { w: 96, fill: 'color-mix(in srgb, var(--ok) 20%, var(--xv-card))', stroke: 'var(--ok)' });
      c.scan = c.mk('rect', { x: 236, y: 0, width: 4, height: 270, fill: 'var(--prod)', opacity: 0 });
    },
    enter: function (c, i) {
      var onPath = function (k) { return TR.path.indexOf(k) >= 0; }, chain = [0, 3, 9];
      c.nodes.forEach(function (n, k) {
        n.g.style.opacity = i === 2 ? (onPath(k) ? 1 : 0.25) : i === 3 ? (chain.indexOf(k) >= 0 ? 1 : 0.15) : 1;
        n.r.setAttribute('stroke', i === 2 && onPath(k) ? 'var(--ok)' : i === 3 && k === 0 ? 'var(--bad)' : 'var(--line-strong)');
        n.r.setAttribute('fill', i === 2 && onPath(k) ? 'color-mix(in srgb, var(--ok) 18%, var(--xv-card))' : i === 3 && k === 0 ? 'color-mix(in srgb, var(--bad) 16%, var(--xv-card))' : 'var(--xv-card)');
      });
      c.edges.forEach(function (e, k) { e.style.opacity = i === 2 ? (onPath(k) ? 1 : 0.15) : i === 3 ? (chain.indexOf(k) >= 0 ? 1 : 0.1) : 1; e.setAttribute('stroke', i === 2 && onPath(k) ? 'var(--ok)' : 'var(--ink)'); e.setAttribute('stroke-width', i === 2 && onPath(k) ? 2.2 : 1); });
      c.bonus.g.style.opacity = i === 2 ? 1 : 0;
      if (i === 0) c.nodes.forEach(function (n, k) { n.g.style.opacity = 0; setTimeout(function () { n.g.style.opacity = 1; }, 120 + k * 90); });
      c.scan.setAttribute('opacity', 0);
      if (i === 1) c.tween(1600, function (k) { c.scan.setAttribute('x', 236 + k * 450); c.scan.setAttribute('opacity', 0.35 * Math.sin(Math.PI * k)); });
    }
  });

  /* ---------------------------------------------------------------- 10.34 store inputs, recompute the rest */
  XV.reg('ckpt-recompute', {
    style: 'strip', title: 'Gradient checkpointing, layer by layer', minw: 560,
    meas: 'memory: SmolLM2-135M, 2 × 512 tokens, measured in this lesson',
    steps: [
      { t: 'Plain forward pass', x: 'Every layer keeps all its intermediate results for the backward pass. For SmolLM2-135M on 2 × 512 tokens that is 2,633 MiB, five times the model’s own weights.' },
      { t: 'Checkpointed forward pass', x: 'Each layer keeps only its input and drops the rest. What remains is 569 MiB: the 30 layer inputs (68 MiB) plus the logits and loss at the top.' },
      { t: 'Backward: rebuild one layer at a time', x: 'Going backwards, each layer reruns its forward from the saved input, uses the rebuilt activations for its gradient, and frees them before moving on.' },
      { t: 'The price', x: 'One extra forward pass, a third more compute at most (5.14 s → 5.37 s on this CPU), and the gradients are identical to the last bit.' }
    ],
    build: function (c) {
      var X0 = 30, n = 8, Wd = 66; c.grow(0, 0); c.grow(720, 250);
      c.L = []; c.acts = []; c.ins = [];
      for (var k = 0; k < n; k++) {
        var x = X0 + k * Wd; c.L.push(c.mk('rect', { x: x, y: 150, width: Wd - 12, height: 30, rx: 5, fill: 'var(--xv-card)', stroke: 'var(--prod)' }));
        c.text(x + (Wd - 12) / 2, 169, 'layer ' + (k + 1), 'xv-ts');
        var a = c.mk('g', { opacity: 0, class: 'xv-fade' }); for (var j = 0; j < 4; j++) c.mk('rect', { x: x + 4, y: 120 - j * 22, width: Wd - 20, height: 18, rx: 3, fill: 'var(--accent)', opacity: 0.35 + 0.15 * j }, a);
        c.acts.push(a);
        c.ins.push(c.mk('rect', { x: x + 4, y: 196, width: Wd - 20, height: 10, rx: 3, fill: 'var(--ok)', opacity: 0, class: 'xv-fade' }));
      }
      c.text(X0 + 8 * Wd + 10, 120, 'stored', 'xv-ts', 'start'); c.text(X0 + 8 * Wd + 10, 205, 'inputs', 'xv-ts', 'start');
      c.mem = c.text(X0, 236, '', 'xv-tb', 'start');
      c.arrow = c.mk('path', { d: 'M0 0', class: 'xv-edge', 'stroke-width': 2, stroke: 'var(--prod)' });
    },
    enter: function (c, i) {
      c.acts.forEach(function (a) { a.style.opacity = 0; }); c.ins.forEach(function (r) { r.style.opacity = i >= 1 ? 1 : 0; });
      c.mem.textContent = ['saved for backward: 2,633 MiB', 'saved for backward: 569 MiB', 'peak: saved inputs + one rebuilt layer', 'gradients identical · +1 forward pass'][i];
      if (i === 0) c.acts.forEach(function (a, k) { setTimeout(function () { a.style.opacity = 1; }, 150 + k * 160); });
      if (i === 1) c.acts.forEach(function (a, k) { a.style.opacity = 1; setTimeout(function () { a.style.opacity = 0; }, 150 + k * 160); });
      if (i === 2) { var k = 7; (function step() { if (k < 0) return; var a = c.acts[k]; a.style.opacity = 1; c.L[k].setAttribute('fill', 'color-mix(in srgb, var(--prod) 22%, var(--xv-card))'); var kk = k; c.tween(650, function () {}, function () { a.style.opacity = 0; c.L[kk].setAttribute('fill', 'var(--xv-card)'); k--; step(); }); })(); }
    }
  });

  /* ---------------------------------------------------------------- 10.6 which tokens SFT learns from (real tokens, real losses) */
  var SF = {"toks":["<|im_start|>","system","\n","You"," are"," a"," helpful"," AI"," assistant"," named"," Sm","ol","LM",","," trained"," by"," H","ugging"," Face","<|im_end|>","\n","<|im_start|>","user","\n","What"," is"," ","1","5"," times"," ","7","?","<|im_end|>","\n","<|im_start|>","ass","istant","\n","1","5"," times"," ","7"," is"," ","1","0","5",".","<|im_end|>","\n"],"np":39,"loss":[null,16.12,4.07,7.68,2.08,2.66,9.42,9.57,4.29,7.68,7.58,7.26,17.45,2.22,3.74,1.46,6.42,2.8,1.33,25.37,2.96,24.02,9.61,1.71,5.36,1.46,6.06,1.61,3.19,5.4,0.1,2.82,0.33,26.78,1.68,14.94,10.37,0.38,0.19,3.4,0.49,1.1,0.6,0.17,0.66,1.86,1.4,1.93,1.84,1.55,14.66,0.7]};
  XV.reg('sft-mask', {
    style: 'strip', title: 'Which tokens SFT learns from', minw: 600,
    meas: 'SmolLM2 chat template · losses from the SmolLM2-135M base model',
    steps: [
      { t: 'One chat, as tokens', x: 'The template wraps the conversation in role markers. With SmolLM2’s default system prompt it is ' + SF.toks.length + ' tokens; the system prompt alone is folded into the first chip.' },
      { t: 'Mask the prompt', x: 'Every token up to and including “assistant↵” gets the label −100 and is ignored by the loss. Only the ' + (SF.toks.length - SF.np) + ' tokens of the answer are learning targets.' },
      { t: 'Loss on the answer only', x: 'The base model’s loss on each answer token: low on “ times 7 is”, higher on the digits, and 14.7 nats on <|im_end|>, a marker it has never seen. Teaching it where an answer stops is a large part of what SFT does.' }
    ],
    build: function (c) {
      var t = SF.toks, start = t.indexOf('<|im_start|>', 1), items = [['system prompt · ' + start + ' tokens', -1]];
      for (var k = start; k < t.length; k++) items.push([vis(t[k]), k]);
      var x = 10, y = 20, row = 0; c.chips = []; c.grow(0, 0); c.grow(720, 10);
      items.forEach(function (it) {
        var w = Math.max(24, it[0].length * 7.4 + 12); if (x + w > 710) { x = 10; y += 66; }
        var ch = chip(c, x, y, it[0], { w: w, fill: 'var(--xv-card)', cls: 'xv-ts', h: 24 }); ch.k = it[1];
        ch.bar = c.mk('rect', { x: x + 3, y: y + 26, width: w - 6, height: 0, rx: 2, fill: 'var(--accent)', opacity: 0.85 });
        ch.lbl = c.text(x + w / 2, y + 60, '', 'xv-ts'); c.chips.push(ch); x += w + 5;
      });
      c.grow(0, y + 66);
    },
    enter: function (c, i) {
      c.chips.forEach(function (ch) {
        var resp = ch.k >= SF.np;
        ch.g.style.opacity = i >= 1 && !resp ? 0.35 : 1;
        ch.r.setAttribute('stroke', i >= 1 && resp ? 'var(--accent)' : 'var(--line-strong)');
        ch.lbl.textContent = i === 1 && !resp && ch.k >= 0 ? '' : '';
        var L = resp && i === 2 ? SF.loss[ch.k] : 0, h0 = +ch.bar.getAttribute('height'), h1 = Math.min(22, L * 1.5 + (L ? 2 : 0));
        ch.bar.setAttribute('fill', L > 10 ? 'var(--bad)' : 'var(--accent)');
        c.tween(700, function (k) { ch.bar.setAttribute('height', h0 + (h1 - h0) * k); });
        ch.lbl.textContent = i === 2 && resp ? SF.loss[ch.k].toFixed(1) : (i === 1 && !resp ? '' : '');
      });
    }
  });
})();

/* Phase 10 diagrams, part C: isometric plates for systems with parts and flows */
(function () {
  'use strict';
  var XV = window.XV;
  function holder(c, g) { var h = c.mk('g', {}, g); h.redraw = function (fn) { while (h.firstChild) h.removeChild(h.firstChild); fn(h); }; return h; }

  /* ---------------------------------------------------------------- 10.3 the data pipeline, with the lesson's own counts */
  XV.reg('data-pipeline', {
    style: 'iso', title: 'From raw web pages to packed training rows',
    meas: 'counts from this lesson’s main.py run',
    chips: ['documents', 'tokens', 'rows of 128', 'row fill'],
    fmt: [function (x) { return Math.round(x); }, function (x) { return Math.round(x).toLocaleString('en'); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x) + '%'; }],
    legend: [['var(--prod)', 'document'], ['var(--bad)', 'dropped'], ['var(--accent)', 'tokens'], ['var(--ok)', 'packed row']],
    steps: [
      { n: 'Raw pages', t: '15 raw documents', x: 'Web text after HTML stripping: 15 documents of very different quality and length. Real crawls start at billions of pages; the stages are the same.', ch: [15, 0, 0, 0] },
      { n: 'Quality', t: 'Quality filter drops 2', x: 'Heuristics remove pages with fewer than 50 words or too many capitals and symbols. Two documents go to the bin.', ch: [13, 0, 0, 0] },
      { n: 'Dedup', t: 'MinHash finds a near-copy', x: 'Each document becomes 128 MinHash values; 16 bands of 8 bring likely duplicates together, and an exact Jaccard check (≥ 0.8) confirms one pair. One copy goes.', ch: [12, 0, 0, 0] },
      { n: 'Tokenize', t: 'Tokenize the survivors', x: 'A BPE tokenizer (357 tokens, trained on this corpus) turns the 12 documents into 2,660 tokens, about 2 characters per token.', ch: [12, 2660, 0, 0] },
      { n: 'Pack', t: 'Pack into fixed rows', x: 'Documents are laid end to end with separators and cut into rows of 128 tokens: 21 rows, 99% filled; only the last row needs padding.', ch: [12, 2660, 21, 99] }
    ],
    build: function (c) {
      c.OX = 360; c.OY = 40; c.floor(-2, -2, 30, 16);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { src: [2, 7, 3], q: [9, 7, 2.2], d: [15, 7, 2.2], tk: [21, 7, 2.2], pk: [27, 7, 2], bin: [10, 13, 1] };
      var n = c.n;
      c.wire(n.src, n.q, 0, W); c.wire(n.q, n.d, 0, W); c.wire(n.d, n.tk, 0, W); c.wire(n.tk, n.pk, 0, W); c.wire(n.q, n.bin, 1, W); c.wire(n.d, n.bin, 1, W);
      c.docs = []; for (var k = 0; k < 15; k++) { var d = c.box(0.6 + (k % 3) * 1.0, 5.6 + Math.floor(k / 3) * 0.55, 0, 0.8, 0.4, 0.9 + (k * 7 % 5) * 0.35, 'var(--prod)', N, { t: 10, sw: 0.8 }); d.classList.add('xv-fade'); c.docs.push(d); }
      c.q = c.box(8, 6, 0, 2, 2, 2.2, 'var(--warn)', N); c.d = c.box(14, 6, 0, 2, 2, 2.2, 'var(--ag)', N); c.tk = c.box(20, 6, 0, 2, 2, 2.2, 'var(--accent)', N);
      c.bin = c.cyl(10, 13, 0, 1, 1.2, 'var(--bad)', N);
      c.rows = []; for (var r = 0; r < 21; r++) { var g = c.box(25.5 + (r % 3) * 1.1, 4.4 + Math.floor(r / 3) * 0.8, 0, 1.0, 0.6, 0.25, 'var(--ok)', N, { t: 14, sw: 0.7 }); g.classList.add('xv-fade'); g.style.opacity = 0; c.rows.push(g); }
      c.label(2, 4.3, 3.6, ['raw documents'], T); c.label(9, 7, 3.3, ['quality filter', 'length, symbols'], T);
      c.label(15, 7, 3.3, ['MinHash + LSH', '128 hashes, 16 × 8'], T); c.label(21, 7, 3.3, ['BPE tokenizer', '357 tokens'], T);
      c.label(27, 3.2, 1.6, ['packer', 'rows of 128'], T); c.label(10, 13, -1.0, ['dropped'], T);
    },
    enter: function (c, i) {
      var n = c.n, drop = [3, 11], dup = 7;
      c.docs.forEach(function (d, k) { d.style.opacity = (i >= 1 && drop.indexOf(k) >= 0) || (i >= 2 && k === dup) ? 0.12 : (i >= 4 ? 0.35 : 1); });
      c.show(c.q, i >= 1); c.show(c.d, i >= 2); c.show(c.tk, i >= 3);
      c.rows.forEach(function (r, k) { r.style.opacity = 0; if (i >= 4) setTimeout(function () { r.style.opacity = 1; }, 200 + k * 70); });
      var P = 'var(--prod)';
      if (i === 0) [0, 1, 2].forEach(function (k) { c.fly([n.src, n.q], P, 1400, k * 380); });
      if (i === 1) { c.fly([n.src, n.q], P, 1200); c.fly([n.q, n.bin], 'var(--bad)', 1100, 1000); c.fly([n.q, n.bin], 'var(--bad)', 1100, 1500); }
      if (i === 2) { c.fly([n.q, n.d], P, 1200); c.fly([n.d, n.bin], 'var(--bad)', 1100, 1000); }
      if (i === 3) [0, 1, 2, 3].forEach(function (k) { c.fly([n.d, n.tk], P, 1100, k * 250); c.fly([n.tk, n.pk], 'var(--accent)', 1000, 900 + k * 250); });
      if (i === 4) [0, 1, 2, 3, 4].forEach(function (k) { c.fly([n.tk, n.pk], 'var(--accent)', 900, k * 220); });
    }
  });

  /* ---------------------------------------------------------------- 10.5 data parallel and ZeRO, memory per GPU */
  var Z = [[2, 2, 12], [2, 2, 3], [2, 0.5, 3], [0.5, 0.5, 3]];   // bytes per parameter on one of 4 GPUs: weights, grads, optimizer
  XV.reg('zero-shards', {
    style: 'iso', title: 'A 7B model on 4 GPUs: data parallel, then ZeRO',
    meas: '16 bytes per parameter with AdamW in mixed precision · 80 GB GPUs',
    chips: ['memory per GPU', 'fits in 80 GB?', 'gradient traffic per step'],
    fmt: [function (x) { return x.toFixed(1) + ' GB'; }, function (x) { return x > 0.5 ? 'yes' : 'no'; }, function (x) { return Math.round(x) + ' GB'; }],
    legend: [['var(--prod)', 'BF16 weights (2 B)'], ['var(--accent)', 'gradients (2 B)'], ['var(--warn)', 'FP32 master + Adam m, v (12 B)'], ['var(--ok)', 'all-reduce traffic']],
    steps: [
      { n: 'Replicate', t: 'Plain data parallel', x: 'Every GPU holds the whole training state: 2 bytes of weights, 2 of gradients and 12 of optimizer state per parameter. For 7B parameters that is 112 GB per GPU, more than an 80 GB H100 holds.', ch: [112, 0, 0] },
      { n: 'All-reduce', t: 'Each GPU sees different data, then they agree', x: 'Each GPU computes gradients on its own micro-batch, and a ring all-reduce averages them: every GPU sends and receives about 2 × (3/4) × 14 GB = 21 GB per step.', ch: [112, 0, 21] },
      { n: 'ZeRO-1', t: 'ZeRO-1: shard the optimizer state', x: 'Each GPU keeps only a quarter of the 12 bytes of optimizer state and updates only its quarter of the weights: 14 + 14 + 21 = 49 GB.', ch: [49, 1, 21] },
      { n: 'ZeRO-2', t: 'ZeRO-2: shard the gradients too', x: 'Gradients are reduce-scattered, so each GPU keeps only the quarter it updates: 14 + 3.5 + 21 = 38.5 GB, with the same traffic.', ch: [38.5, 1, 21] },
      { n: 'ZeRO-3', t: 'ZeRO-3 (FSDP): shard the weights', x: 'Weights are sharded too and all-gathered layer by layer just in time: 28 GB per GPU, a quarter of the original, for about 1.5× the communication.', ch: [28, 1, 32] }
    ],
    build: function (c) {
      c.OX = 330; c.OY = 30; c.floor(-2, -2, 26, 13);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.gx = [1, 7, 13, 19]; c.st = Z[0].slice(); c.stacks = [];
      c.gx.forEach(function (x, k) { c.box(x, 3, 0, 4, 4, 0.5, 'var(--line-strong)', N, { t: 10 }); c.stacks.push(holder(c, N)); c.label(x + 2, 7.6, -0.9, ['GPU ' + k], T); });
      var cap = c.P(0, 3, 0.5 + 80 / 9), cap2 = c.P(25, 3, 0.5 + 80 / 9);
      c.mk('line', { x1: cap[0], y1: cap[1], x2: cap2[0], y2: cap2[1], stroke: 'var(--bad)', 'stroke-dasharray': '6 4', 'stroke-width': 1.2 }, T);
      c.text(cap[0] - 6, cap[1] + 4, '80 GB', 'xv-ts', 'end', T);
      for (var k = 0; k < 4; k++) c.wireP([[c.gx[k] + 2, 10.5, 0.1], [c.gx[(k + 1) % 4] + 2, 10.5, 0.1]], 1, W);
      c.draw = function (s) {
        c.stacks.forEach(function (h, k) {
          h.redraw(function (g) {
            var z = 0.5, cols = ['var(--prod)', 'var(--accent)', 'var(--warn)'];
            s.forEach(function (b, j) { var hh = b * 7 / 9; if (hh > 0.02) c.box(c.gx[k] + 0.4, 3.4, z, 3.2, 3.2, hh, cols[j], g, { sw: 0.9 }); z += hh; });
          });
        });
      };
      c.draw(c.st);
    },
    enter: function (c, i) {
      var from = c.st.slice(), to = Z[Math.max(0, i - 1)];
      c.tween(900, function (k) { c.st = from.map(function (v, j) { return v + (to[j] - v) * k; }); c.draw(c.st); });
      var G = 'var(--ok)';
      if (i === 1 || i === 2 || i === 3) for (var k = 0; k < 4; k++) c.fly([[c.gx[k] + 2, 10.5, 0.1], [c.gx[(k + 1) % 4] + 2, 10.5, 0.1]], G, 1300, k * 200);
      if (i === 4) for (var j = 0; j < 4; j++) { c.fly([[c.gx[j] + 2, 10.5, 0.1], [c.gx[(j + 1) % 4] + 2, 10.5, 0.1]], G, 1200, j * 150); c.fly([[c.gx[j] + 2, 10.5, 0.1], [c.gx[(j + 3) % 4] + 2, 10.5, 0.1]], 'var(--prod)', 1300, 600 + j * 150); }
    }
  });

  /* ---------------------------------------------------------------- 10.7 the RLHF loop with PPO */
  XV.reg('rlhf-loop', {
    style: 'iso', title: 'One step of RLHF with PPO',
    meas: 'four models in memory · KL measured in this lesson: SmolLM2 Instruct vs base',
    chips: ['models in memory', 'forward passes per step', 'KL to reference'],
    fmt: [function (x) { return Math.round(x); }, function (x) { return Math.round(x); }, function (x) { return x ? x.toFixed(2) + ' nats/token' : '–'; }],
    legend: [['var(--accent)', 'policy (trained)'], ['var(--muted)', 'reference (frozen copy)'], ['var(--warn)', 'reward model'], ['var(--ok)', 'value model']],
    steps: [
      { n: 'Generate', t: 'The policy writes an answer', x: 'A prompt goes to the policy, the model being trained, which samples a full response token by token.', ch: [1, 1, 0] },
      { n: 'Reward', t: 'The reward model scores it', x: 'A separate model, trained on human preference pairs, reads prompt and response and returns one number: how much a person would prefer this answer.', ch: [2, 2, 0] },
      { n: 'Stay close', t: 'The reference model keeps it honest', x: 'A frozen copy of the starting model scores the same tokens. The difference in log-probabilities is a KL penalty that stops the policy from drifting into text that games the reward. For SmolLM2, Instruct differs from its base by 0.81 nats per token.', ch: [3, 3, 0.81] },
      { n: 'Advantage', t: 'The value model says what was expected', x: 'A value model predicts the reward from each position, so PPO can tell which tokens did better than expected (the advantage) rather than crediting the whole answer equally.', ch: [4, 4, 0.81] },
      { n: 'Update', t: 'PPO nudges the policy', x: 'The policy is updated to make better-than-expected tokens more likely, with a clipped step so one batch cannot move it far. Then the loop repeats with fresh samples.', ch: [4, 4, 0.81] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 40; c.floor(-2, -3, 30, 15);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { pr: [1, 9, 1], pol: [7, 9, 3.2], resp: [13, 9, 1.2], rm: [16, 1.4, 2.8], ref: [21, 1.4, 2.8], val: [26, 1.4, 2.8], up: [16, 13, 0.4] };
      var n = c.n;
      c.wire(n.pr, n.pol, 0, W); c.wire(n.pol, n.resp, 0, W); c.wire(n.resp, n.rm, 0, W); c.wire(n.resp, n.ref, 0, W); c.wire(n.resp, n.val, 0, W);
      c.loop = c.wireP([[n.val[0], n.val[1], 0.4], [n.val[0], 13, 0.4], n.up, [n.pol[0], n.pol[1] + 2, 0.4]], 1, W);
      c.pr = c.box(0, 8, 0, 2, 2, 1, 'var(--muted)', N); c.pol = c.box(5.5, 7.5, 0, 3, 3, 3.2, 'var(--accent)', N, { t: 14 });
      c.resp = c.box(12, 8, 0, 2, 2, 1.2, 'var(--accent)', N); c.rm = c.box(14.6, 0, 0, 2.8, 2.8, 2.8, 'var(--warn)', N);
      c.ref = c.box(19.6, 0, 0, 2.8, 2.8, 2.8, 'var(--muted)', N); c.val = c.box(24.6, 0, 0, 2.8, 2.8, 2.8, 'var(--ok)', N);
      c.label(-0.3, 10.4, 0.8, ['prompt'], T, 'end'); c.label(7, 9, 4.5, ['policy', 'being trained'], T); c.label(13, 9, 2.3, ['response'], T);
      c.label(16, 1.4, 4.1, ['reward model', 'one score'], T); c.label(21, 1.4, 4.1, ['reference', 'frozen copy'], T); c.label(26, 1.4, 4.1, ['value model', 'expected reward'], T);
      c.label(16, 13, -1.2, ['PPO update: clipped step'], T);
    },
    enter: function (c, i) {
      var n = c.n, A = 'var(--accent)';
      c.show(c.rm, i >= 1); c.show(c.ref, i >= 2); c.show(c.val, i >= 3); c.loop.style.opacity = i >= 4 ? 1 : 0.15;
      c.pol.style.filter = i === 4 ? 'drop-shadow(0 0 6px var(--accent))' : '';
      if (i === 0) { c.fly([n.pr, n.pol], 'var(--muted)', 1100); c.fly([n.pol, n.resp], A, 1100, 900); }
      if (i === 1) c.fly([n.resp, n.rm], 'var(--warn)', 1100);
      if (i === 2) c.fly([n.resp, n.ref], 'var(--muted)', 1100);
      if (i === 3) c.fly([n.resp, n.val], 'var(--ok)', 1100);
      if (i === 4) { c.fly([[n.val[0], n.val[1], 0.4], [n.val[0], 13, 0.4], n.up, [n.pol[0], n.pol[1] + 2, 0.4]], 'var(--ok)', 1800); }
    }
  });

  /* ---------------------------------------------------------------- 10.12 a serving engine: continuous batching and paged KV */
  XV.reg('serving-engine', {
    style: 'iso', title: 'Inside a serving engine', meas: 'vLLM-style: 16-token KV blocks · Llama 3 8B: 128 KB of KV per token',
    chips: ['requests running', 'KV blocks in use', 'KV memory'],
    fmt: [function (x) { return Math.round(x); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x) + ' MB'; }],
    legend: [['var(--prod)', 'request A'], ['var(--accent)', 'request B'], ['var(--ok)', 'request C'], ['var(--warn)', 'shared prefix']],
    steps: [
      { n: 'Queue', t: 'Requests wait in a queue', x: 'Three chats arrive with different prompt lengths. The scheduler admits them as long as their KV cache fits.', ch: [0, 0, 0] },
      { n: 'Prefill', t: 'Prefill: read each prompt in one pass', x: 'Each prompt is processed in one forward pass and its keys and values are written into fixed blocks of 16 tokens, each 2 MB for Llama 3 8B, allocated like memory pages, not one big slab per request.', ch: [3, 9, 18] },
      { n: 'Decode', t: 'Decode: one token for every request per step', x: 'Each step runs all running requests together, one new token each; a request takes a new block only when its last one fills up.', ch: [3, 11, 22] },
      { n: 'Swap in', t: 'Continuous batching', x: 'Request B finishes; its blocks return to the pool at once and request D joins the running batch mid-flight, without waiting for A and C to end.', ch: [3, 10, 20] },
      { n: 'Prefix', t: 'Shared prefixes are stored once', x: 'D starts with the same system prompt as A, so it points at A’s existing blocks instead of computing and storing them again (prefix caching).', ch: [3, 9, 18] }
    ],
    build: function (c) {
      c.OX = 330; c.OY = 40; c.floor(-2, -2, 28, 16);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { q: [2, 6, 1.6], sch: [8, 6, 2.2], gpu: [15, 6, 3.4], pool: [23, 6, 0.6] };
      var n = c.n; c.wire(n.q, n.sch, 0, W); c.wire(n.sch, n.gpu, 0, W); c.wire(n.gpu, n.pool, 1, W);
      c.req = ['var(--prod)', 'var(--accent)', 'var(--ok)', 'var(--ag)'].map(function (col, k) { var g = c.box(0.5, 2.6 + k * 1.6, 0, 2.6, 1.0, 0.8 + k * 0.2, col, N); g.classList.add('xv-fade'); return g; });
      c.sch = c.box(7, 5, 0, 2, 2, 2.2, 'var(--warn)', N); c.gpu = c.box(13.5, 4.5, 0, 3, 3, 3.4, 'var(--ink)', N, { t: 8, l: 20, r: 12 });
      c.pool = holder(c, N); c.blocks = [];
      c.label(1.8, 1.4, 1.6, ['queue'], T); c.label(8, 6, 3.4, ['scheduler'], T); c.label(15, 6, 4.6, ['GPU', 'one batch per step'], T); c.label(23.6, 0.6, 0.6, ['KV block pool', '16 tokens per block'], T);
      c.drawPool = function (own) {   // own: array of 30 colours or null
        c.pool.redraw(function (g) { for (var b = 0; b < 30; b++) { var col = own[b] || 'var(--line-strong)'; c.box(21.5 + (b % 5) * 1.05, 3 + Math.floor(b / 5) * 1.05, 0, 0.85, 0.85, own[b] ? 0.55 : 0.15, col, g, { sw: 0.7, t: own[b] ? 20 : 8 }); } });
      };
      c.drawPool([]);
    },
    enter: function (c, i) {
      var A = 'var(--prod)', B = 'var(--accent)', C = 'var(--ok)', D = 'var(--ag)', S = 'var(--warn)', own = [], put = function (col, k) { for (var j = 0; j < k; j++) own.push(col); };
      if (i === 1) { put(S, 2); put(A, 2); put(B, 3); put(C, 2); }
      if (i === 2) { put(S, 2); put(A, 3); put(B, 3); put(C, 3); }
      if (i === 3) { put(S, 2); put(A, 3); put(null, 3); put(C, 3); put(D, 2); }
      if (i === 4) { put(S, 2); put(A, 3); put(null, 3); put(C, 3); put(D, 1); }
      c.drawPool(own);
      c.req.forEach(function (r, k) { r.style.opacity = i === 0 ? (k < 3 ? 1 : 0.15) : (k === 3 ? (i >= 3 ? 0.35 : 1) : (k === 1 && i >= 3 ? 0.12 : 0.35)); });
      var n = c.n;
      if (i === 0) [A, B, C].forEach(function (col, k) { c.fly([n.q, n.sch], col, 1100, k * 300); });
      if (i === 1) [A, B, C].forEach(function (col, k) { c.fly([n.sch, n.gpu], col, 1000, k * 250); c.fly([n.gpu, n.pool], col, 1000, 900 + k * 250); });
      if (i === 2) [A, B, C].forEach(function (col, k) { c.fly([n.gpu, n.pool], col, 900, k * 120); });
      if (i === 3) { c.fly([n.q, n.sch], D, 1000); c.fly([n.sch, n.gpu], D, 1000, 800); }
      if (i === 4) { c.fly([n.pool, n.gpu], S, 1000); c.fly([n.gpu, n.pool], D, 900, 900); }
    }
  });

  /* ---------------------------------------------------------------- 10.21 Jamba's memory as the context grows */
  XV.reg('jamba-memory', {
    style: 'iso', title: 'Jamba’s memory as the context grows', meas: 'Jamba v0.1 shape: 32 layers, 4 attention (8 KV heads), 28 Mamba · BF16',
    chips: ['context', 'KV cache (4 attention layers)', 'Mamba state (28 layers)', 'same model, all attention'],
    fmt: [function (x) { return x >= 1000 ? Math.round(x / 1024) + 'K' : Math.round(x) + ''; }, function (x) { return x >= 1024 ? (x / 1024).toFixed(1) + ' GiB' : Math.round(x) + ' MiB'; }, function (x) { return x.toFixed(1) + ' MiB'; }, function (x) { return x >= 1024 ? (x / 1024).toFixed(1) + ' GiB' : Math.round(x) + ' MiB'; }],
    legend: [['var(--prod)', 'Mamba layer (fixed state)'], ['var(--accent)', 'attention layer'], ['var(--ag)', 'KV cache'], ['var(--ok)', 'Mamba state']],
    steps: [
      { n: 'One block', t: 'One Jamba block: 8 layers', x: 'Seven Mamba layers and one attention layer, with mixture-of-experts on every other layer. Jamba stacks four such blocks: 32 layers.', ch: [0, 0, 8.3, 0] },
      { n: 'A token', t: 'A token climbs the stack', x: 'Each Mamba layer folds the token into its fixed-size state; only the attention layer stores the token’s keys and values.', ch: [1024, 16, 8.3, 128] },
      { n: '32K', t: 'At 32K tokens', x: 'The attention layers’ KV cache has grown to 512 MiB; the Mamba state is still 8.3 MiB, as it was after one token.', ch: [32768, 512, 8.3, 4096] },
      { n: '256K', t: 'At 256K tokens', x: 'KV cache 4 GiB, state unchanged. The same 32 layers as all-attention would need 32 GiB: the hybrid keeps an eighth of the memory and the few attention layers that give exact recall.', ch: [262144, 4096, 8.3, 32768] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 30; c.floor(-2, -1, 22, 14);
      var N = c.mk('g', {}), T = c.mk('g', {});
      c.layers = [];
      for (var k = 0; k < 8; k++) { var att = k === 4; var g = c.box(2, 3, k * 1.0, 5, 5, 0.75, att ? 'var(--accent)' : 'var(--prod)', N, { sw: 0.9 }); g.classList.add('xv-fade'); c.layers.push(g);
        var lp = c.P(2, 8, k * 1.0 + 0.4); c.text(lp[0] - 8, lp[1] + 4, att ? 'attention' : 'Mamba' + (k % 2 ? ' + MoE' : ''), att ? 'xv-tb' : 'xv-ts', 'end', T);
        if (!att) { var s = c.box(7.6, 2.4, k * 1.0 + 0.1, 0.9, 0.9, 0.55, 'var(--ok)', N, { sw: 0.7 }); s.classList.add('xv-fade'); } }
      c.kv = holder(c, N); c.ghost = holder(c, N);
      c.label(9.2, 2.2, 8.6, ['Mamba state', 'fixed size'], T, 'start'); c.label(13, 10, -1.3, ['KV cache'], T);
      c.drawKV = function (h, gh) {
        c.kv.redraw(function (g) { c.cyl(13, 10, 0, 1.8, Math.max(0.05, h), 'var(--ag)', g); });
        c.ghost.redraw(function (g) { if (gh > 0) { var gg = c.cyl(19.5, 11.5, 0, 1.8, gh, 'var(--line-strong)', g); gg.style.opacity = 0.55; var p = c.P(19.5, 11.5, gh + 0.6); c.text(p[0], p[1] - 14, 'all-attention', 'xv-ts', 'middle', g); } });
      };
      c.h = 0; c.gh = 0; c.drawKV(0, 0);
    },
    enter: function (c, i) {
      var h1 = [0, 0.02, 0.15, 1.2][i], g1 = i === 3 ? 9.6 : 0, h0 = c.h, g0 = c.gh;
      c.tween(1200, function (k) { c.h = h0 + (h1 - h0) * k; c.gh = g0 + (g1 - g0) * k; c.drawKV(c.h, c.gh); });
      if (i === 1) { var path = []; for (var k = 0; k < 8; k++) path.push([4.5, 5.5, k + 0.9]); c.fly(path, 'var(--accent)', 2400); c.fly([[4.5, 5.5, 4.9], [13, 10, 0.4]], 'var(--ag)', 1200, 1300); }
      if (i === 2 || i === 3) [0, 1, 2].forEach(function (k) { c.fly([[4.5, 5.5, 4.9], [13, 10, h1 + 0.2]], 'var(--ag)', 1100, k * 350); });
    }
  });
})();

/* Phases 8 and 9: diffusion, latent diffusion, the RL loop, DQN, PPO's clip */
(function () {
  'use strict';
  var XV = window.XV;

  /* ---------------------------------------------------------------- 8.6 the forward process on a real photo */
  var DD = {"t":[0,100,300,600,999],"img":["data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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"],"ab":[1.0,0.895,0.394,0.0256,4.04e-05]};
  XV.reg('ddpm-forward', {
    style: 'strip', title: 'Noising a real photo, DDPM schedule', minw: 560,
    meas: 'Imagenette image · linear β from 0.0001 to 0.02 · 1,000 steps',
    steps: [
      { t: 'The clean image', x: 'x₀ is a real photo scaled to [−1, 1]. The forward process will mix it with Gaussian noise, a little at each of 1,000 steps.' },
      { t: 'Step 100', x: 'In closed form, xₜ = √āₜ·x₀ + √(1−āₜ)·ε. At t = 100, ā = 0.895: the image keeps 95% of its amplitude and the noise is already visible.' },
      { t: 'Step 300', x: 'ā = 0.394: signal and noise are now close in size (0.63 against 0.78). Shapes survive; fine texture is gone.' },
      { t: 'Steps 600 and 999', x: 'ā = 0.026 at t = 600 and 0.00004 at t = 999: almost pure noise. Training teaches a network to predict ε from xₜ and t at every level; generation runs this film backwards.' }
    ],
    build: function (c) {
      c.grow(0, 0); c.grow(700, 214); c.ims = [];
      DD.img.forEach(function (src, k) {
        var x = 14 + k * 136, g = c.mk('g', { class: 'xv-fade', opacity: 0 });
        c.mk('image', { href: src, x: x, y: 14, width: 124, height: 124, preserveAspectRatio: 'xMidYMid slice' }, g);
        c.mk('rect', { x: x, y: 14, width: 124, height: 124, fill: 'none', stroke: 'var(--line-strong)' }, g);
        c.text(x + 62, 158, 't = ' + DD.t[k], 'xv-tb', 'middle', g);
        var a = DD.ab[k];
        c.mk('rect', { x: x, y: 170, width: 124, height: 8, rx: 3, fill: 'var(--line)' }, g);
        c.mk('rect', { x: x, y: 170, width: 124 * Math.sqrt(a), height: 8, rx: 3, fill: 'var(--accent)' }, g);
        c.text(x + 62, 198, '√ā = ' + Math.sqrt(a).toFixed(a < 0.01 ? 3 : 2), 'xv-ts', 'middle', g);
        c.ims.push(g);
      });
    },
    enter: function (c, i) {
      var vis = [[0], [0, 1], [0, 1, 2], [0, 1, 2, 3, 4]][i];
      c.ims.forEach(function (g, k) { var on = vis.indexOf(k) >= 0; g.style.opacity = on ? 1 : 0; });
      var last = vis[vis.length - 1]; c.ims[last].style.opacity = 0;
      setTimeout(function () { vis.forEach(function (k) { c.ims[k].style.opacity = 1; }); }, 120);
    }
  });

  /* ---------------------------------------------------------------- 8.7 Stable Diffusion's three networks */
  XV.reg('latent-diffusion', {
    style: 'iso', title: 'Stable Diffusion 1.5, one image', meas: 'parameter counts of the SD 1.5 checkpoints · 512 × 512 output',
    chips: ['numbers the U-Net works on', 'U-Net calls', 'networks used'],
    fmt: [function (x) { return Math.round(x).toLocaleString('en'); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x) + ' / 3'; }],
    legend: [['var(--warn)', 'text encoder (CLIP ViT-L, 123M)'], ['var(--prod)', 'U-Net (860M)'], ['var(--ok)', 'VAE decoder (84M)'], ['var(--ag)', 'latent 4 × 64 × 64']],
    steps: [
      { n: 'Prompt', t: 'The prompt becomes 77 vectors', x: 'CLIP’s text encoder turns the prompt into 77 token embeddings of 768 numbers. They steer every denoising step through cross-attention.', ch: [0, 0, 1] },
      { n: 'Noise', t: 'Start from noise in a small latent', x: 'Instead of 512 × 512 × 3 = 786,432 pixel values, the work happens in a 4 × 64 × 64 latent: 16,384 numbers, 48× fewer. It starts as pure Gaussian noise.', ch: [16384, 0, 1] },
      { n: 'Denoise', t: 'The U-Net removes noise, step by step', x: 'At each step the U-Net predicts the noise in the latent, conditioned on the text, and the sampler removes part of it. 50 steps is a common setting: 50 U-Net calls (100 with classifier-free guidance).', ch: [16384, 50, 2] },
      { n: 'Decode', t: 'The VAE decoder paints pixels', x: 'One pass of the VAE decoder expands the clean latent 8× in each direction into the 512 × 512 image. Only this last step works at pixel resolution.', ch: [786432, 50, 3] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 40; c.floor(-2, -2, 26, 14);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { txt: [2, 3, 1.4], te: [7, 3, 2.6], lat: [9, 10, 0.9], un: [15, 6, 3.6], vae: [21, 9, 2.6], img: [25.5, 9, 0.2] };
      var n = c.n;
      c.wire(n.txt, n.te, 0, W); c.wire(n.te, n.un, 1, W); c.wire(n.lat, n.un, 0, W); c.wire(n.un, n.vae, 0, W); c.wire(n.vae, n.img, 0, W);
      c.box(0.5, 2, 0, 3, 2, 1.4, 'var(--muted)', N); c.te = c.box(5.8, 1.8, 0, 2.4, 2.4, 2.6, 'var(--warn)', N);
      c.lat = c.mk('g', {}, N); for (var a = 0; a < 4; a++) c.box(7.8, 8.8, a * 0.22, 2.4, 2.4, 0.18, 'var(--ag)', c.lat, { sw: 0.8 });
      c.un = c.box(13.3, 4.3, 0, 3.4, 3.4, 3.6, 'var(--prod)', N, { t: 12 }); c.vae = c.box(19.8, 7.8, 0, 2.4, 2.4, 2.6, 'var(--ok)', N);
      c.img = c.box(23.5, 7.2, 0, 4, 4, 0.2, 'var(--accent)', N, { t: 30 });
      c.label(0.6, 4.6, 1.0, ['prompt'], T, 'end'); c.label(7, 3, 3.9, ['CLIP text encoder', '77 × 768'], T); c.label(9, 10, -1.2, ['latent', '4 × 64 × 64'], T);
      c.label(15, 6, 4.9, ['U-Net', 'predicts the noise'], T); c.label(21, 9, 3.9, ['VAE decoder'], T); c.label(25.5, 9, -1.4, ['512 × 512 image'], T);
    },
    enter: function (c, i) {
      var n = c.n;
      c.show(c.te, true); c.show(c.lat, i >= 1); c.show(c.un, i >= 2); c.show(c.vae, i >= 3); c.show(c.img, i >= 3);
      if (i === 0) c.fly([n.txt, n.te], 'var(--muted)', 1100);
      if (i === 1) c.fly([n.te, n.un], 'var(--warn)', 1300);
      if (i === 2) { var loop = [n.lat, n.un, [n.lat[0] + 2, n.lat[1] - 1, 0.9]]; for (var k = 0; k < 3; k++) c.fly(loop, 'var(--ag)', 1500, k * 500); c.fly([n.te, n.un], 'var(--warn)', 1300, 300); }
      if (i === 3) { c.fly([n.un, n.vae], 'var(--ag)', 1100); c.fly([n.vae, n.img], 'var(--ok)', 1100, 900); }
    }
  });

  /* ---------------------------------------------------------------- 9.1 agent and environment */
  XV.reg('rl-loop', {
    style: 'iso', title: 'The agent–environment loop', meas: 'the lesson’s 4 × 4 grid · −1 per move · γ = 0.9',
    chips: ['time step t', 'last reward', 'return so far'],
    fmt: [function (x) { return Math.round(x); }, function (x) { return (x > 0 ? '+' : '') + Math.round(x); }, function (x) { return x.toFixed(2); }],
    legend: [['var(--prod)', 'state sₜ'], ['var(--accent)', 'action aₜ'], ['var(--ok)', 'reward rₜ₊₁']],
    steps: [
      { n: 'Observe', t: 'The agent sees a state', x: 'The environment reports its state: the agent’s square, (0, 0) on the 4 × 4 grid. The policy maps each state to a choice of action.', ch: [0, 0, 0] },
      { n: 'Act', t: 'It acts; the world answers', x: 'The agent moves right. The environment returns the next state, (0, 1), and a reward of −1. Every move costs one, so shorter paths are better.', ch: [1, -1, -1] },
      { n: 'Repeat', t: 'Again and again', x: 'Two more moves at −1 each. Later rewards count less: the reward k steps ahead is weighted by γᵏ = 0.9ᵏ. So far the return is −1 − 0.9 − 0.81 = −2.71.', ch: [3, -1, -2.71] },
      { n: 'Terminal', t: 'The episode ends', x: 'The sixth move reaches (3, 3), the terminal state, and the episode stops. Return G = −(1 + 0.9 + … + 0.9⁵) = −4.69, the best any policy can do from (0, 0). Learning means finding the policy with the highest expected return.', ch: [6, -1, -4.69] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 30; c.floor(-2, -2, 22, 12);
      var N = c.mk('g', {}), W = c.mk('g', {}), T = c.mk('g', {});
      c.agent = c.box(1, 3, 0, 3, 3, 3, 'var(--accent)', N, { t: 14 });
      c.cells = [];
      for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) { var goal = r === 3 && q === 3, g = c.box(10 + q * 2, 1 + r * 2, 0, 1.8, 1.8, 0.25, goal ? 'var(--ok)' : 'var(--line-strong)', N, { t: goal ? 30 : 10, sw: 0.8 }); c.cells.push(g); }
            c.pos = c.mk('g', {}, N); c.place = function (k) { while (c.pos.firstChild) c.pos.removeChild(c.pos.firstChild); var cc = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]][k]; c.box(10.45 + cc[0] * 2, 1.45 + cc[1] * 2, 0.25, 0.9, 0.9, 0.9, 'var(--accent)', c.pos, { t: 20 }); };
      c.st = c.wireP([[17, 9, 0.3], [9, 11, 0.3], [2.5, 7, 1]], 1, W); c.ac = c.wireP([[4, 3, 2], [9, 1, 0.3], [10, 1, 0.3]], 1, W);
      c.label(2.5, 4.5, 4.3, ['agent', 'policy π(a | s)'], T); c.label(16, 1, 1.7, ['environment', '4 × 4 grid'], T); c.label(18.4, 8.2, 0.4, ['terminal (3, 3)'], T, 'start');
      c.label(8, 11.5, -1.0, ['state, reward'], T); c.label(7, 0.4, 1.4, ['action'], T);
      c.place(0);
    },
    enter: function (c, i) {
      var k = [0, 1, 3, 6][i]; c.place(k);
      var S = [[17, 9, 0.3], [9, 11, 0.3], [2.5, 7, 1]], A = [[4, 3, 2], [9, 1, 0.3], [10, 1, 0.3]];
      if (i === 0) c.fly(S, 'var(--prod)', 1500);
      else { c.fly(A, 'var(--accent)', 1100); c.fly(S, 'var(--prod)', 1400, 1000); c.fly(S, 'var(--ok)', 1400, 1200); }
    }
  });

  /* ---------------------------------------------------------------- 9.5 DQN: replay buffer and target network */
  XV.reg('dqn-replay', {
    style: 'iso', title: 'DQN: learn from replayed experience', meas: 'settings from Mnih et al. 2015 (Atari)',
    chips: ['replay buffer', 'minibatch', 'target network synced every'],
    fmt: [function (x) { return x >= 1e6 ? '1,000,000' : Math.round(x).toLocaleString('en'); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x).toLocaleString('en') + ' steps'; }],
    legend: [['var(--prod)', 'transition (s, a, r, s′)'], ['var(--accent)', 'online Q-network'], ['var(--muted)', 'target Q-network'], ['var(--ok)', 'TD target']],
    steps: [
      { n: 'Act', t: 'Act with ε-greedy', x: 'The online network picks the action with the highest Q-value, except with probability ε (1.0 falling to 0.1) it acts at random to keep exploring.', ch: [0, 0, 10000] },
      { n: 'Store', t: 'Store every transition', x: 'Each (state, action, reward, next state) goes into a replay buffer holding the last million transitions.', ch: [1e6, 0, 10000] },
      { n: 'Sample', t: 'Learn from a random minibatch', x: 'Training draws 32 transitions at random from the buffer. Random draws break the correlation between consecutive frames that makes online updates unstable.', ch: [1e6, 32, 10000] },
      { n: 'Target', t: 'Bootstrap from a frozen copy', x: 'The TD target r + γ·maxₐ′ Q(s′, a′) uses a target network, a copy of the online network refreshed every 10,000 steps, so the target does not move with every update.', ch: [1e6, 32, 10000] },
      { n: 'Update', t: 'Regress Q towards the target', x: 'The online network’s Q(s, a) is pulled towards the target with a Huber loss, and the loop continues: act, store, sample, update.', ch: [1e6, 32, 10000] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 30; c.floor(-2, -2, 26, 14);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { env: [2, 7, 1.6], on: [9, 3, 3], buf: [10, 11, 2.6], tg: [17, 3, 3], loss: [20, 10, 1.6] };
      var n = c.n;
      c.wire(n.env, n.on, 0, W); c.wire(n.env, n.buf, 0, W); c.wire(n.buf, n.on, 1, W); c.wire(n.buf, n.tg, 1, W); c.wire(n.tg, n.loss, 0, W); c.wire(n.on, n.loss, 0, W);
      c.env = c.box(0, 5.5, 0, 3.4, 3, 1.6, 'var(--line-strong)', N, { t: 10 });
      c.on = c.box(7.6, 1.6, 0, 2.8, 2.8, 3, 'var(--accent)', N, { t: 14 }); c.tg = c.box(15.6, 1.6, 0, 2.8, 2.8, 3, 'var(--muted)', N);
      c.buf = c.mk('g', {}, N); c.bh = 0.2; c.drawBuf = function (h) { while (c.buf.firstChild) c.buf.removeChild(c.buf.firstChild); c.cyl(10, 11, 0, 1.6, h, 'var(--prod)', c.buf); };
      c.drawBuf(0.2);
      c.loss = c.box(19, 9, 0, 2, 2, 1.6, 'var(--ok)', N);
      c.label(1.7, 7, 2.5, ['environment', 'Atari game'], T); c.label(9, 3, 4.3, ['online Q-net'], T); c.label(17, 3, 4.3, ['target Q-net', 'frozen copy'], T);
      c.label(10, 11, -1.3, ['replay buffer', 'last 1M transitions'], T); c.label(21.5, 11.5, -0.5, ['loss', 'Q(s,a) vs r + γ max Q′'], T);
    },
    enter: function (c, i) {
      var n = c.n, h0 = c.bh, h1 = i >= 1 ? 2.6 : 0.2;
      c.tween(900, function (k) { c.bh = h0 + (h1 - h0) * k; c.drawBuf(c.bh); });
      c.show(c.tg, i >= 3); c.show(c.loss, i >= 3);
      if (i === 0) { c.fly([n.env, n.on], 'var(--prod)', 1100); c.fly([n.on, n.env], 'var(--accent)', 1100, 900); }
      if (i === 1) [0, 1, 2, 3].forEach(function (k) { c.fly([n.env, [10, 11, 2.8]], 'var(--prod)', 1000, k * 260); });
      if (i === 2) [0, 1, 2].forEach(function (k) { c.fly([[10, 11, 2.8], n.on], 'var(--prod)', 1000, k * 260); });
      if (i === 3) { c.fly([[10, 11, 2.8], n.tg], 'var(--prod)', 1000); c.fly([n.tg, n.loss], 'var(--ok)', 1000, 900); }
      if (i === 4) { c.fly([n.on, n.loss], 'var(--accent)', 1000); c.fly([n.loss, n.on], 'var(--ok)', 1000, 1000); c.fly([n.on, n.tg], 'var(--muted)', 1200, 2000); }
    }
  });

  /* ---------------------------------------------------------------- 9.8 PPO's clipped objective */
  XV.reg('ppo-clip', {
    style: 'strip', title: 'PPO’s clipped objective', minw: 560, meas: 'ε = 0.2 · L = min(r·A, clip(r, 0.8, 1.2)·A)',
    steps: [
      { t: 'The probability ratio', x: 'r = π_new(a|s) / π_old(a|s): how much more (r > 1) or less (r < 1) likely the new policy makes an action the old policy took. At r = 1 nothing has changed.' },
      { t: 'A good action (A > 0)', x: 'The objective r·A rewards making the action more likely, but only up to r = 1.2. Beyond that the clip makes it flat: no gradient, no reason to push further on this sample.' },
      { t: 'A bad action (A < 0)', x: 'For a worse-than-expected action, the objective rewards making it less likely, down to r = 0.8; below that it is flat. In both cases the min keeps the pessimistic of the two terms.' },
      { t: 'Why it is stable', x: 'One batch of samples can move each action’s probability only by about 20% before its gradient vanishes. That small trust region is most of why PPO trains reliably.' }
    ],
    build: function (c) {
      var X0 = 70, X1 = 650, Y0 = 130, sx = (X1 - X0) / 2, sy = 70; c.grow(0, 0); c.grow(700, 250);
      var X = function (r) { return X0 + r * sx; }, Y = function (v) { return Y0 - v * sy; };
      c.mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: 'var(--line-strong)' }); c.mk('line', { x1: X(1), x2: X(1), y1: 20, y2: 240, stroke: 'var(--line-strong)', 'stroke-dasharray': '3 4' });
      [0, 0.5, 0.8, 1, 1.2, 1.5, 2].forEach(function (r) { c.text(X(r), Y0 + 18, String(r), 'xv-ts'); });
      c.text(X1, Y0 + 36, 'ratio r', 'xv-ts', 'end');
      c.band = c.mk('rect', { x: X(0.8), y: 20, width: X(1.2) - X(0.8), height: 220, fill: 'var(--accent)', opacity: 0, class: 'xv-fade' });
      var curve = function (A) { var d = ''; for (var r = 0; r <= 2.0001; r += 0.02) { var v = Math.min(r * A, Math.max(0.8, Math.min(1.2, r)) * A); d += (d ? ' L' : 'M') + X(r).toFixed(1) + ' ' + Y(v).toFixed(1); } return d; };
      c.pos = c.mk('path', { d: curve(1), fill: 'none', stroke: 'var(--ok)', 'stroke-width': 3, class: 'xv-fade' });
      c.neg = c.mk('path', { d: curve(-1), fill: 'none', stroke: 'var(--bad)', 'stroke-width': 3, class: 'xv-fade' });
      c.posL = c.text(X(1.6), Y(1.2) - 10, 'A > 0: flat after 1.2', 'xv-tb', 'middle'); c.negL = c.text(X(0.4), Y(-0.8) + 26, 'A < 0: flat below 0.8', 'xv-tb', 'middle');
      [c.posL, c.negL].forEach(function (t) { t.classList.add('xv-fade'); });
      c.dot = c.mk('circle', { r: 6, cx: X(1), cy: Y0, fill: 'var(--accent)' }); c.X = X; c.Y = Y;
      [c.pos, c.neg].forEach(function (p) { var L = p.getTotalLength ? 1200 : 0; p.style.strokeDasharray = 1200; p.style.strokeDashoffset = 1200; });
    },
    enter: function (c, i) {
      var draw = function (p, on) { p.style.transition = 'stroke-dashoffset 1.2s ease, opacity .4s'; p.style.strokeDashoffset = on ? 0 : 1200; };
      draw(c.pos, i === 1 || i === 3); draw(c.neg, i === 2 || i === 3);
      c.posL.style.opacity = i === 1 || i === 3 ? 1 : 0; c.negL.style.opacity = i === 2 || i === 3 ? 1 : 0; c.band.style.opacity = i === 3 ? 0.12 : 0;
      var A = i === 2 ? -1 : 1, r0 = 1;
      if (i === 1 || i === 2) c.tween(2400, function (k) { var r = i === 1 ? 1 + k * 0.8 : 1 - k * 0.6, v = Math.min(r * A, Math.max(0.8, Math.min(1.2, r)) * A); c.dot.setAttribute('cx', c.X(r)); c.dot.setAttribute('cy', c.Y(v)); });
      else { c.dot.setAttribute('cx', c.X(1)); c.dot.setAttribute('cy', c.Y(i === 3 ? 1 : 0)); c.dot.style.opacity = i === 0 ? 1 : 0.0; }
      c.dot.style.opacity = i === 3 ? 0 : 1;
    }
  });
})();

/* Volumes 1 and 2: backprop with numbers (3.3), ViT patches (4.14), a feature store (2.21),
   parent-document retrieval (5.23), Whisper end to end (6.5). Only where the lesson's own figure leaves the system unshown. */
(function () {
  'use strict';
  var XV = window.XV;
  var loc = function (x) { return Math.round(x).toLocaleString('en'); };
  function chip(c, x, y, s, o) {           // a rounded label chip; returns {g, w, r, t}
    o = o || {}; var w = o.w || Math.max(24, s.length * 8.2 + 14), g = c.mk('g', {}, o.g);
    var r = c.mk('rect', { x: x, y: y, width: w, height: o.h || 26, rx: 6, fill: o.fill || 'var(--xv-face)', stroke: o.stroke || 'var(--line-strong)', 'stroke-width': 1.1 }, g);
    var t = c.text(x + w / 2, y + (o.h || 26) / 2 + 4.5, s, o.cls || 'xv-t', 'middle', g);
    c.grow(x, y); c.grow(x + w, y + (o.h || 26));
    return { g: g, w: w, r: r, t: t };
  }
  function seq(c, fns, gap) {               // run fns one after another, gap ms apart, cancelled on step change
    var i = 0; (function next() { if (i >= fns.length) return; fns[i++](); c.tween(gap, function () {}, next); })();
  }
  var op = function (el, on) { el.style.transition = 'opacity .4s'; el.style.opacity = on ? 1 : 0; };

  /* ---------------------------------------------------------------- 3.3 one backward pass through the lesson's graph */
  XV.reg('backprop-graph', {
    style: 'strip', title: 'One backward pass, with numbers', minw: 560,
    meas: 'the lesson’s graph · x = 1.5 · w = 0.8 · b = −0.2 · target y = 1',
    steps: [
      { t: 'Forward: values flow right', x: 'z₁ = w·x = 1.2, then z₂ = z₁ + b = 1.0, then a = σ(1.0) = 0.731. Every node keeps its value, because the backward pass will need it.' },
      { t: 'The loss starts the backward pass', x: 'L = (a − y)² = (0.731 − 1)² = 0.0723. The first gradient is ∂L/∂a = 2(a − y) = −0.538. It is negative: raising a would lower the loss.' },
      { t: 'Backward: gradients flow left', x: 'Each node multiplies the gradient from above by its local derivative. σ gives a(1 − a) = 0.197, so ∂L/∂z₂ = −0.106. The + node passes it unchanged to b and z₁. The × node multiplies by its other input: ∂L/∂w = −0.106 × 1.5 = −0.159 and ∂L/∂x = −0.106 × 0.8 = −0.085.' },
      { t: 'Update: one step downhill', x: 'With a learning rate of 1.0, w becomes 0.8 + 0.159 = 0.959 and b becomes −0.2 + 0.106 = −0.094. Run forward again: a = 0.793, and the loss falls from 0.0723 to 0.0428.' }
    ],
    build: function (c) {
      c.grow(0, 26); c.grow(700, 224);
      var E = function (x1, y1, x2, y2) { c.mk('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--line-strong)', 'stroke-width': 1.4 }); };
      E(92, 72, 152, 110); E(92, 168, 152, 130); E(190, 120, 310, 120); E(330, 64, 330, 100); E(350, 120, 460, 120); E(500, 120, 612, 120); E(645, 64, 645, 96);
      var node = function (x, y, s) { c.mk('circle', { cx: x, cy: y, r: 20, fill: 'var(--xv-face)', stroke: 'var(--ink)', 'stroke-width': 1.3 }); c.text(x, y + 5, s, 'xv-tb', 'middle'); };
      node(170, 120, '×'); node(330, 120, '+'); node(480, 120, 'σ');
      c.mk('rect', { x: 612, y: 96, width: 66, height: 48, rx: 8, fill: 'var(--xv-face)', stroke: 'var(--ink)', 'stroke-width': 1.3 }); c.text(645, 125, '(a − y)²', 'xv-ts', 'middle');
      c.xin = chip(c, 12, 59, 'x = 1.5', { w: 80 }); c.win = chip(c, 12, 155, 'w = 0.8', { w: 80 });
      c.bin = chip(c, 290, 38, 'b = −0.2', { w: 80 }); c.yin = chip(c, 605, 38, 'y = 1', { w: 80 });
      var V = function (x, y, s, col, anchor) { var t = c.text(x, y, s, 'xv-tb', anchor || 'middle'); t.setAttribute('fill', col); t.style.opacity = 0; return t; };
      var P = 'var(--prod)', A = 'var(--accent)';
      c.fw = [V(250, 110, 'z₁ = 1.2', P), V(405, 110, 'z₂ = 1.0', P), V(556, 110, 'a = 0.731', P)];
      c.L = V(690, 172, 'L = 0.0723', P, 'end');
      c.bw = [V(556, 145, '∂L/∂a = −0.538', A), V(480, 90, '× a(1 − a) = 0.197', A), V(405, 145, '∂L/∂z₂ = −0.106', A),
              V(378, 56, '∂L/∂b = −0.106', A, 'start'), V(250, 145, '∂L/∂z₁ = −0.106', A), V(52, 208, '∂L/∂w = −0.159', A), V(52, 46, '∂L/∂x = −0.085', A)];
      c.FW = [[92, 72], [170, 120], [330, 120], [480, 120], [612, 120]];
      c.BW = [[612, 120], [480, 120], [330, 120], [170, 120], [92, 168]];
    },
    enter: function (c, i) {
      c.fw.forEach(function (t) { op(t, i >= 1); }); op(c.L, i >= 1);
      c.bw.forEach(function (t, k) { op(t, i >= 3 || (i === 1 && k === 0)); });
      var up = i === 3;
      c.win.t.textContent = up ? 'w = 0.959' : 'w = 0.8'; c.bin.t.textContent = up ? 'b = −0.094' : 'b = −0.2';
      c.L.textContent = up ? 'L = 0.0428 (was 0.0723)' : 'L = 0.0723';
      [c.win, c.bin].forEach(function (ch) { ch.r.setAttribute('stroke', up ? 'var(--ok)' : 'var(--line-strong)'); });
      if (i === 0) { seq(c, c.fw.map(function (t) { return function () { op(t, true); }; }), 520); c.fly(c.FW, 'var(--prod)', 2200, 0, true, false); }
      if (i === 2) { op(c.bw[0], true); seq(c, c.bw.slice(1).map(function (t) { return function () { op(t, true); }; }), 520); c.fly(c.BW, 'var(--accent)', 2400, 0, true, false); }
      if (i === 3) c.fly(c.FW, 'var(--ok)', 2200, 0, true, false);
    }
  });

  /* ---------------------------------------------------------------- 4.14 a ViT turns an image into 197 tokens */
  var VI = {"img":"data:image/webp;base64,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","label":"golf ball","src":"Imagenette validation #2745, centre crop 224 x 224"};
  XV.reg('vit-patches', {
    style: 'strip', title: 'An image becomes 197 tokens', minw: 560,
    meas: 'ViT-B/16 · 224 × 224 input · 16 × 16 patches · Imagenette photo',
    steps: [
      { t: 'Cut into patches', x: 'A 224 × 224 image is cut into a 14 × 14 grid of 16 × 16 patches: 196 patches. Each patch will play the part a word plays in a sentence.' },
      { t: 'Read them in order', x: 'Read the grid row by row: patch 1 is the top-left corner, patch 196 the bottom-right. Each patch holds 16 × 16 pixels × 3 colours = 768 numbers.' },
      { t: 'Project and add position', x: 'A learned linear map turns each patch into a 768-dimensional embedding (in code, one conv with kernel 16 and stride 16). A learned position embedding is added, because attention by itself ignores order.' },
      { t: 'Prepend [CLS] and encode', x: 'A learned [CLS] token goes in front: 197 tokens × 768. The transformer encoder mixes all of them; the classifier reads only the [CLS] output.' }
    ],
    build: function (c) {
      var S = 182, cell = S / 14, X0 = 14, Y0 = 22; c.grow(0, 8); c.grow(700, 234);
      c.mk('image', { href: VI.img, x: X0, y: Y0, width: S, height: S, preserveAspectRatio: 'none' });
      c.mk('rect', { x: X0, y: Y0, width: S, height: S, fill: 'none', stroke: 'var(--line-strong)' });
      c.grid = c.mk('g', {});
      for (var k = 1; k < 14; k++) {
        c.mk('line', { x1: X0 + k * cell, x2: X0 + k * cell, y1: Y0, y2: Y0 + S, stroke: '#fff', 'stroke-width': 0.8, opacity: 0.85 }, c.grid);
        c.mk('line', { y1: Y0 + k * cell, y2: Y0 + k * cell, x1: X0, x2: X0 + S, stroke: '#fff', 'stroke-width': 0.8, opacity: 0.85 }, c.grid);
      }
      c.text(X0 + S / 2, Y0 + S + 22, '224 × 224 × 3', 'xv-ts', 'middle');
      var idx = [0, 1, 2, 3, 195], TX = [272, 314, 356, 398, 470], TY = 40, T = 34;
      c.hl = c.mk('g', {}); c.toks = c.mk('g', {}); c.vecs = c.mk('g', {}); c.pos = c.mk('g', {});
      idx.forEach(function (p, j) {
        var r = Math.floor(p / 14), q = p % 14;
        c.mk('rect', { x: X0 + q * cell, y: Y0 + r * cell, width: cell, height: cell, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, c.hl);
        var sv = c.mk('svg', { x: TX[j], y: TY, width: T, height: T, viewBox: (q * 16) + ' ' + (r * 16) + ' 16 16', preserveAspectRatio: 'none' }, c.toks);
        c.mk('image', { href: VI.img, x: 0, y: 0, width: 224, height: 224, preserveAspectRatio: 'none' }, sv);
        c.mk('rect', { x: TX[j], y: TY, width: T, height: T, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.4 }, c.toks);
        c.text(TX[j] + T / 2, TY - 8, String(p + 1), 'xv-ts', 'middle', c.toks);
        for (var b = 0; b < 12; b++) c.mk('rect', { x: TX[j] + 9, y: 98 + b * 6, width: 16, height: 5, rx: 1, fill: 'var(--prod)', opacity: 0.25 + 0.6 * Math.abs(Math.sin(p * 7.3 + b * 1.9)) }, c.vecs);
        c.mk('rect', { x: TX[j] + 9, y: 174, width: 16, height: 5, rx: 1, fill: 'var(--ok)' }, c.pos);
      });
      c.text(440 + T / 2 - 12, TY + 22, '…', 'xv-tb', 'middle', c.toks);
      c.vlab = c.text(368, 91, '768 numbers each', 'xv-ts', 'middle'); c.vlab2 = c.text(368, 91, '768-dim embedding each', 'xv-ts', 'middle');
      c.text(512, 180, '+ position', 'xv-ts', 'start', c.pos);
      c.clsv = c.mk('g', {}); for (var cb = 0; cb < 12; cb++) c.mk('rect', { x: 236, y: 98 + cb * 6, width: 16, height: 5, rx: 1, fill: 'var(--ok)', opacity: 0.35 + 0.5 * Math.abs(Math.sin(cb * 2.1)) }, c.clsv);
      c.cls = chip(c, 222, TY + 4, '[CLS]', { w: 44, h: 26, cls: 'xv-ts', stroke: 'var(--ok)' });
      c.enc = c.mk('g', {});
      c.mk('rect', { x: 222, y: 196, width: 290, height: 30, rx: 8, fill: 'var(--xv-face)', stroke: 'var(--prod)', 'stroke-width': 1.3 }, c.enc);
      c.text(367, 216, 'transformer encoder · 197 × 768', 'xv-t', 'middle', c.enc);
      c.mk('path', { d: 'M512 211 L556 211', stroke: 'var(--ok)', 'stroke-width': 1.4, fill: 'none' }, c.enc);
      c.text(562, 207, '[CLS] output', 'xv-ts', 'start', c.enc); c.text(562, 222, '→ “golf ball”', 'xv-tb', 'start', c.enc);
      c.TX = TX; c.idx = idx; c.X0 = X0; c.Y0 = Y0; c.cell = cell;
    },
    enter: function (c, i) {
      op(c.grid, true); op(c.hl, i >= 1); op(c.toks, i >= 1); op(c.vecs, i >= 1); op(c.vlab, i === 1); op(c.vlab2, i >= 2); op(c.pos, i >= 2);
      op(c.cls.g, i >= 3); op(c.clsv, i >= 3); op(c.enc, i >= 3);
      if (i === 1) c.idx.forEach(function (p, j) {
        var r = Math.floor(p / 14), q = p % 14;
        c.fly([[c.X0 + (q + 0.5) * c.cell, c.Y0 + (r + 0.5) * c.cell], [c.TX[j] + 17, 57]], 'var(--accent)', 1200, j * 220, false, false);
      });
      if (i === 3) c.fly([[244, 70], [244, 196], [556, 211]], 'var(--ok)', 2200, 0, true, false);
    }
  });

  /* ---------------------------------------------------------------- 2.21 a feature store, from the lesson's demo */
  XV.reg('feature-store', {
    style: 'iso', title: 'One definition, two stores', meas: 'the lesson’s demo · 299 users · 3 features · TTL 10 days',
    chips: ['offline rows', 'online keys', 'logged requests'],
    fmt: [loc, loc, loc],
    legend: [['var(--warn)', 'feature definitions'], ['var(--prod)', 'offline: training'], ['var(--accent)', 'online: serving'], ['var(--ok)', 'skew check']],
    steps: [
      { n: 'Define', t: 'Write each feature once', x: 'Every feature has one versioned definition in a registry, such as spend_30d@1. Both stores are filled from it, so training and serving cannot compute it two different ways.', ch: [0, 0, 0] },
      { n: 'Backfill', t: 'Fill the offline store', x: 'The backfill computes 3 features for 299 users on 25 snapshot days: 7,475 rows, each with its timestamp. The offline store keeps the full history.', ch: [7475, 0, 0] },
      { n: 'Train', t: 'Join without looking ahead', x: 'The point-in-time join takes the latest row on or before each label day. It scores 0.893 offline and holds at 0.876 on new data. A naive join leaked the future: 0.948 offline, 0.763 on new data.', ch: [7475, 0, 0] },
      { n: 'Serve', t: 'Materialize the latest values', x: 'Materialization copies the latest row per user into the online store, a key-value lookup that answers in milliseconds. Rows older than the 10-day TTL return defaults instead.', ch: [7475, 299, 0] },
      { n: 'Check', t: 'Compare what serving saw', x: 'Serving logs the features it used: 383 requests on days 141 to 150. The skew check compares them with the training join and flags a feature when more than 1% of values differ. With one definition and the same snapshots, the skew is zero.', ch: [7475, 299, 383] }
    ],
    build: function (c) {
      c.OX = 330; c.OY = 30; c.floor(-2, -1, 25, 15);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { ev: [1.2, 7, 1.8], reg: [6, 6.5, 2], off: [11.5, 2.5, 2.6], pit: [17, 2, 1.4], tr: [22, 2, 0.8], on: [11.5, 11.5, 1.8], srv: [18, 12, 1.6], sk: [22, 7.5, 1.4] };
      var n = c.n;
      c.w = {
        a: c.wire(n.ev, n.reg, 0, W), b: c.wire(n.reg, n.off, 0, W), c: c.wire(n.off, n.pit, 0, W), d: c.wire(n.pit, n.tr, 0, W),
        e: c.wire(n.off, n.on, 1, W), f: c.wire(n.on, n.srv, 0, W), g: c.wire(n.srv, n.sk, 1, W), h: c.wire(n.pit, n.sk, 1, W)
      };
      c.ev = c.cyl(1.2, 7, 0, 1.1, 1.8, 'var(--muted)', N);
      c.reg = c.box(4.8, 5.3, 0, 2.4, 2.4, 2, 'var(--warn)', N);
      c.off = c.mk('g', {}, N); c.oh = 0.3; c.drawOff = function (h) { while (c.off.firstChild) c.off.removeChild(c.off.firstChild); c.cyl(11.5, 2.5, 0, 1.6, h, 'var(--prod)', c.off); };
      c.drawOff(0.3);
      c.pit = c.box(16, 1, 0, 2, 2, 1.4, 'var(--prod)', N, { t: 12 });
      c.tr = c.box(21, 1, 0, 2.2, 2.2, 0.8, 'var(--prod)', N, { t: 26 });
      c.on = c.cyl(11.5, 11.5, 0, 1.3, 1.8, 'var(--accent)', N);
      c.srv = c.box(16.9, 10.9, 0, 2.2, 2.2, 1.6, 'var(--accent)', N);
      c.sk = c.box(21, 6.5, 0, 2, 2, 1.4, 'var(--ok)', N);
      c.label(1.2, 7, 3.1, ['raw events'], T); c.label(6, 7.9, -1.4, ['registry', 'spend_30d@1 …'], T);
      c.label(11.5, 2.5, 5.4, ['offline store', 'history with timestamps'], T); c.label(17, 2, 3.0, ['point-in-time join'], T);
      c.label(23.6, 2.6, 0.2, ['training set'], T, 'start'); c.label(10.8, 13.2, -1.2, ['online store', 'latest row per user'], T);
      c.label(18, 13.4, -1.3, ['serving', 'one row, a few ms'], T); c.label(23.4, 8, 0.3, ['skew check'], T, 'start');
      c.label(13.6, 7.4, 0.2, ['materialize'], T, 'start');
    },
    enter: function (c, i) {
      var n = c.n, h0 = c.oh, h1 = i >= 1 ? 2.6 : 0.3;
      c.tween(900, function (k) { c.oh = h0 + (h1 - h0) * k; c.drawOff(c.oh); });
      c.show(c.pit, i >= 2); c.show(c.tr, i >= 2); c.show(c.on, i >= 3); c.show(c.srv, i >= 3); c.show(c.sk, i >= 4);
      if (i === 0) c.fly([n.ev, n.reg], 'var(--muted)', 1200);
      if (i === 1) [0, 1, 2].forEach(function (k) { c.fly([n.reg, n.off], 'var(--warn)', 1100, k * 300); });
      if (i === 2) { c.fly([n.off, n.pit], 'var(--prod)', 1100); c.fly([n.pit, n.tr], 'var(--prod)', 1000, 900); }
      if (i === 3) { c.fly([n.off, n.on], 'var(--prod)', 1300); c.fly([n.on, n.srv], 'var(--accent)', 900, 1200); }
      if (i === 4) { c.fly([n.srv, n.sk], 'var(--accent)', 1200); c.fly([n.pit, n.sk], 'var(--prod)', 1200, 300); }
    }
  });

  /* ---------------------------------------------------------------- 5.23 parent-document retrieval */
  var HIT = [[1, 2], [1, 5], [3, 6]];
  XV.reg('rag-parent', {
    style: 'iso', title: 'Retrieve small, return big', meas: 'the lesson’s chunk_parent_child · parent 2,048 · child 256 · top_k = 3',
    chips: ['chunks indexed', 'children retrieved', 'parents returned', 'tokens to the LLM'],
    fmt: [loc, loc, loc, loc],
    legend: [['var(--prod)', 'parent chunk (2,048 tokens)'], ['var(--ag)', 'child chunk (256 tokens)'], ['var(--warn)', 'vector index'], ['var(--accent)', 'query']],
    steps: [
      { n: 'Parents', t: 'Cut the document into parents', x: 'Take a 10,240-token document. Recursive chunking at 2,048 tokens gives 5 parent chunks: big enough to hold an answer with its context.', ch: [0, 0, 0, 0] },
      { n: 'Children', t: 'Cut each parent into children', x: 'Each parent is split again at 256 tokens: 8 children per parent, 40 in all. Only the children are embedded and indexed, because small chunks match a query more sharply.', ch: [40, 0, 0, 0] },
      { n: 'Retrieve', t: 'Search with the children', x: 'The query is embedded and the index returns the top 3 children by cosine similarity. Two of them come from the same parent.', ch: [40, 3, 0, 0] },
      { n: 'Return', t: 'Hand back the parents, once each', x: 'Each child maps to its parent, and duplicates are dropped: 2 parents, 4,096 tokens, go to the LLM. Without the dedupe the same parent would fill the context twice.', ch: [40, 3, 2, 4096] }
    ],
    build: function (c) {
      c.OX = 330; c.OY = 26; c.floor(-2, -1, 27, 15);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { doc: [1.1, 6.5, 3.6], idx: [19.5, 6.5, 2.4], q: [19.5, 13, 1.2], llm: [24.5, 3.5, 2.8] };
      var n = c.n;
      c.wA = c.wire(n.q, n.idx, 0, W); c.wB = c.wire(n.idx, n.llm, 1, W);
      c.doc = c.box(0, 5, 0, 2.2, 3, 3.6, 'var(--muted)', N, { t: 10 });
      c.par = []; c.kids = [];
      for (var k = 0; k < 5; k++) {
        c.par.push(c.box(5.2, 0.6 + 2.7 * k, 0, 2, 2, 1.1, 'var(--prod)', N, { t: 14 }));
        var row = [];
        for (var j = 0; j < 8; j++) row.push(c.box(9.2 + 0.78 * j, 1.05 + 2.7 * k, 0, 0.55, 0.55, 0.55, 'var(--ag)', N, { sw: 0.9 }));
        c.kids.push(row);
      }
      c.idx = c.cyl(19.5, 6.5, 0, 1.6, 2.4, 'var(--warn)', N);
      c.q = c.box(18.8, 12.3, 0, 1.4, 1.4, 1.2, 'var(--accent)', N, { t: 14 });
      c.llm = c.box(23.3, 2.3, 0, 2.4, 2.4, 2.8, 'var(--ok)', N);
      c.label(1.1, 6.5, 4.9, ['document', '10,240 tokens'], T); c.label(4.6, 1.2, 1.2, ['parents', '5 × 2,048'], T, 'end');
      c.label(12, 0.6, 1.4, ['children', '8 per parent · 256 each'], T); c.label(19.5, 6.5, 3.7, ['vector index', '40 child embeddings'], T);
      c.label(19.2, 14.6, -0.9, ['query'], T); c.label(24.5, 3.5, 4.1, ['LLM', 'context'], T);
    },
    enter: function (c, i) {
      var n = c.n, hit = function (k, j) { return HIT.some(function (h) { return h[0] === k && h[1] === j; }); };
      c.par.forEach(function (p, k) { c.show(p, i < 3 || (i === 3 && (k === 1 || k === 3)), 0.22); });
      c.kids.forEach(function (row, k) { row.forEach(function (b, j) { c.show(b, i === 1 || (i === 2 && hit(k, j)), i === 0 ? 0 : 0.22); }); });
      c.show(c.idx, i >= 1); c.show(c.q, i >= 2); c.show(c.llm, i >= 3);
      var kc = function (k, j) { return [9.5 + 0.78 * j, 1.3 + 2.7 * k, 0.6]; }, pc = function (k) { return [6.2, 1.6 + 2.7 * k, 1.2]; };
      if (i === 0) [0, 1, 2, 3, 4].forEach(function (k) { c.fly([n.doc, pc(k)], 'var(--prod)', 1000, k * 180, false); });
      if (i === 1) { [0, 2, 4].forEach(function (k, m) { c.fly([pc(k), kc(k, 0)], 'var(--ag)', 900, m * 200, false); }); [0, 1, 2, 3].forEach(function (m) { c.fly([kc(m, 7), n.idx], 'var(--ag)', 1200, 700 + m * 250); }); }
      if (i === 2) { c.fly([n.q, n.idx], 'var(--accent)', 1000); HIT.forEach(function (h, m) { c.fly([n.idx, kc(h[0], h[1])], 'var(--accent)', 1100, 900 + m * 200); }); }
      if (i === 3) { c.fly([pc(1), n.llm], 'var(--prod)', 1300); c.fly([pc(3), n.llm], 'var(--prod)', 1300, 300); }
    }
  });

  /* ---------------------------------------------------------------- 6.5 Whisper, from waveform to text */
  XV.reg('whisper-pipeline', {
    style: 'iso', title: 'Whisper, from 30 seconds of audio to text', meas: 'Whisper large-v3 · 16 kHz · 128 mels (80 in earlier models)',
    chips: ['audio samples', 'mel frames', 'encoder positions', 'tokens'],
    fmt: [loc, loc, loc, loc],
    legend: [['var(--muted)', 'audio'], ['var(--warn)', 'log-mel spectrogram'], ['var(--prod)', 'encoder (32 layers, width 1,280)'], ['var(--accent)', 'decoder']],
    steps: [
      { n: 'Window', t: 'Everything is 30 seconds', x: 'Audio is resampled to 16 kHz and padded or cut to 30 seconds: 480,000 samples. Longer recordings are processed in 30-second chunks.', ch: [480000, 0, 0, 0] },
      { n: 'Log-mel', t: 'Samples become a spectrogram', x: 'A 25 ms window every 10 ms gives 3,000 frames. Each frame becomes 128 log-mel values in large-v3 (80 in the earlier models).', ch: [480000, 3000, 0, 0] },
      { n: 'Encode', t: 'The encoder reads the whole window', x: 'Two conv layers, the second with stride 2, halve the frames to 1,500 positions. 32 transformer layers turn them into 1,500 vectors of width 1,280.', ch: [480000, 3000, 1500, 0] },
      { n: 'Prompt', t: 'The task is written in the prompt', x: 'The decoder starts from special tokens: start of transcript, the language, the task (transcribe or translate) and whether to predict timestamps. One model, many tasks.', ch: [480000, 3000, 1500, 4] },
      { n: 'Decode', t: 'Text, one token at a time', x: 'Each new token attends to the tokens so far and, through cross-attention, to all 1,500 encoder vectors. Decoding stops at the end-of-text token.', ch: [480000, 3000, 1500, 8] }
    ],
    build: function (c) {
      c.OX = 290; c.OY = 30; c.floor(-2, -1, 30, 15);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { au: [2, 3, 0.4], mel: [8, 3, 0.6], cv: [12.5, 3, 1.6], en: [17, 3, 3], de: [22, 10, 3], pr: [16, 12, 0.6], out: [28, 9, 0.6] };
      var n = c.n;
      c.wire(n.au, n.mel, 0, W); c.wire(n.mel, n.cv, 0, W); c.wire(n.cv, n.en, 0, W); c.wx = c.wire(n.en, n.de, 1, W); c.wire(n.pr, n.de, 0, W); c.wire(n.de, n.out, 0, W);
      c.au = c.mk('g', {}, N); c.box(0, 2, 0, 4, 2, 0.3, 'var(--muted)', c.au, { t: 10 });
      var wav = []; for (var k = 0; k <= 36; k++) wav.push([0.2 + k * 0.1, 3, 0.32 + 0.55 * Math.abs(Math.sin(k * 1.7) * Math.sin(k * 0.35))]);
      var wp = c.wireP(wav, 0, c.au); wp.style.stroke = 'var(--muted)';
      c.mel = c.mk('g', {}, N); for (var a = 0; a < 4; a++) c.box(6.5, 1.7, a * 0.16, 3, 2.6, 0.13, 'var(--warn)', c.mel, { sw: 0.8 });
      c.cv = c.box(11.7, 2.2, 0, 1.6, 1.6, 1.6, 'var(--muted)', N);
      c.en = c.box(15.5, 1.5, 0, 3, 3, 3, 'var(--prod)', N, { t: 12 });
      c.de = c.box(20.5, 8.5, 0, 3, 3, 3, 'var(--accent)', N, { t: 14 });
      c.pr = c.mk('g', {}, N); for (var p = 0; p < 4; p++) c.box(14.2 + p * 0.95, 11.6, 0, 0.75, 0.75, 0.6, 'var(--accent)', c.pr, { sw: 0.9 });
      c.out = c.mk('g', {}, N); c.outB = [];
      for (var o = 0; o < 4; o++) c.outB.push(c.box(26.4 + o * 0.95, 8.6, 0, 0.75, 0.75, 0.6, 'var(--ok)', c.out, { sw: 0.9 }));
      c.label(2, 3, -1.3, ['audio', '30 s · 16 kHz'], T); c.label(8.6, 4.6, -1.2, ['log-mel', '128 × 3,000'], T);
      c.label(13.2, 4.2, -1.2, ['conv ×2', 'stride 2'], T); c.label(17, 3, 4.3, ['encoder', '1,500 × 1,280'], T);
      c.label(22, 10, 4.3, ['decoder'], T); c.label(15.6, 13.6, -1.2, ['prompt', 'special tokens'], T);
      c.label(28, 10.4, -1.2, ['text'], T); c.label(20.6, 5.6, 1.6, ['cross-attention'], T, 'start');
    },
    enter: function (c, i) {
      var n = c.n;
      c.show(c.mel, i >= 1); c.show(c.cv, i >= 2); c.show(c.en, i >= 2); c.show(c.de, i >= 3); c.show(c.pr, i >= 3);
      c.outB.forEach(function (b) { c.show(b, false, 0); });
      c.extra.innerHTML = i >= 3 ? ['&lt;|startoftranscript|&gt;', '&lt;|en|&gt;', '&lt;|transcribe|&gt;', '&lt;|notimestamps|&gt;'].concat(i >= 4 ? ['Hello', ' world', '.', '&lt;|endoftext|&gt;'] : [])
        .map(function (t, k) { return '<span>' + (k < 4 ? 'prompt' : 'output') + ' token ' + (k + 1) + '<b>' + t + '</b></span>'; }).join('') : '';
      if (i === 0) c.fly([[0.3, 3, 0.6], [3.8, 3, 0.6]], 'var(--muted)', 1400);
      if (i === 1) c.fly([n.au, n.mel], 'var(--muted)', 1100);
      if (i === 2) { c.fly([n.mel, n.cv], 'var(--warn)', 1000); c.fly([n.cv, n.en], 'var(--warn)', 1000, 800); }
      if (i === 3) c.fly([n.pr, n.de], 'var(--accent)', 1100);
      if (i === 4) {
        c.fly([n.en, n.de], 'var(--prod)', 1300);
        c.outB.forEach(function (b, k) { c.tween(400 + k * 520, function () {}, function () { c.show(b, true); }); });
        c.fly([n.de, n.out], 'var(--ok)', 1100, 600);
      }
    }
  });
})();


/* Phases 8 and 9: diffusion, latent diffusion, the RL loop, DQN, PPO's clip */
(function () {
  'use strict';
  var XV = window.XV;

  /* ---------------------------------------------------------------- 8.6 the forward process on a real photo */
  var DD = {"t":[0,100,300,600,999],"img":["data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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","data:image/webp;base64,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"],"ab":[1.0,0.895,0.394,0.0256,4.04e-05]};
  XV.reg('ddpm-forward', {
    style: 'strip', title: 'Noising a real photo, DDPM schedule', minw: 560,
    meas: 'Imagenette image · linear β from 0.0001 to 0.02 · 1,000 steps',
    steps: [
      { t: 'The clean image', x: 'x₀ is a real photo scaled to [−1, 1]. The forward process will mix it with Gaussian noise, a little at each of 1,000 steps.' },
      { t: 'Step 100', x: 'In closed form, xₜ = √āₜ·x₀ + √(1−āₜ)·ε. At t = 100, ā = 0.895: the image keeps 95% of its amplitude and the noise is already visible.' },
      { t: 'Step 300', x: 'ā = 0.394: signal and noise are now close in size (0.63 against 0.78). Shapes survive; fine texture is gone.' },
      { t: 'Steps 600 and 999', x: 'ā = 0.026 at t = 600 and 0.00004 at t = 999: almost pure noise. Training teaches a network to predict ε from xₜ and t at every level; generation runs this film backwards.' }
    ],
    build: function (c) {
      c.grow(0, 0); c.grow(700, 214); c.ims = [];
      DD.img.forEach(function (src, k) {
        var x = 14 + k * 136, g = c.mk('g', { class: 'xv-fade', opacity: 0 });
        c.mk('image', { href: src, x: x, y: 14, width: 124, height: 124, preserveAspectRatio: 'xMidYMid slice' }, g);
        c.mk('rect', { x: x, y: 14, width: 124, height: 124, fill: 'none', stroke: 'var(--line-strong)' }, g);
        c.text(x + 62, 158, 't = ' + DD.t[k], 'xv-tb', 'middle', g);
        var a = DD.ab[k];
        c.mk('rect', { x: x, y: 170, width: 124, height: 8, rx: 3, fill: 'var(--line)' }, g);
        c.mk('rect', { x: x, y: 170, width: 124 * Math.sqrt(a), height: 8, rx: 3, fill: 'var(--accent)' }, g);
        c.text(x + 62, 198, '√ā = ' + Math.sqrt(a).toFixed(a < 0.01 ? 3 : 2), 'xv-ts', 'middle', g);
        c.ims.push(g);
      });
    },
    enter: function (c, i) {
      var vis = [[0], [0, 1], [0, 1, 2], [0, 1, 2, 3, 4]][i];
      c.ims.forEach(function (g, k) { var on = vis.indexOf(k) >= 0; g.style.opacity = on ? 1 : 0; });
      var last = vis[vis.length - 1]; c.ims[last].style.opacity = 0;
      setTimeout(function () { vis.forEach(function (k) { c.ims[k].style.opacity = 1; }); }, 120);
    }
  });

  /* ---------------------------------------------------------------- 8.7 Stable Diffusion's three networks */
  XV.reg('latent-diffusion', {
    style: 'iso', title: 'Stable Diffusion 1.5, one image', meas: 'parameter counts of the SD 1.5 checkpoints · 512 × 512 output',
    chips: ['numbers the U-Net works on', 'U-Net calls', 'networks used'],
    fmt: [function (x) { return Math.round(x).toLocaleString('en'); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x) + ' / 3'; }],
    legend: [['var(--warn)', 'text encoder (CLIP ViT-L, 123M)'], ['var(--prod)', 'U-Net (860M)'], ['var(--ok)', 'VAE decoder (84M)'], ['var(--ag)', 'latent 4 × 64 × 64']],
    steps: [
      { n: 'Prompt', t: 'The prompt becomes 77 vectors', x: 'CLIP’s text encoder turns the prompt into 77 token embeddings of 768 numbers. They steer every denoising step through cross-attention.', ch: [0, 0, 1] },
      { n: 'Noise', t: 'Start from noise in a small latent', x: 'Instead of 512 × 512 × 3 = 786,432 pixel values, the work happens in a 4 × 64 × 64 latent: 16,384 numbers, 48× fewer. It starts as pure Gaussian noise.', ch: [16384, 0, 1] },
      { n: 'Denoise', t: 'The U-Net removes noise, step by step', x: 'At each step the U-Net predicts the noise in the latent, conditioned on the text, and the sampler removes part of it. 50 steps is a common setting: 50 U-Net calls (100 with classifier-free guidance).', ch: [16384, 50, 2] },
      { n: 'Decode', t: 'The VAE decoder paints pixels', x: 'One pass of the VAE decoder expands the clean latent 8× in each direction into the 512 × 512 image. Only this last step works at pixel resolution.', ch: [786432, 50, 3] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 40; c.floor(-2, -2, 26, 14);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { txt: [2, 3, 1.4], te: [7, 3, 2.6], lat: [9, 10, 0.9], un: [15, 6, 3.6], vae: [21, 9, 2.6], img: [25.5, 9, 0.2] };
      var n = c.n;
      c.wire(n.txt, n.te, 0, W); c.wire(n.te, n.un, 1, W); c.wire(n.lat, n.un, 0, W); c.wire(n.un, n.vae, 0, W); c.wire(n.vae, n.img, 0, W);
      c.box(0.5, 2, 0, 3, 2, 1.4, 'var(--muted)', N); c.te = c.box(5.8, 1.8, 0, 2.4, 2.4, 2.6, 'var(--warn)', N);
      c.lat = c.mk('g', {}, N); for (var a = 0; a < 4; a++) c.box(7.8, 8.8, a * 0.22, 2.4, 2.4, 0.18, 'var(--ag)', c.lat, { sw: 0.8 });
      c.un = c.box(13.3, 4.3, 0, 3.4, 3.4, 3.6, 'var(--prod)', N, { t: 12 }); c.vae = c.box(19.8, 7.8, 0, 2.4, 2.4, 2.6, 'var(--ok)', N);
      c.img = c.box(23.5, 7.2, 0, 4, 4, 0.2, 'var(--accent)', N, { t: 30 });
      c.label(0.6, 4.6, 1.0, ['prompt'], T, 'end'); c.label(7, 3, 3.9, ['CLIP text encoder', '77 × 768'], T); c.label(9, 10, -1.2, ['latent', '4 × 64 × 64'], T);
      c.label(15, 6, 4.9, ['U-Net', 'predicts the noise'], T); c.label(21, 9, 3.9, ['VAE decoder'], T); c.label(25.5, 9, -1.4, ['512 × 512 image'], T);
    },
    enter: function (c, i) {
      var n = c.n;
      c.show(c.te, true); c.show(c.lat, i >= 1); c.show(c.un, i >= 2); c.show(c.vae, i >= 3); c.show(c.img, i >= 3);
      if (i === 0) c.fly([n.txt, n.te], 'var(--muted)', 1100);
      if (i === 1) c.fly([n.te, n.un], 'var(--warn)', 1300);
      if (i === 2) { var loop = [n.lat, n.un, [n.lat[0] + 2, n.lat[1] - 1, 0.9]]; for (var k = 0; k < 3; k++) c.fly(loop, 'var(--ag)', 1500, k * 500); c.fly([n.te, n.un], 'var(--warn)', 1300, 300); }
      if (i === 3) { c.fly([n.un, n.vae], 'var(--ag)', 1100); c.fly([n.vae, n.img], 'var(--ok)', 1100, 900); }
    }
  });

  /* ---------------------------------------------------------------- 9.1 agent and environment */
  XV.reg('rl-loop', {
    style: 'iso', title: 'The agent–environment loop', meas: 'the lesson’s 4 × 4 grid · −1 per move · γ = 0.9',
    chips: ['time step t', 'last reward', 'return so far'],
    fmt: [function (x) { return Math.round(x); }, function (x) { return (x > 0 ? '+' : '') + Math.round(x); }, function (x) { return x.toFixed(2); }],
    legend: [['var(--prod)', 'state sₜ'], ['var(--accent)', 'action aₜ'], ['var(--ok)', 'reward rₜ₊₁']],
    steps: [
      { n: 'Observe', t: 'The agent sees a state', x: 'The environment reports its state: the agent’s square, (0, 0) on the 4 × 4 grid. The policy maps each state to a choice of action.', ch: [0, 0, 0] },
      { n: 'Act', t: 'It acts; the world answers', x: 'The agent moves right. The environment returns the next state, (0, 1), and a reward of −1. Every move costs one, so shorter paths are better.', ch: [1, -1, -1] },
      { n: 'Repeat', t: 'Again and again', x: 'Two more moves at −1 each. Later rewards count less: the reward k steps ahead is weighted by γᵏ = 0.9ᵏ. So far the return is −1 − 0.9 − 0.81 = −2.71.', ch: [3, -1, -2.71] },
      { n: 'Terminal', t: 'The episode ends', x: 'The sixth move reaches (3, 3), the terminal state, and the episode stops. Return G = −(1 + 0.9 + … + 0.9⁵) = −4.69, the best any policy can do from (0, 0). Learning means finding the policy with the highest expected return.', ch: [6, -1, -4.69] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 30; c.floor(-2, -2, 22, 12);
      var N = c.mk('g', {}), W = c.mk('g', {}), T = c.mk('g', {});
      c.agent = c.box(1, 3, 0, 3, 3, 3, 'var(--accent)', N, { t: 14 });
      c.cells = [];
      for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) { var goal = r === 3 && q === 3, g = c.box(10 + q * 2, 1 + r * 2, 0, 1.8, 1.8, 0.25, goal ? 'var(--ok)' : 'var(--line-strong)', N, { t: goal ? 30 : 10, sw: 0.8 }); c.cells.push(g); }
            c.pos = c.mk('g', {}, N); c.place = function (k) { while (c.pos.firstChild) c.pos.removeChild(c.pos.firstChild); var cc = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]][k]; c.box(10.45 + cc[0] * 2, 1.45 + cc[1] * 2, 0.25, 0.9, 0.9, 0.9, 'var(--accent)', c.pos, { t: 20 }); };
      c.st = c.wireP([[17, 9, 0.3], [9, 11, 0.3], [2.5, 7, 1]], 1, W); c.ac = c.wireP([[4, 3, 2], [9, 1, 0.3], [10, 1, 0.3]], 1, W);
      c.label(2.5, 4.5, 4.3, ['agent', 'policy π(a | s)'], T); c.label(16, 1, 1.7, ['environment', '4 × 4 grid'], T); c.label(18.4, 8.2, 0.4, ['terminal (3, 3)'], T, 'start');
      c.label(8, 11.5, -1.0, ['state, reward'], T); c.label(7, 0.4, 1.4, ['action'], T);
      c.place(0);
    },
    enter: function (c, i) {
      var k = [0, 1, 3, 6][i]; c.place(k);
      var S = [[17, 9, 0.3], [9, 11, 0.3], [2.5, 7, 1]], A = [[4, 3, 2], [9, 1, 0.3], [10, 1, 0.3]];
      if (i === 0) c.fly(S, 'var(--prod)', 1500);
      else { c.fly(A, 'var(--accent)', 1100); c.fly(S, 'var(--prod)', 1400, 1000); c.fly(S, 'var(--ok)', 1400, 1200); }
    }
  });

  /* ---------------------------------------------------------------- 9.5 DQN: replay buffer and target network */
  XV.reg('dqn-replay', {
    style: 'iso', title: 'DQN: learn from replayed experience', meas: 'settings from Mnih et al. 2015 (Atari)',
    chips: ['replay buffer', 'minibatch', 'target network synced every'],
    fmt: [function (x) { return x >= 1e6 ? '1,000,000' : Math.round(x).toLocaleString('en'); }, function (x) { return Math.round(x); }, function (x) { return Math.round(x).toLocaleString('en') + ' steps'; }],
    legend: [['var(--prod)', 'transition (s, a, r, s′)'], ['var(--accent)', 'online Q-network'], ['var(--muted)', 'target Q-network'], ['var(--ok)', 'TD target']],
    steps: [
      { n: 'Act', t: 'Act with ε-greedy', x: 'The online network picks the action with the highest Q-value, except with probability ε (1.0 falling to 0.1) it acts at random to keep exploring.', ch: [0, 0, 10000] },
      { n: 'Store', t: 'Store every transition', x: 'Each (state, action, reward, next state) goes into a replay buffer holding the last million transitions.', ch: [1e6, 0, 10000] },
      { n: 'Sample', t: 'Learn from a random minibatch', x: 'Training draws 32 transitions at random from the buffer. Random draws break the correlation between consecutive frames that makes online updates unstable.', ch: [1e6, 32, 10000] },
      { n: 'Target', t: 'Bootstrap from a frozen copy', x: 'The TD target r + γ·maxₐ′ Q(s′, a′) uses a target network, a copy of the online network refreshed every 10,000 steps, so the target does not move with every update.', ch: [1e6, 32, 10000] },
      { n: 'Update', t: 'Regress Q towards the target', x: 'The online network’s Q(s, a) is pulled towards the target with a Huber loss, and the loop continues: act, store, sample, update.', ch: [1e6, 32, 10000] }
    ],
    build: function (c) {
      c.OX = 300; c.OY = 30; c.floor(-2, -2, 26, 14);
      var W = c.mk('g', {}), N = c.mk('g', {}), T = c.mk('g', {});
      c.n = { env: [2, 7, 1.6], on: [9, 3, 3], buf: [10, 11, 2.6], tg: [17, 3, 3], loss: [20, 10, 1.6] };
      var n = c.n;
      c.wire(n.env, n.on, 0, W); c.wire(n.env, n.buf, 0, W); c.wire(n.buf, n.on, 1, W); c.wire(n.buf, n.tg, 1, W); c.wire(n.tg, n.loss, 0, W); c.wire(n.on, n.loss, 0, W);
      c.env = c.box(0, 5.5, 0, 3.4, 3, 1.6, 'var(--line-strong)', N, { t: 10 });
      c.on = c.box(7.6, 1.6, 0, 2.8, 2.8, 3, 'var(--accent)', N, { t: 14 }); c.tg = c.box(15.6, 1.6, 0, 2.8, 2.8, 3, 'var(--muted)', N);
      c.buf = c.mk('g', {}, N); c.bh = 0.2; c.drawBuf = function (h) { while (c.buf.firstChild) c.buf.removeChild(c.buf.firstChild); c.cyl(10, 11, 0, 1.6, h, 'var(--prod)', c.buf); };
      c.drawBuf(0.2);
      c.loss = c.box(19, 9, 0, 2, 2, 1.6, 'var(--ok)', N);
      c.label(1.7, 7, 2.5, ['environment', 'Atari game'], T); c.label(9, 3, 4.3, ['online Q-net'], T); c.label(17, 3, 4.3, ['target Q-net', 'frozen copy'], T);
      c.label(10, 11, -1.3, ['replay buffer', 'last 1M transitions'], T); c.label(21.5, 11.5, -0.5, ['loss', 'Q(s,a) vs r + γ max Q′'], T);
    },
    enter: function (c, i) {
      var n = c.n, h0 = c.bh, h1 = i >= 1 ? 2.6 : 0.2;
      c.tween(900, function (k) { c.bh = h0 + (h1 - h0) * k; c.drawBuf(c.bh); });
      c.show(c.tg, i >= 3); c.show(c.loss, i >= 3);
      if (i === 0) { c.fly([n.env, n.on], 'var(--prod)', 1100); c.fly([n.on, n.env], 'var(--accent)', 1100, 900); }
      if (i === 1) [0, 1, 2, 3].forEach(function (k) { c.fly([n.env, [10, 11, 2.8]], 'var(--prod)', 1000, k * 260); });
      if (i === 2) [0, 1, 2].forEach(function (k) { c.fly([[10, 11, 2.8], n.on], 'var(--prod)', 1000, k * 260); });
      if (i === 3) { c.fly([[10, 11, 2.8], n.tg], 'var(--prod)', 1000); c.fly([n.tg, n.loss], 'var(--ok)', 1000, 900); }
      if (i === 4) { c.fly([n.on, n.loss], 'var(--accent)', 1000); c.fly([n.loss, n.on], 'var(--ok)', 1000, 1000); c.fly([n.on, n.tg], 'var(--muted)', 1200, 2000); }
    }
  });

  /* ---------------------------------------------------------------- 9.8 PPO's clipped objective */
  XV.reg('ppo-clip', {
    style: 'strip', title: 'PPO’s clipped objective', minw: 560, meas: 'ε = 0.2 · L = min(r·A, clip(r, 0.8, 1.2)·A)',
    steps: [
      { t: 'The probability ratio', x: 'r = π_new(a|s) / π_old(a|s): how much more (r > 1) or less (r < 1) likely the new policy makes an action the old policy took. At r = 1 nothing has changed.' },
      { t: 'A good action (A > 0)', x: 'The objective r·A rewards making the action more likely, but only up to r = 1.2. Beyond that the clip makes it flat: no gradient, no reason to push further on this sample.' },
      { t: 'A bad action (A < 0)', x: 'For a worse-than-expected action, the objective rewards making it less likely, down to r = 0.8; below that it is flat. In both cases the min keeps the pessimistic of the two terms.' },
      { t: 'Why it is stable', x: 'One batch of samples can move each action’s probability only by about 20% before its gradient vanishes. That small trust region is most of why PPO trains reliably.' }
    ],
    build: function (c) {
      var X0 = 70, X1 = 650, Y0 = 130, sx = (X1 - X0) / 2, sy = 70; c.grow(0, 0); c.grow(700, 250);
      var X = function (r) { return X0 + r * sx; }, Y = function (v) { return Y0 - v * sy; };
      c.mk('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: 'var(--line-strong)' }); c.mk('line', { x1: X(1), x2: X(1), y1: 20, y2: 240, stroke: 'var(--line-strong)', 'stroke-dasharray': '3 4' });
      [0, 0.5, 0.8, 1, 1.2, 1.5, 2].forEach(function (r) { c.text(X(r), Y0 + 18, String(r), 'xv-ts'); });
      c.text(X1, Y0 + 36, 'ratio r', 'xv-ts', 'end');
      c.band = c.mk('rect', { x: X(0.8), y: 20, width: X(1.2) - X(0.8), height: 220, fill: 'var(--accent)', opacity: 0, class: 'xv-fade' });
      var curve = function (A) { var d = ''; for (var r = 0; r <= 2.0001; r += 0.02) { var v = Math.min(r * A, Math.max(0.8, Math.min(1.2, r)) * A); d += (d ? ' L' : 'M') + X(r).toFixed(1) + ' ' + Y(v).toFixed(1); } return d; };
      c.pos = c.mk('path', { d: curve(1), fill: 'none', stroke: 'var(--ok)', 'stroke-width': 3, class: 'xv-fade' });
      c.neg = c.mk('path', { d: curve(-1), fill: 'none', stroke: 'var(--bad)', 'stroke-width': 3, class: 'xv-fade' });
      c.posL = c.text(X(1.6), Y(1.2) - 10, 'A > 0: flat after 1.2', 'xv-tb', 'middle'); c.negL = c.text(X(0.4), Y(-0.8) + 26, 'A < 0: flat below 0.8', 'xv-tb', 'middle');
      [c.posL, c.negL].forEach(function (t) { t.classList.add('xv-fade'); });
      c.dot = c.mk('circle', { r: 6, cx: X(1), cy: Y0, fill: 'var(--accent)' }); c.X = X; c.Y = Y;
      [c.pos, c.neg].forEach(function (p) { var L = p.getTotalLength ? 1200 : 0; p.style.strokeDasharray = 1200; p.style.strokeDashoffset = 1200; });
    },
    enter: function (c, i) {
      var draw = function (p, on) { p.style.transition = 'stroke-dashoffset 1.2s ease, opacity .4s'; p.style.strokeDashoffset = on ? 0 : 1200; };
      draw(c.pos, i === 1 || i === 3); draw(c.neg, i === 2 || i === 3);
      c.posL.style.opacity = i === 1 || i === 3 ? 1 : 0; c.negL.style.opacity = i === 2 || i === 3 ? 1 : 0; c.band.style.opacity = i === 3 ? 0.12 : 0;
      var A = i === 2 ? -1 : 1, r0 = 1;
      if (i === 1 || i === 2) c.tween(2400, function (k) { var r = i === 1 ? 1 + k * 0.8 : 1 - k * 0.6, v = Math.min(r * A, Math.max(0.8, Math.min(1.2, r)) * A); c.dot.setAttribute('cx', c.X(r)); c.dot.setAttribute('cy', c.Y(v)); });
      else { c.dot.setAttribute('cx', c.X(1)); c.dot.setAttribute('cy', c.Y(i === 3 ? 1 : 0)); c.dot.style.opacity = i === 0 ? 1 : 0.0; }
      c.dot.style.opacity = i === 3 ? 0 : 1;
    }
  });
})();

