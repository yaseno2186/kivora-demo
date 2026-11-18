// W10: Lighthouse mobile, 3 runs per URL, median. Demo build (:4600) and launch build (:4601, SEO without noindex).
// Uses the installed Edge (Chromium) because Google Chrome is not installed on this machine.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(WEB, "verify/lighthouse"); fs.mkdirSync(OUT, { recursive: true });
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const targets = [
  ["demo-start", "http://127.0.0.1:4600/", 3],
  ["launch-start", "http://127.0.0.1:4601/", 3],
  ["launch-kontakt", "http://127.0.0.1:4601/kontakt/", 1],
  ["launch-case", "http://127.0.0.1:4601/arbeiten/kanto-bikes/", 1],
  ["launch-leistungen", "http://127.0.0.1:4601/leistungen/", 1]
];
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const summary = {};
const chrome = await chromeLauncher.launch({ chromePath: EDGE, chromeFlags: ["--headless=new", "--no-first-run"] });
for (const [name, url, runs] of targets) {
  const rs = [];
  for (let i = 0; i < runs; i++) {
    const r = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", formFactor: "mobile", screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75 }, throttlingMethod: "simulate" });
    const lhr = r.lhr, a = lhr.audits;
    const items = a["network-requests"]?.details?.items || [];
    const sum = f => items.filter(f).reduce((s, x) => s + (x.transferSize || 0), 0);
    rs.push({
      perf: Math.round(lhr.categories.performance.score * 100), a11y: Math.round(lhr.categories.accessibility.score * 100),
      bp: Math.round(lhr.categories["best-practices"].score * 100), seo: Math.round(lhr.categories.seo.score * 100),
      lcp: a["largest-contentful-paint"].numericValue, cls: a["cumulative-layout-shift"].numericValue, tbt: a["total-blocking-time"].numericValue,
      inpProxy: a["max-potential-fid"]?.numericValue,
      totalKB: Math.round(sum(() => true) / 1024), jsKB: Math.round(sum(x => x.resourceType === "Script") / 1024), cssKB: Math.round(sum(x => x.resourceType === "Stylesheet") / 1024),
      fontKB: Math.round(sum(x => x.resourceType === "Font") / 1024), imgKB: Math.round(sum(x => x.resourceType === "Image") / 1024),
      failing: Object.values(a).filter(x => x.score !== null && x.score < 1 && x.scoreDisplayMode === "binary").map(x => x.id)
    });
    if (i === 0) fs.writeFileSync(path.join(OUT, `${name}.json`), r.report);
  }
  const m = k => median(rs.map(r => r[k]));
  summary[name] = { runs: rs.length, perf: m("perf"), a11y: m("a11y"), bp: m("bp"), seo: m("seo"), lcpMs: Math.round(m("lcp")), cls: +m("cls").toFixed(3), tbtMs: Math.round(m("tbt")), maxPotentialFidMs: Math.round(m("inpProxy")), totalKB: m("totalKB"), jsKB: m("jsKB"), cssKB: m("cssKB"), fontKB: m("fontKB"), imgKB: m("imgKB"), failingBinaryAudits: rs[0].failing, all: rs.map(r => [r.perf, r.a11y, r.bp, r.seo]) };
  console.log(name, JSON.stringify(summary[name]));
}
await chrome.kill();
fs.writeFileSync(path.join(WEB, "verify/lighthouse.json"), JSON.stringify(summary, null, 1));
