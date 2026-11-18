// Step 7 deliverables: screenshots of every page (desktop 1440 + mobile 390, first screen + full page)
// and a ~25 s screen recording of the Start page scroll experience. Output: ../deliver/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(path.dirname(WEB), "deliver");
const SHOTS = path.join(OUT, "screenshots"); fs.mkdirSync(SHOTS, { recursive: true });
const BASE = "http://127.0.0.1:4600/";
const PAGES = [["start", ""], ["leistungen", "leistungen/"], ["arbeiten", "arbeiten/"], ["case-nordlicht-cafe", "arbeiten/nordlicht-cafe/"], ["case-kanto-bikes", "arbeiten/kanto-bikes/"], ["ueber-uns", "ueber-uns/"], ["kontakt", "kontakt/"], ["impressum", "impressum/"], ["datenschutz", "datenschutz/"], ["bildnachweise", "bildnachweise/"], ["404", "gibt-es-nicht/"]];
const b = await chromium.launch({ channel: "msedge", args: ["--headless=new"] });
for (const [vpName, vp, extra] of [["desktop", { width: 1440, height: 900 }, {}], ["mobile", { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  // first screens with motion on; full pages in the calm reduced-motion layout (pinned scenes cannot be shown on one long image)
  const live = await b.newContext({ viewport: vp, ...extra });
  const calm = await b.newContext({ viewport: vp, ...extra, reducedMotion: "reduce" });
  for (const [name, url] of PAGES) {
    const p = await live.newPage(); await p.goto(BASE + url, { waitUntil: "load" }); await p.waitForTimeout(1800);
    await p.screenshot({ path: path.join(SHOTS, `${vpName}-${name}.png`) }); await p.close();
    const q = await calm.newPage(); await q.goto(BASE + url, { waitUntil: "load" });
    await q.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await q.waitForTimeout(500);
    await q.screenshot({ path: path.join(SHOTS, `${vpName}-${name}-ganze-seite.png`), fullPage: true }); await q.close();
  }
  await live.close(); await calm.close();
}
// recording: smooth scroll through the whole Start page at 1440x900
const rec = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: path.join(OUT, "rec-raw"), size: { width: 1440, height: 900 } } });
const p = await rec.newPage();
await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(2200);
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await p.evaluate(async H => {
  const dur = 23000, t0 = performance.now();
  await new Promise(done => { const step = t => { const k = Math.min(1, (t - t0) / dur); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, e * H); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); });
}, H);
await p.waitForTimeout(2000);
const vid = await p.video().path();
await rec.close(); await b.close();
fs.renameSync(vid, path.join(OUT, "rec-raw", "start-scroll.webm"));
console.log("done", fs.readdirSync(SHOTS).length, "screenshots");
