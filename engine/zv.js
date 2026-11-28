
window.ZV = {
  ns: "http://www.w3.org/2000/svg",
  el: function (tag, attrs, parent) {
    var e = document.createElementNS(this.ns, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  },
  text: function (parent, x, y, s, cls, anchor) {
    var t = this.el("text", {x: x, y: y, "class": cls || "", "text-anchor": anchor || "middle"}, parent);
    t.textContent = s; return t;
  },
  clear: function (g) { while (g.firstChild) g.removeChild(g.firstChild); },
  f: function (v, d) { d = (d === undefined) ? 2 : d; return Number(v).toFixed(d); },
  slider: function (ctl, o) {
    var lab = document.createElement("label");
    var span = document.createElement("span"); span.textContent = o.label;
    var inp = document.createElement("input");
    inp.type = "range"; inp.min = o.min; inp.max = o.max; inp.step = o.step; inp.value = o.value;
    inp.setAttribute("aria-label", o.label);
    var val = document.createElement("span"); val.className = "val";
    var show = function () { val.textContent = o.fmt ? o.fmt(+inp.value) : inp.value; };
    inp.addEventListener("input", function () { show(); o.oninput(+inp.value); });
    show(); lab.appendChild(span); lab.appendChild(inp); lab.appendChild(val); ctl.appendChild(lab);
    return {input: inp, set: function (v) { inp.value = v; show(); }};
  },
  button: function (ctl, label, onclick) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.addEventListener("click", onclick); ctl.appendChild(b); return b;
  },
  select: function (ctl, label, options, onchange) {
    var lab = document.createElement("label");
    var span = document.createElement("span"); span.textContent = label;
    var s = document.createElement("select");
    options.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
    s.addEventListener("change", function () { onchange(s.value); });
    lab.appendChild(span); lab.appendChild(s); ctl.appendChild(lab); return s;
  },
  point: function (svg, evt) {
    var p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  },
  drag: function (svg, handle, onmove) {
    var self = this, active = false;
    handle.style.cursor = "grab";
    handle.addEventListener("pointerdown", function (e) { active = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
    handle.addEventListener("pointermove", function (e) { if (active) { var p = self.point(svg, e); onmove(p.x, p.y); } });
    handle.addEventListener("pointerup", function (e) { active = false; handle.releasePointerCapture(e.pointerId); });
  },
  rng: function (seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  },
  softmax: function (xs, temp) {
    temp = temp || 1; var m = Math.max.apply(null, xs.map(function (x) { return x / temp; }));
    var ex = xs.map(function (x) { return Math.exp(x / temp - m); }); var s = ex.reduce(function (a, b) { return a + b; }, 0);
    return ex.map(function (e) { return e / s; });
  }
};
(window.ZVQ || []).forEach(function (f) { try { f(); } catch (err) { console.error("widget failed", err); } });
window.ZVQ = {push: function (f) { f(); }};
