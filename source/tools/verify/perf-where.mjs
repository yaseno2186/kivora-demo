// diagnostic: where do frames longer than 25 ms happen (Edge, new headless, 4x CPU)
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", args: ["--headless=new"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await p.context().newCDPSession(p);
await p.goto("http://127.0.0.1:4600/", { waitUntil: "load" }); await p.waitForTimeout(1500);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await p.evaluate(() => { window.__f = []; let last = performance.now(); const t = n => { if (n - last > 25) __f.push([Math.round(n - last), Math.round(scrollY)]); last = n; if (!window.__s) requestAnimationFrame(t); }; requestAnimationFrame(t); });
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (let y = 0; y < H; y += 120) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); }
const r = await p.evaluate(() => { __s = 1; const acts = [...document.querySelectorAll("main > section")].map(s => [s.className.split(" ").slice(0, 2).join("."), s.offsetTop, s.offsetTop + s.offsetHeight]); return __f.map(([d, y]) => [d, y, (acts.filter(x => y >= x[1] - 1).pop() || ["?"])[0]]); });
console.log(JSON.stringify(r)); await b.close();
