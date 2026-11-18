// The Start page scroll score (plan P2). Only loaded when motion is allowed.
// Every effect writes transform / opacity / clip-path only.
import { track, start, view, clamp, easeOut, easeExpo, easeInOut, put, r1, r3 } from "./scroll.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const desktop = matchMedia("(min-width: 1024px)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const shared = { ox: 0, oy: 0 }; // launcher centre, handed from act 4 to the act 5 portal

// ------------------------------------------------------------ act 1: layered depth hero
function hero() {
  const el = $('[data-act="hero"]'); if (!el) return;
  const glow = $('[data-plane="glow"]', el), symbol = $('[data-plane="symbol"]', el), lens = $('[data-plane="lens"]', el);
  const fg = $('[data-plane="fg"]', el), text = $('[data-plane="text"]', el), mark = $("[data-brand-mark]");
  const cursors = $$("[data-cursor]", el);
  mark && (mark.style.opacity = "0");
  // entrance: transform only on the LCP area, opacity only on the small cursor labels
  $(".hero__stage", el).animate([{ transform: "translateY(24px)" }, { transform: "none" }], { duration: 1100, easing: "cubic-bezier(.22,1,.36,1)" });
  cursors.forEach((c, i) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 500 + i * 160, fill: "backwards", easing: "ease-out" }));

  track(el, p => {
    const vh = view.h;
    put(glow, "transform", `translate3d(0, ${r1(p * vh * 0.12)}px, 0)`);
    put(symbol, "transform", `translate3d(0, ${r1(-p * vh * 0.08)}px, 0) scale(${r3(1 - 0.18 * p)})`);
    const video = lens.firstElementChild; if (video) put(video, "transform", `translate3d(0, ${r1(p * 16)}%, 0) scale(1.12)`);
    put(fg, "transform", `translate3d(0, ${r1(-p * vh * 0.5)}px, 0)`);
    put(text, "transform", `translate3d(0, ${r1(-p * vh * 0.16)}px, 0)`);
    put(text, "opacity", String(r3(1 - clamp((p - 0.25) * 2.2))));
    if (mark) put(mark, "opacity", String(r3(clamp((p - 0.35) * 2.5))));
  }, { mode: "top" });

  if (finePointer.matches) {
    const k = [18, -14, 22];
    el.addEventListener("pointermove", e => {
      const mx = e.clientX / view.w - 0.5, my = e.clientY / view.h - 0.5;
      cursors.forEach((c, i) => { c.style.transform = `translate3d(${mx * k[i]}px, ${my * k[i]}px, 0)`; });
    }, { passive: true });
  }
}

// ------------------------------------------------------------ act 2: pinned horizontal card stack
function stack() {
  const el = $('[data-act="stack"]'); if (!el) return;
  const cards = $$("[data-card]", el);
  track(el, p => {
    if (!desktop.matches) { cards.forEach(c => { put(c, "transform", ""); put(c, "--dim", "0"); }); return; }
    const t = [1, easeOut(clamp((p - 0.06) / 0.38)), easeOut(clamp((p - 0.5) / 0.38))];
    cards.forEach((c, i) => {
      const covered = t.slice(i + 1).reduce((s, v) => s + v, 0);
      put(c, "transform", `translate3d(${r1((1 - t[i]) * 115)}%, 0, 0) rotate(${r1((1 - t[i]) * 5)}deg) scale(${r3(1 - covered * 0.04)})`);
      put(c, "--dim", String(r3(covered * 0.35)));
    });
  });
}

// ------------------------------------------------------------ act 3: sticky progress steps
function steps() {
  const el = $('[data-act="steps"]'); if (!el) return;
  const fill = $("[data-fill]", el), items = $$("[data-step]", el), roll = $("[data-roll]", el);
  let last = -1;
  const a = track(el, p => {
    const q = desktop.matches ? clamp(p / 0.82) : p; // last ~18 % on desktop = authored silence
    put(fill, "transform", `scaleY(${r3(q)})`);
    const active = Math.min(items.length - 1, Math.floor(q * items.length * 0.999 + (desktop.matches ? 0 : 0.6)));
    if (active !== last) {
      items.forEach((s, i) => { s.style.setProperty("--o", i <= active ? "1" : "0.35"); s.classList.toggle("is-on", i <= active); });
      if (roll) put(roll, "transform", `translateY(${(-100 / items.length) * Math.max(active, 0)}%)`);
      last = active;
    }
  });
  const setMode = () => { a.mode = desktop.matches ? "pin" : "flow"; };
  setMode(); desktop.addEventListener("change", setMode);
}

// ------------------------------------------------------------ act 4: card burst out of the O -> multi-speed wall (PEAK)
function burst() {
  const el = $('[data-act="burst"]'); if (!el) return;
  const wall = $("[data-wall]", el), cards = $$("[data-card]", el), launcher = $("[data-launcher]", el);
  let geo = [], travel = 0, pEnd = 1;
  const speeds = [1, 1.35, 0.8, 1.15], base = [0, 0.32, 0.08, 0.48];
  const measure = () => {
    cards.forEach(c => { put(c, "transform", ""); put(c, "opacity", ""); });
    put(launcher, "transform", "");
    const L = launcher.getBoundingClientRect(), St = launcher.parentElement.getBoundingClientRect();
    const lx = L.left + L.width / 2, ly = L.top + L.height / 2;
    shared.ox = lx; shared.oy = ly - St.top; // viewport coords once the stage is pinned (stage top = 0)
    const cols = getComputedStyle(wall).gridTemplateColumns.split(" ").length;
    const W = wall.getBoundingClientRect();
    geo = cards.map((c, i) => {
      const r = c.getBoundingClientRect();
      const col = i % cols;
      return { dx: lx - (r.left + r.width / 2), dy: ly - (r.top + r.height / 2), col, h: r.height, rot: ((i * 37) % 24) - 12 };
    });
    const cardH = geo[0]?.h || 300;
    const visible = view.h - (W.top - St.top);
    travel = Math.max(cardH * 0.8, wall.scrollHeight + cardH * 0.5 - visible);
    shared.cols = cols;
    // act 5 overlaps the last part of this pin (portal); the burst + wall timeline ends before that
    const overlap = view.h; // the last 100svh of this pin are the act 5 portal (its clipped lead-in before that is invisible)
    pEnd = clamp((el.offsetHeight - view.h - overlap) / Math.max(el.offsetHeight - view.h, 1), 0.3, 1);
  };
  track(el, raw => {
    const p = clamp(raw / pEnd), out = clamp((raw - pEnd) / (1 - pEnd + 1e-6));
    const lOpen = easeOut(clamp(p / 0.06)), lFade = clamp((p - 0.3) / 0.08), lBack = easeInOut(clamp((p - 0.84) / 0.16));
    put(launcher, "transform", `scale(${r3(lOpen * (1 - lFade * 0.6) + lBack * 1.6)})`);
    put(launcher, "opacity", String(r3(Math.max(lOpen * (1 - lFade), lBack * (1 - out)))));
    const w = clamp((p - 0.32) / 0.56);
    cards.forEach((c, i) => {
      const g = geo[i]; if (!g) return;
      const s = 0.02 + i * 0.012, t = clamp((p - s) / 0.2), e = easeExpo(t);
      const sp = speeds[g.col % 4], off = base[g.col % 4] * g.h;
      const arc = Math.sin(Math.PI * e) * (g.col % 2 ? -60 : 60);
      const x = g.dx * (1 - e) + arc, y = g.dy * (1 - e) + e * (off - w * travel * sp);
      put(c, "transform", `translate3d(${r1(x)}px, ${r1(y)}px, 0) rotate(${r1((1 - e) * g.rot)}deg) scale(${r3(0.18 + 0.82 * e)})`);
      put(c, "opacity", String(r3(clamp(t * 5))));
    });
    put(wall, "opacity", String(r3(1 - 0.75 * Math.max(clamp((p - 0.86) / 0.14), out))));
  }, { measure });
}

// ------------------------------------------------------------ act 4 -> 5: the O becomes a portal (SIGNATURE)
function portal() {
  const el = $('[data-act="portal"]'); if (!el) return;
  const stage = $("[data-portal-stage]", el), ring = $("[data-portal-ring]", el);
  let ox = 0, oy = 0, rMax = 0, base = 1;
  const measure = () => {
    ox = shared.ox || view.w / 2;
    oy = view.h / 2;
    rMax = Math.hypot(Math.max(ox, view.w - ox), Math.max(oy, view.h - oy)) + 24;
    base = Math.max(view.w, view.h);
    ring.style.setProperty("--ox", ox + "px"); ring.style.setProperty("--oy", oy + "px");
  };
  track(el, (_, a) => {
    // the stage is sticky (CSS), so nothing here moves it: the circle opens while the section top
    // travels from the viewport top (r = 0) to one viewport above it (r = -vh)
    const r = a.top - view.y;
    const q = clamp(-r / view.h);
    if (q >= 1) { put(stage, "clipPath", "none"); put(ring, "opacity", "0"); return; }
    const R = r1(easeInOut(q) * rMax);
    put(stage, "clipPath", `circle(${R}px at ${r1(ox)}px ${r1(oy)}px)`);
    put(ring, "transform", `scale(${r3((2 * R / 0.62) / base)})`);
    put(ring, "opacity", String(q <= 0 ? 0 : r3(1 - clamp((q - 0.8) / 0.2))));
  }, { measure });
}

// ------------------------------------------------------------ act 6: horizontal format gallery
function gallery() {
  const el = $('[data-act="gallery"]'); if (!el) return;
  const row = $("[data-row]", el), vp = $("[data-gallery-viewport]", el), tiles = $$("[data-tile]", el);
  let dist = 0;
  const measure = () => { put(row, "transform", ""); dist = Math.max(0, row.scrollWidth - vp.clientWidth); };
  track(el, p => {
    if (!desktop.matches) { put(row, "transform", ""); return; }
    const x = -dist * easeInOut(clamp((p - 0.05) / 0.85));
    put(row, "transform", `translate3d(${r1(x)}px, 0, 0)`);
    tiles.forEach((t, i) => put(t, "opacity", String(r3(0.35 + 0.65 * clamp(p * 4 - i * 0.6 + 1)))));
  }, { measure });
}

// After load and when the browser is idle: decode the lazy images of the coming scenes one by one,
// so a scene never stalls on its first frame while its pictures are decoded.
function predecode() {
  const imgs = $$('main img[loading="lazy"]');
  const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
  const next = () => idle(async () => {
    const img = imgs.shift(); if (!img) return;
    img.loading = "eager";
    try { await img.decode(); } catch { /* the browser decodes it on paint instead */ }
    next();
  });
  const go = () => setTimeout(next, 1200);
  if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
}

export function initScenes() {
  hero(); stack(); steps(); burst(); portal(); gallery();
  start();
  predecode();
}
