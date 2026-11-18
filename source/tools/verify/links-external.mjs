// External links checked with a real browser engine (Unsplash/Pexels block plain scripted requests with 401/403).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(WEB, "dist/bildnachweise/index.html"), "utf8");
const urls = [...new Set([...html.matchAll(/href="(https:\/\/(?:unsplash|www\.pexels)[^"]+)"/g)].map(m => m[1]))];
const b = await chromium.launch({ channel: "msedge", args: ["--headless=new"] }); const p = await b.newPage();
const out = [];
for (const u of urls) { const r = await p.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(e => null); out.push(`${r ? r.status() : "ERR"} ${u} "${(await p.title().catch(() => "")).slice(0, 60)}"`); }
await b.close();
fs.appendFileSync(path.join(WEB, "verify/linkcheck.log"), "\nexternal re-check with a real browser (Edge):\n" + out.join("\n") + "\n");
const bad = out.filter(l => !/^2\d\d /.test(l));
console.log(out.join("\n")); console.log(`${bad.length ? "FAIL" : "PASS"} W11.externalLinks: ${urls.length} checked, ${bad.length} broken`);
