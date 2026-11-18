// One passive scroll listener, one rAF per frame, cached geometry (no layout reads while scrolling).
const acts = [];
export const view = { w: innerWidth, h: innerHeight, y: scrollY };
let queued = false;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Write a style only when its value really changed: avoids style recalculation for settled elements.
const cache = new WeakMap();
export function put(el, prop, value) {
  let c = cache.get(el); if (!c) cache.set(el, (c = {}));
  if (c[prop] === value) return;
  c[prop] = value;
  if (prop.startsWith("--")) el.style.setProperty(prop, value); else el.style[prop] = value;
}
export const r1 = v => Math.round(v * 10) / 10;   // 0.1 px
export const r3 = v => Math.round(v * 1000) / 1000;
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// mode "pin": p = 0 when the section top hits the viewport top, 1 when its bottom hits the viewport bottom.
// mode "top": p = scrolled distance / section height (used by the hero).
// mode "flow": p = 0 when the top enters at the bottom, 1 when the bottom leaves at the top.
export function track(el, update, { mode = "pin", measure } = {}) {
  const act = { el, update, mode, measure, top: 0, h: 0, live: false };
  acts.push(act);
  return act;
}

function progress(a) {
  const y = view.y, vh = view.h;
  if (a.mode === "top") return clamp((y - a.top) / Math.max(a.h, 1));
  if (a.mode === "flow") return clamp((y + vh - a.top) / (a.h + vh));
  return clamp((y - a.top) / Math.max(a.h - vh, 1));
}

function measureAll() {
  view.w = innerWidth; view.h = innerHeight; view.y = scrollY;
  for (const a of acts) {
    const r = a.el.getBoundingClientRect();
    a.top = r.top + scrollY; a.h = r.height;
    a.measure?.(a);
  }
}

function frame() {
  queued = false;
  view.y = scrollY;
  const { y, h } = view;
  for (const a of acts) {
    const near = y + h * 1.5 > a.top && y < a.top + a.h + h * 0.5;
    if (near !== a.live) a.el.classList.toggle("is-near", near);
    if (near || a.live) { a.update(progress(a), a); a.live = near; }
  }
}

export function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

export function start() {
  measureAll(); frame();
  addEventListener("scroll", request, { passive: true });
  let t;
  const remeasure = () => { clearTimeout(t); t = setTimeout(() => { measureAll(); request(); }, 120); };
  addEventListener("resize", remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  document.fonts?.ready.then(remeasure);
  addEventListener("load", remeasure);
}
