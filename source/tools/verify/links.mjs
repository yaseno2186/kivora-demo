// W11: link checker (all internal href/src/srcset/poster + external links) and W3C Nu HTML validation of every page.
// External requests: unsplash.com / pexels.com credit pages (public) and validator.w3.org (receives the public demo HTML only).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(WEB, "dist");
const BASE = "http://127.0.0.1:4600/";
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pages = walk(DIST).filter(f => f.endsWith(".html"));
const UA = { "User-Agent": "Mozilla/5.0 (link-check)" };
const internal = new Map(), external = new Set();
for (const f of pages) {
  const rel = path.relative(DIST, f).replace(/\\/g, "/");
  const pageUrl = new URL(rel.replace(/index\.html$/, ""), BASE);
  const html = fs.readFileSync(f, "utf8");
  const base = rel === "404.html" ? new URL(BASE) : pageUrl;
  const refs = [...html.matchAll(/\s(?:href|src|poster|data-webm|data-mp4)="([^"]*)"/g)].map(m => m[1])
    .concat([...html.matchAll(/\ssrcset="([^"]*)"/g)].flatMap(m => m[1].split(",").map(s => s.trim().split(" ")[0])))
    .concat([...html.matchAll(/imagesrcset="([^"]*)"/g)].flatMap(m => m[1].split(",").map(s => s.trim().split(" ")[0])));
  for (const r of refs) {
    if (!r || r.startsWith("mailto:") || r.startsWith("#")) continue;
    if (/^https?:/.test(r)) { if (!r.startsWith("https://kivora.example")) external.add(r); continue; }
    const u = new URL(r, base); u.hash = "";
    if (!internal.has(u.href)) internal.set(u.href, rel);
  }
}
const css = fs.readFileSync(path.join(DIST, "assets/css/main.css"), "utf8");
for (const m of css.matchAll(/url\("?([^")]+)"?\)/g)) internal.set(new URL(m[1], BASE + "assets/css/").href, "main.css");
const bad = [];
for (const [u, from] of internal) { const r = await fetch(u); if (r.status !== 200) bad.push(`${r.status} ${u} (from ${from})`); }
const extBad = [];
for (const u of external) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow" }); if (r.status >= 400) extBad.push(`${r.status} ${u}`); }
  catch (e) { extBad.push(`ERR ${u} ${e.message}`); }
}
const log = [`internal links/assets checked: ${internal.size}, broken: ${bad.length}`, ...bad, `external links checked: ${external.size}, broken: ${extBad.length}`, ...extBad, ...[...external].map(u => "  ok? " + u)];

// W3C Nu validator
const val = [];
for (const f of pages) {
  const rel = path.relative(DIST, f).replace(/\\/g, "/");
  const r = await fetch("https://validator.w3.org/nu/?out=json", { method: "POST", headers: { ...UA, "Content-Type": "text/html; charset=utf-8" }, body: fs.readFileSync(f) });
  const j = await r.json();
  const errors = j.messages.filter(m => m.type === "error"), warnings = j.messages.filter(m => m.type === "info" && m.subType === "warning");
  val.push({ page: rel, errors: errors.length, warnings: warnings.length, first: errors.slice(0, 3).map(e => `${e.lastLine}: ${e.message}`), warn: warnings.slice(0, 2).map(e => e.message) });
  await new Promise(r => setTimeout(r, 1200));
}
fs.writeFileSync(path.join(WEB, "verify/linkcheck.log"), log.join("\n") + "\n");
fs.writeFileSync(path.join(WEB, "verify/w3c.json"), JSON.stringify(val, null, 1));
console.log(log.slice(0, 6).join("\n"));
console.log(`${bad.length + extBad.length === 0 ? "PASS" : "FAIL"} W11.links`);
const vErr = val.reduce((s, v) => s + v.errors, 0);
console.log(`${vErr === 0 ? "PASS" : "FAIL"} W11.w3c: ${val.length} pages, ${vErr} errors, ${val.reduce((s, v) => s + v.warnings, 0)} warnings`);
val.filter(v => v.errors || v.warnings).forEach(v => console.log(" ", v.page, v.errors, v.warnings, JSON.stringify(v.first), JSON.stringify(v.warn)));
