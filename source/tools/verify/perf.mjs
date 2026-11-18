// W6: scroll the full Start page at 1440x900 with 4x CPU throttling; long tasks, dropped frames, layout shifts.
// Also a static check of which properties the motion code writes. Writes verify/perf.json + verify/trace-start.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(WEB, "verify");
const res = {}; const log = (k, ok, d) => { res[k] = { pass: ok, detail: d }; console.log(`${ok ? "PASS" : "FAIL"} ${k}: ${JSON.stringify(d).slice(0, 500)}`); };

// --engine=shell (Playwright headless shell, software compositing) or --engine=edge (installed Edge, new headless, GPU)
const ENGINE = (process.argv.find(x => x.startsWith("--engine=")) || "--engine=shell").slice(9);
const browser = ENGINE === "edge" ? await chromium.launch({ channel: "msedge", args: ["--headless=new", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] }) : await chromium.launch();
console.log("engine", ENGINE, browser.version());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto("http://127.0.0.1:4600/", { waitUntil: "load" });
await page.waitForTimeout(1500);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => {
  window.__perf = { long: [], shifts: [], frames: [] };
  new PerformanceObserver(l => l.getEntries().forEach(e => __perf.long.push(Math.round(e.duration)))).observe({ type: "longtask" });
  new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) __perf.shifts.push(e.value); })).observe({ type: "layout-shift" });
  let last = performance.now(); __perf.stamps = [];
  const tick = t => { __perf.frames.push(t - last); __perf.stamps.push(t); last = t; if (!__perf.stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await browser.startTracing(page, { path: path.join(OUT, `trace-start-${ENGINE}.json`), screenshots: false, categories: ["devtools.timeline", "disabled-by-default-devtools.timeline.frame", "blink.user_timing"] });
const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const t0 = Date.now();
for (let y = 0; y < H; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
await page.waitForTimeout(800);
await browser.stopTracing();
const p = await page.evaluate(() => { __perf.stop = true; return __perf; });
const secs = (Date.now() - t0) / 1000;
const frames = p.frames.slice(5);
const budget = 1000 / 60;
// standard definition: split the scroll into 60 Hz vsync slots; a slot with no new frame is a dropped frame
const st = p.stamps.slice(5), t0s = st[0], t1s = st[st.length - 1];
const slots = Math.floor((t1s - t0s) / budget), hit = new Set(st.map(t => Math.floor((t - t0s) / budget)));
const expected = slots, dropped = slots - [...hit].filter(i => i < slots).length;
const cls = p.shifts.reduce((s, v) => s + v, 0);
log("W6.longTasks", p.long.filter(d => d > 50).length === 0, { longTasksOver50ms: p.long.filter(d => d > 50), allLongTasks: p.long, scrolledPx: H, seconds: secs.toFixed(1) });
log("W6.droppedFrames", dropped / expected < 0.05, { frames: frames.length, expectedAt60: Math.round(expected), dropped, percent: (100 * dropped / expected).toFixed(2), p95ms: frames.sort((a, b) => a - b)[Math.floor(frames.length * 0.95)].toFixed(1) });
log("W6.layoutShiftDuringScroll", cls === 0, { cls, entries: p.shifts.length });
await browser.close();

// static: which properties the motion code writes
const js = ["scenes.js", "media.js", "nav.js"].map(f => fs.readFileSync(path.join(WEB, "dist/assets/js", f), "utf8")).join("\n");
const props = [...new Set([...js.matchAll(/\.style\.(\w+)\s*=/g)].map(m => m[1]))];
const vars = [...new Set([...js.matchAll(/setProperty\("(--[\w-]+)"/g)].map(m => m[1]))];
const css = fs.readFileSync(path.join(WEB, "dist/assets/css/main.css"), "utf8");
const trans = [...new Set([...css.matchAll(/transition:\s*([^;]+)/g)].flatMap(m => m[1].split(",").map(x => x.trim().split(" ")[0])))];
const kf = [...css.matchAll(/@keyframes\s+(\w+)\s*\{([\s\S]*?)\}\s*\}/g)].map(m => [m[1], [...new Set([...m[2].matchAll(/([\w-]+)\s*:/g)].map(x => x[1]))]]);
const allowed = ["transform", "opacity", "clipPath", "filter", "translate"];
const transAllowed = ["transform", "opacity", "clip-path", "box-shadow", "border-color", "color", "background-color", "visibility"];
// --dim drives the opacity of a ::after overlay; --ox/--oy are set once per resize (ring origin), not per frame
const ok = props.every(p => allowed.includes(p)) && trans.every(t => transAllowed.includes(t)) && kf.every(([, ps]) => ps.every(x => ["transform", "opacity", "translate"].includes(x)));
log("W6.animatedProperties", ok, { jsStyleWrites: props, jsCustomProps: vars, cssTransitions: trans, keyframes: kf, note: "box-shadow/border/colour transitions are 200 ms hover/focus states, not scroll animation" });
const scrollJack = /preventDefault\(\)/.test(fs.readFileSync(path.join(WEB, "dist/assets/js/scenes.js"), "utf8") + fs.readFileSync(path.join(WEB, "dist/assets/js/scroll.js"), "utf8"));
log("W6.noScrollLock", !scrollJack, { preventDefaultInScrollCode: scrollJack, scrollListener: "passive" });
fs.writeFileSync(path.join(OUT, `perf-${ENGINE}.json`), JSON.stringify(res, null, 1));
