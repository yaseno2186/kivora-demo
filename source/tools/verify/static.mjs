// Static checks on the built files (no browser): W1, W4, W12, W13 (map, meta, JSON-LD, sitemap, images), W14.
// Usage: node tools/verify/static.mjs  -> writes verify/static.json and prints PASS/FAIL lines.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(WEB, "dist"), LAUNCH = path.join(WEB, "dist-launch");
const PROJ = path.dirname(WEB);
const C = JSON.parse(fs.readFileSync(path.join(WEB, "content/de.json"), "utf8"));
const out = {}; const log = (k, ok, detail) => { out[k] = { pass: ok, detail }; console.log(`${ok ? "PASS" : "FAIL"} ${k}: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`); };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pages = walk(DIST).filter(f => f.endsWith(".html"));
const rel = f => path.relative(DIST, f).replace(/\\/g, "/");
const read = f => fs.readFileSync(f, "utf8");
const strip = s => s.replace(/­/g, "").replace(/&shy;/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// ---------------- W1 colours + fonts only from tokens
{
  const css = read(path.join(DIST, "assets/css/main.css"));
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const tokenHex = new Set([...root.matchAll(/--[\w-]+:\s*(#[0-9A-Fa-f]{3,8})\b/g)].map(m => m[1].toUpperCase()));
  const brand = new Set(["#05070F", "#101C52", "#E6EAF0", "#8B95A7", "#78A4F9", "#3AA0FF", "#1A2EFF", "#FFFFFF"]);
  const tokensOk = [...tokenHex].every(h => brand.has(h)) && tokenHex.size === brand.size;
  const body = css.replace(/:root\s*\{[\s\S]*?\n\}/, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const stray = [...body.matchAll(/#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|(?<![-\w])(black|white|red|blue|gray|grey|navy|silver)(?![-\w])/g)].map(m => m[0]);
  const fams = [...css.matchAll(/font-family:\s*([^;}]+)/g)].map(m => m[1].trim()).concat([...css.matchAll(/--f-[\w]+:\s*([^;]+)/g)].map(m => m[1].trim()));
  const famOk = fams.every(f => /^(("Cal Sans"|"Inter")(,\s*(system-ui|sans-serif))*|var\(--f-(display|text)\))$/.test(f));
  const fontShorthand = [...body.matchAll(/font:\s*[^;]*?var\(--f-(display|text)\)/g)].length;
  log("W1.colours", tokensOk && stray.length === 0, { tokens: [...tokenHex], strayOutsideTokens: stray });
  log("W1.fonts", famOk, { families: [...new Set(fams)], fontShorthandsViaTokens: fontShorthand });
  const woff = fs.readdirSync(path.join(DIST, "assets/fonts")).filter(f => f.endsWith(".woff2"));
  log("W1.fontFiles", woff.length === 2 && woff.every(f => /cal-sans|inter/.test(f)), woff);
  // logo rules: nav logo uses no-dot symbol at 32px (< 48px), wordmark has no glow (no text-shadow / filter on wordmark classes)
  const navNoDot = pages.every(p => read(p).includes('ko-symbol-color-nodot.svg" width="32" height="32"'));
  const glowOnWord = /\.(brand__word|ending__word|site-foot__word)[^{]*\{[^}]*(text-shadow|filter|box-shadow)/.test(css);
  log("W1.logoRules", navNoDot && !glowOnWord, { navSymbolNoDotUnder48: navNoDot, glowOnWordmark: glowOnWord });
}

// ---------------- W4 honesty
{
  const html = Object.fromEntries(pages.map(p => [rel(p), read(p)]));
  const noindex = pages.every(p => /<meta name="robots" content="noindex/.test(read(p)));
  const robots = read(path.join(DIST, "robots.txt"));
  const footer = pages.every(p => read(p).includes("Konzept-Website von Armsin"));
  const start = html["index.html"];
  const wallCards = (start.match(/class="reel"/g) || []).length, wallBadges = (start.match(/<li class="reel"[\s\S]*?<\/li>/g) || []).filter(li => li.includes("Konzeptprojekt")).length;
  const grid = html["arbeiten/index.html"], gridCards = (grid.match(/<li class="concept"[\s\S]*?<\/li>/g) || []);
  const cases = C.concepts.map(c => html[`arbeiten/${c.slug}/index.html`]);
  const casesOk = cases.every(h => h.includes(">Konzeptprojekt<") && h.includes("Fiktive Marke") && h.includes("Ziel-KPIs (Konzept)"));
  const all = Object.values(html).map(strip).join(" ");
  const banned = ["trusted by", "Vertrauen uns", "Kundenstimmen", "Testimonial", "Bewertung", "Sterne", "Award", "Auszeichnung", "Follower", "zufriedene Kunden", "Referenzen"].filter(w => all.toLowerCase().includes(w.toLowerCase()));
  const reviewLd = Object.values(html).some(h => /"@type":"(Review|AggregateRating)"/.test(h));
  log("W4.noindexMeta", noindex, `${pages.length} pages with noindex`);
  log("W4.robotsDisallow", /Disallow: \/\s*$/m.test(robots), robots.trim().split("\n").pop());
  log("W4.footerNote", footer, "Konzept-Website von Armsin on every page");
  log("W4.labels", wallBadges === wallCards && gridCards.every(c => c.includes("Konzeptprojekt")) && casesOk, { wallCards, wallBadges, gridCards: gridCards.length, casePagesLabelled: casesOk });
  log("W4.noFakeProof", banned.length === 0 && !reviewLd, { bannedPhrasesFound: banned, reviewMarkup: reviewLd });
}

// ---------------- W13 page map, meta, structure (demo build) + launch build robots/sitemap
{
  const map = [
    ...Object.entries(C.seo).map(([k, s]) => ({ file: s.path === "" ? "index.html" : s.path === "404.html" ? "404.html" : s.path + "index.html", ...s })),
    ...C.concepts.map(c => ({ file: `arbeiten/${c.slug}/index.html`, path: `arbeiten/${c.slug}/`, title: c.seoTitle, description: c.seoDescription, h1: `${c.name}: ${c.idea}`, index: true }))
  ];
  const problems = [], titles = new Set(), descs = new Set();
  const noindexAlways = ["impressum/", "datenschutz/", "bildnachweise/", "404.html"];
  for (const m of map) {
    const h = read(path.join(DIST, m.file)), hl = read(path.join(LAUNCH, m.file));
    const t = strip(h.match(/<title>([\s\S]*?)<\/title>/)[1]);
    const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const h1s = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(x => strip(x[1]));
    const levels = [...h.matchAll(/<h([1-6])\b/g)].map(x => +x[1]);
    let skip = false; for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skip = true;
    const canon = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const hreflang = /hreflang="de"/.test(h) && /hreflang="x-default"/.test(h);
    const og = ["og:title", "og:description", "og:url", "og:image"].every(k => h.includes(`property="${k}"`));
    const lang = /<html lang="de">/.test(h);
    const slugOk = /^[a-z0-9\-/.]*$/.test(m.path) && !/[äöüß]/.test(m.path);
    const launchRobots = (hl.match(/<meta name="robots" content="([^"]+)"/) || [])[1];
    const launchOk = noindexAlways.includes(m.path) ? launchRobots.startsWith("noindex") : launchRobots === "index, follow";
    const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map(x => x[0]);
    const imgBad = imgs.filter(i => !/\salt="[^"]*"/.test(i) || !/\swidth="\d+"/.test(i) || !/\sheight="\d+"/.test(i));
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x => JSON.parse(x[1]));
    const types = ld.flatMap(j => j["@graph"].map(n => [].concat(n["@type"]).join("+")));
    const needCrumb = m.file !== "index.html" && m.file !== "404.html";
    const ldOk = types.includes("Organization+ProfessionalService") && types.includes("WebSite") && (!needCrumb || types.includes("BreadcrumbList")) && (m.file !== "index.html" || types.includes("FAQPage"));
    const err = [];
    if (t !== m.title) err.push(`title "${t}"`);
    if (t.length > 60) err.push(`title ${t.length} chars`);
    if (!d || d !== m.description) err.push("description mismatch");
    if (d && (d.length < 120 || d.length > 155)) err.push(`description ${d.length} chars`);
    if (titles.has(t)) err.push("duplicate title"); titles.add(t);
    if (descs.has(d)) err.push("duplicate description"); descs.add(d);
    if (h1s.length !== 1 || h1s[0] !== m.h1) err.push(`h1 ${JSON.stringify(h1s)}`);
    if (skip) err.push("skipped heading level");
    if (!canon || !hreflang || !og || !lang) err.push("canonical/hreflang/og/lang missing");
    if (!slugOk) err.push("slug");
    if (!launchOk) err.push(`launch robots ${launchRobots}`);
    if (imgBad.length) err.push(`${imgBad.length} img without alt/width/height`);
    if (!ldOk) err.push(`json-ld ${types}`);
    if (err.length) problems.push({ page: m.file, err });
  }
  log("W13.pageMap", problems.length === 0, problems.length ? problems : `${map.length} pages: title, description, H1 match the P9 map; lengths ok; unique; one H1; no skipped levels; canonical + hreflang + OG + lang; launch robots correct; img alt+size; JSON-LD types present`);
  const sm = read(path.join(LAUNCH, "sitemap.xml"));
  const smUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]);
  const smOk = smUrls.length === 10 && !smUrls.some(u => /impressum|datenschutz|bildnachweise|404/.test(u));
  log("W13.sitemap", smOk, smUrls.map(u => u.replace(C.site.baseUrl, "")));
  log("W13.robotsLaunch", /Allow: \//.test(read(path.join(LAUNCH, "robots.txt"))), read(path.join(LAUNCH, "robots.txt")).trim().split("\n"));
  const fav = ["assets/favicon.svg", "assets/favicon-32.png", "assets/apple-touch-icon.png", "assets/icon-512.png", "site.webmanifest", "assets/img/og-kivora.jpg"].map(f => [f, fs.existsSync(path.join(DIST, f))]);
  log("W13.faviconsOg", fav.every(f => f[1]), fav);
  // service <-> concept links
  const leist = read(path.join(DIST, "leistungen/index.html"));
  const svcToConcept = C.leistungen.services.every(s => leist.includes(`arbeiten/${s.concept}/`));
  const conceptToSvc = C.concepts.every(c => read(path.join(DIST, `arbeiten/${c.slug}/index.html`)).includes(`leistungen/#${c.service}`));
  log("W13.internalLinks", svcToConcept && conceptToSvc, { serviceToConcept: svcToConcept, conceptToService: conceptToSvc });
}

// ---------------- W12 licences / sources / no hotlinking
{
  const credits = read(path.join(PROJ, "plan/credits.txt"));
  const bild = read(path.join(DIST, "bildnachweise/index.html"));
  const ids = ["OFdqt1ECako", "Mxy5gokl8mE", "IiawyjrLTqc", "pCS5gimk5B8", "ZqdZECdJlRk", "lkHNDf-oXTk", "HTXKn_dv8PE", "a55bIlD8ALw", "-NsRIH1nAL8", "B1aZL41ACkc", "ssvjJLB6wIw", "lWFSNBQiI8g", "36926172"];
  const missing = ids.filter(i => !credits.includes(i) || !bild.includes(i));
  const src = ["blender/ko3d.py", "blender/ko3d.blend", "blender/hero-fg.py", "blender/hero-fg.blend", "affinity/ko-symbol-color.af", "affinity/icon-reel.af", "affinity/phone-frame.af", "scripts/make_og_grain.py", "grade/kivora-duotone.cube", "grade/kivora-tint.cube"].map(f => [f, fs.existsSync(path.join(PROJ, "assets-src", f))]);
  const hot = pages.flatMap(p => [...read(p).matchAll(/\s(?:src|srcset|href|poster)="(https?:[^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith(C.site.baseUrl) && !/unsplash\.com\/(photos|license)|pexels\.com\/(video|license)/.test(u)).map(u => rel(p) + " " + u));
  const cssUrls = [...read(path.join(DIST, "assets/css/main.css")).matchAll(/url\("?(https?:[^")]+)/g)].map(m => m[1]);
  log("W12.credits", missing.length === 0, missing.length ? { missing } : `${ids.length} stock items recorded in credits.txt and on /bildnachweise/`);
  log("W12.sourceFiles", src.every(s => s[1]), src);
  log("W12.noHotlinks", hot.length === 0 && cssUrls.length === 0, hot.concat(cssUrls));
}

// ---------------- W14 code quality
{
  const inline = pages.flatMap(p => [...read(p).matchAll(/\sstyle="([^"]*)"/g)].map(m => m[1]).filter(s => s.split(";").filter(Boolean).some(d => !d.trim().startsWith("--"))).map(s => rel(p) + ": " + s));
  const cssFiles = walk(path.join(DIST, "assets")).filter(f => f.endsWith(".css"));
  const js = walk(path.join(DIST, "assets/js")).map(f => [path.basename(f), fs.statSync(f).size]);
  const readme = fs.existsSync(path.join(PROJ, "README.md")) ? read(path.join(PROJ, "README.md")) : "";
  log("W14.noInlineStyles", inline.length === 0, inline.length ? inline.slice(0, 5) : "only CSS custom properties in style attributes");
  log("W14.oneCssEntry", cssFiles.length === 1, cssFiles.map(rel));
  log("W14.jsModules", js.length >= 5 && js.every(([, s]) => s < 12000), js);
  log("W14.readme", /content\/de\.json/.test(readme) && /Cal\.com|Calendly/.test(readme) && /serve/.test(readme), readme ? "README covers run, edit content, booking" : "README missing");
}

fs.mkdirSync(path.join(WEB, "verify"), { recursive: true });
fs.writeFileSync(path.join(WEB, "verify/static.json"), JSON.stringify(out, null, 1));
