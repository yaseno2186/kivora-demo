// W10 INP (lab): Event Timing durations of real interactions at 4x CPU, mobile 390x844, Edge new headless.
import fs from "node:fs";
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", args: ["--headless=new"] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
const res = {};
async function run(url, steps) {
  const p = await c.newPage(); const cdp = await c.newCDPSession(p);
  await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(800);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.evaluate(() => { window.__ev = []; new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.interactionId) __ev.push([e.name, Math.round(e.duration)]); })).observe({ type: "event", durationThreshold: 16, buffered: true }); });
  for (const s of steps) { await s(p); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);
  const ev = await p.evaluate(() => __ev); await p.close(); return ev;
}
res.start = await run("http://127.0.0.1:4600/", [
  p => p.click("[data-menu-toggle]"), p => p.keyboard.press("Escape"),
  async p => { await p.evaluate(() => document.querySelector("[data-filter]").scrollIntoView()); await p.click('[data-chip="food"]'); },
  p => p.click('[data-chip="all"]'),
  async p => { await p.evaluate(() => document.querySelector(".qa summary").scrollIntoView({ block: "center" })); await p.click(".qa summary"); }
]);
res.kontakt = await run("http://127.0.0.1:4600/kontakt/", [
  p => p.click("button[type=submit]"), p => p.click("#f-name"), p => p.keyboard.type("Test"), p => p.click("[data-topic] + span")
]);
res.arbeiten = await run("http://127.0.0.1:4600/arbeiten/", [p => p.click('[data-chip="beauty"]'), p => p.click('[data-chip="all"]')]);
await b.close();
const all = Object.values(res).flat().map(e => e[1]);
const worst = Math.max(16, ...all);
console.log(JSON.stringify(res));
console.log(`${worst < 200 ? "PASS" : "FAIL"} W10.inpLab: worst interaction ${worst} ms (event durations >= 16 ms are listed; none listed = all under 16 ms), 4x CPU, 390x844`);
fs.writeFileSync("verify/inp.json", JSON.stringify({ res, worst }, null, 1));
