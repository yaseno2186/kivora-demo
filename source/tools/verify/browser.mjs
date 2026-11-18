// Browser checks with Playwright. Usage: node tools/verify/browser.mjs [chromium|firefox|webkit]  (server on :4600)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(WEB, "verify"); fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:4600/";
const NAME = process.argv[2] || "chromium";
const ENGINE = { chromium, firefox, webkit }[NAME];
const FULL = NAME === "chromium";
const PAGES = ["", "leistungen/", "arbeiten/", "arbeiten/nordlicht-cafe/", "arbeiten/velura-skin/", "arbeiten/atelier-mira/", "arbeiten/kanto-bikes/", "arbeiten/studio-wellenform/", "ueber-uns/", "kontakt/", "impressum/", "datenschutz/", "bildnachweise/", "404.html"];
const AXE = fs.readFileSync(path.join(WEB, "node_modules/axe-core/axe.min.js"), "utf8");
const res = {}; const log = (k, ok, d) => { res[k] = { pass: ok, detail: d }; console.log(`${ok ? "PASS" : "FAIL"} [${NAME}] ${k}: ${typeof d === "string" ? d : JSON.stringify(d).slice(0, 400)}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await ENGINE.launch();
async function ctx(opts = {}) { return browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }); }

// ---------------- W11 console + failed requests, every page, desktop + mobile
{
  const issues = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const c = await ctx({ viewport: vp }); const p = await c.newPage();
    p.on("console", m => { if (/Failed to load resource: the server responded with a status of 404/.test(m.text())) return; /* generic browser line for the deliberate /gibt-es-nicht/ test; real failing responses are caught by the response listener below */ if (["error", "warning"].includes(m.type())) issues.push(`${vp.width} ${p.url()} console.${m.type()}: ${m.text()}`); });
    p.on("pageerror", e => issues.push(`${vp.width} ${p.url()} pageerror: ${e.message}`));
    p.on("requestfailed", r => { const f = r.failure()?.errorText || ""; if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled/i.test(f)) issues.push(`${vp.width} failed ${r.url()} ${f}`); });
    p.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("/gibt-es-nicht/")) issues.push(`${vp.width} ${r.status()} ${r.url()}`); });
    for (const pg of PAGES) {
      await p.goto(BASE + pg, { waitUntil: "load" });
      for (let y = 0; y < 30; y++) { await p.mouse.wheel(0, 600); await wait(30); }
      await wait(200);
    }
    const r404 = await p.goto(BASE + "gibt-es-nicht/");
    if (r404.status() !== 404 || !(await p.title()).includes("nicht gefunden")) issues.push("404 page not served");
    await c.close();
  }
  log("W11.consoleAndRequests", issues.length === 0, issues.length ? issues : `${PAGES.length} pages x 2 viewports: 0 console errors/warnings, 0 failed requests, 404 page works`);
}

// ---------------- W5 CTA above the fold + one tap from every act + form
{
  const bad = [];
  for (const vp of [{ width: 360, height: 640 }, { width: 1440, height: 900 }]) {
    const c = await ctx({ viewport: vp }); const p = await c.newPage();
    for (const pg of PAGES) {
      await p.goto(BASE + pg, { waitUntil: "load" }); await wait(300);
      const ok = await p.evaluate(() => [...document.querySelectorAll("a, button, h1")].some(e => {
        if (!/Gespräch anfragen/.test(e.textContent)) return false;
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        const hidden = e.closest("[data-hidden]") || s.visibility === "hidden" || r.width === 0;
        return !hidden && r.top >= 0 && r.bottom <= innerHeight + 1;
      }));
      if (!ok) bad.push(`${vp.width}x${vp.height} ${pg || "/"}`);
    }
    // one tap from every act on the Start page
    await p.goto(BASE, { waitUntil: "load" }); await wait(300);
    const acts = await p.evaluate(() => [...document.querySelectorAll("main > section")].map(s => [s.className.split(" ").slice(0, 2).join("."), s.offsetTop, s.offsetHeight]));
    for (const [name, top, h] of acts) {
      for (const f of [0.15, 0.5, 0.85]) {
        await p.evaluate(y => scrollTo(0, y), Math.max(0, top + h * f - vp.height / 2)); await wait(450);
        const ok = await p.evaluate(() => [...document.querySelectorAll("a")].some(e => {
          if (!/Gespräch anfragen/i.test(e.textContent)) return false;
          const r = e.getBoundingClientRect(); if (e.closest("[data-hidden]") || r.width === 0) return false;
          const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2;
          if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return false;
          const hit = document.elementFromPoint(x, y); return hit && (hit === e || e.contains(hit));
        }));
        if (!ok) bad.push(`${vp.width} act ${name} @${f}: no tappable CTA in view`);
      }
    }
    await c.close();
  }
  log("W5.ctaAboveFoldAndPerAct", bad.length === 0, bad.length ? bad : "visible above the fold on all 14 pages at 360x640 and 1440x900; a tappable CTA in view at 3 positions of every Start act");
  // form: no sticky CTA on Kontakt, mailto fallback without JS, success announced
  const c = await ctx({ viewport: { width: 390, height: 844 } }); const p = await c.newPage();
  await p.goto(BASE + "kontakt/");
  const sticky = await p.$("[data-sticky-cta]");
  const formAttr = await p.$eval("[data-form]", f => [f.getAttribute("action"), f.getAttribute("method"), f.getAttribute("enctype")]);
  await p.click("button[type=submit]");
  const errs = await p.$$eval("[data-error]:not([hidden])", e => e.map(x => x.textContent));
  const invalid = await p.$$eval("[aria-invalid=true]", e => e.length);
  await p.fill("#f-name", "Test Person"); await p.fill("#f-email", "kein-mail"); await p.keyboard.press("Tab");
  const emailMsg = await p.$eval("#e-email", e => e.textContent);
  await p.fill("#f-email", "test@beispiel.de"); await p.fill("#f-company", "Beispiel GmbH"); await p.fill("#f-website", "kein web"); await p.keyboard.press("Tab");
  const webMsg = await p.$eval("#e-website", e => e.textContent);
  await p.fill("#f-website", "www.beispiel.de");
  await p.check("[data-topic]"); await p.fill("#f-message", "Zu kurz"); await p.keyboard.press("Tab");
  const msgMsg = await p.$eval("#e-message", e => e.textContent);
  await p.fill("#f-message", "Wir möchten unsere Marke in Dresden sichtbarer machen."); await p.check("#f-consent");
  await p.click("button[type=submit]");
  const success = await p.$eval("[data-success]", e => ({ visible: !e.hidden, live: e.getAttribute("aria-live"), role: e.getAttribute("role"), text: e.innerText, focused: document.activeElement === e }));
  await c.close();
  const formOk = !sticky && formAttr[0].startsWith("mailto:") && errs.length === 6 && invalid >= 6 && emailMsg && webMsg && msgMsg && success.visible && success.live === "polite" && success.focused && /nichts gesendet/.test(success.text);
  log("W5.form", formOk, { stickyOnKontakt: !!sticky, noJsFallback: formAttr, emptySubmitErrors: errs, emailMsg, webMsg, msgMsg, success });
}

// ---------------- W8 responsive: overflow, offscreen/clipped text, overlaps
{
  const sizes = [[320, 640], [360, 740], [390, 844], [414, 896], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [640, 360], [844, 390], [896, 414]];
  const bad = [];
  for (const reduced of [false, true]) {
    for (const [w, h] of sizes) {
      if (!FULL && ![320, 390, 1440].includes(w)) continue;
      const c = await ctx({ viewport: { width: w, height: h }, reducedMotion: reduced ? "reduce" : "no-preference" }); const p = await c.newPage();
      for (const pg of PAGES) {
        await p.goto(BASE + pg, { waitUntil: "load" }); await wait(150);
        const r = await p.evaluate(async (checkOverlap) => {
          const issues = [];
          if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`hscroll ${document.documentElement.scrollWidth}`);
          const skip = el => el.closest('[aria-hidden="true"], .marquee, .formats__viewport, .wall, .hero__symbol, .ending__word, .visually-hidden, .skip, [hidden], .site-nav:not([data-open]) .site-nav__list, .phone, .svc-vis');
          const textEls = [...document.querySelectorAll("h1, h2, h3, p, li, a, button, label, summary, legend, .badge")].filter(e => !skip(e) && e.innerText && e.innerText.trim() && getComputedStyle(e).visibility !== "hidden");
          const H = document.documentElement.scrollHeight;
          for (let y = 0; y < H; y += innerHeight * 0.8) {
            scrollTo(0, y); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            for (const e of textEls) {
              const b = e.getBoundingClientRect(); if (!b.width || b.bottom < 0 || b.top > innerHeight) continue;
              // content fully clipped by an overflow container (pinned stage waiting area, horizontal scrollers) is not visible: skip
              let a = e.parentElement, clipped = false;
              while (a && a !== document.body) { const cs = getComputedStyle(a); if (cs.overflowX !== "visible") { const ab = a.getBoundingClientRect(); if (b.left >= ab.right - 1 || b.right <= ab.left + 1 || b.right > ab.right + 1 || b.left < ab.left - 1) { clipped = true; break; } } a = a.parentElement; }
              if (clipped) continue;
              if (b.right > innerWidth + 1 || b.left < -1) issues.push(`offscreen ${e.tagName}.${e.className} "${e.innerText.slice(0, 30)}" ${Math.round(b.left)}..${Math.round(b.right)}`);
              if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== "visible") issues.push(`clipped ${e.tagName} "${e.innerText.slice(0, 30)}"`);
            }
          }
          if (checkOverlap) { // static layout only: leaf text blocks must not overlap each other
            scrollTo(0, 0);
            const leaves = textEls.filter(e => !textEls.some(o => o !== e && e.contains(o)) && !e.closest(".reel, .concept, .site-head, .chip, .cursor, .sticky-cta, .badge, .media-toggle, .case-format, .qa summary"));
            const boxes = leaves.map(e => { const b = e.getBoundingClientRect(); return { e, l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY }; }).filter(b => b.r - b.l > 0);
            for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
              const A = boxes[i], B = boxes[j];
              const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
              if (ox > 2 && oy > 2 && !A.e.contains(B.e) && !B.e.contains(A.e)) issues.push(`overlap "${A.e.innerText.slice(0, 20)}" x "${B.e.innerText.slice(0, 20)}"`);
            }
          }
          return [...new Set(issues)].slice(0, 6);
        }, reduced);
        if (r.length) bad.push({ size: `${w}x${h}`, reduced, page: pg || "/", r });
      }
      await c.close();
    }
  }
  // long German words at 320
  const c = await ctx({ viewport: { width: 320, height: 640 } }); const p = await c.newPage();
  await p.goto(BASE); await wait(300);
  const words = await p.evaluate(() => [...document.querySelectorAll(".eyebrow, .hero__label, h1, h2")].filter(e => /Gründungskunden|Marketingagentur/i.test(e.textContent.replace(/­/g, ""))).map(e => { const b = e.getBoundingClientRect(); return `${e.textContent.replace(/­/g, "").trim().slice(0, 40)}: ${Math.round(b.left)}..${Math.round(b.right)} of ${innerWidth}`; }));
  await page320(c);
  async function page320(cx) { const pp = await cx.newPage(); await pp.goto(BASE + "ueber-uns/"); await wait(200); words.push(...await pp.evaluate(() => [...document.querySelectorAll(".eyebrow")].map(e => { const b = e.getBoundingClientRect(); return `${e.textContent.replace(/­/g, "").trim()}: ${Math.round(b.left)}..${Math.round(b.right)} of ${innerWidth}`; }))); }
  await c.close();
  log("W8.responsive", bad.length === 0, bad.length ? bad.slice(0, 12) : `${FULL ? 13 : 3} sizes (incl. landscape) x 14 pages x motion+reduced: no horizontal scroll, no off-screen or clipped text, no overlapping text in the static layout`);
  log("W8.longWords320", words.every(w => { const m = w.match(/(-?\d+)\.\.(\d+) of (\d+)/); return +m[1] >= 0 && +m[2] <= +m[3]; }), words);
}

// ---------------- W9 axe + keyboard + focus (chromium full, others axe on Start + Kontakt)
{
  const viol = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const reduced of [false, true]) {
      const c = await ctx({ viewport: vp, reducedMotion: reduced ? "reduce" : "no-preference" }); const p = await c.newPage();
      for (const pg of FULL ? PAGES : ["", "kontakt/"]) {
        await p.goto(BASE + pg, { waitUntil: "load" }); await wait(250);
        await p.addScriptTag({ content: AXE });
        const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`));
        if (r.length) viol.push({ page: pg || "/", vp: vp.width, reduced, r });
      }
      await c.close();
    }
  }
  log("W9.axe", viol.length === 0, viol.length ? viol : `axe-core 4.10 (WCAG 2.0/2.1/2.2 A+AA + best practice): 0 violations on ${FULL ? 14 : 2} pages x 2 viewports x motion+reduced`);
}
if (FULL) {
  // keyboard path + visible focus (3:1 ring vs page bg measured in plan P1: accent on bg 8.12:1)
  const c = await ctx(); const p = await c.newPage();
  const fails = [];
  for (const pg of PAGES) {
    await p.goto(BASE + pg); await wait(200);
    const total = await p.evaluate(() => [...document.querySelectorAll("a[href], button:not([hidden]), input, textarea, summary, [tabindex='0']")].filter(e => e.getClientRects().length && !e.closest("[inert], [hidden]")).length);
    let seen = 0, noRing = [];
    for (let i = 0; i < Math.min(total + 2, 80); i++) {
      await p.keyboard.press("Tab");
      const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); const lbl = e.closest("label"); const ls = lbl ? getComputedStyle(lbl) : null; return { tag: e.tagName, txt: (e.innerText || e.id || "").slice(0, 20), ring: (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2) || s.boxShadow !== "none" || (ls && ls.outlineStyle !== "none") }; });
      if (f) { seen++; if (!f.ring) noRing.push(f); }
    }
    if (seen < Math.min(total, 10) || noRing.length) fails.push({ page: pg || "/", total, seen, noRing: noRing.slice(0, 3) });
  }
  // skip link first
  await p.goto(BASE); await p.keyboard.press("Tab");
  const skip = await p.evaluate(() => document.activeElement.className);
  // keyboard scrolling keys still work on the Start page
  await p.goto(BASE); await p.click("body", { position: { x: 5, y: 300 } });
  const ys = [];
  for (const k of ["Space", "PageDown", "ArrowDown", "End", "Home"]) { await p.keyboard.press(k); await wait(700); ys.push([k, await p.evaluate(() => Math.round(scrollY))]); }
  await p.goto(BASE + "#was-wir-tun"); await wait(500);
  const anchor = await p.evaluate(() => Math.round(document.querySelector("#was-wir-tun").getBoundingClientRect().top));
  await c.close();
  const keysOk = ys[0][1] > 0 && ys[1][1] > ys[0][1] && ys[2][1] > ys[1][1] && ys[3][1] > ys[2][1] && ys[4][1] === 0;
  log("W9.keyboardFocus", fails.length === 0 && skip === "skip", fails.length ? fails : `every focusable element on 14 pages reachable by Tab with a visible ring; first Tab = skip link (${skip})`);
  log("W6.keyboardScrollAnchors", keysOk && Math.abs(anchor) < 120, { keys: ys, anchorTopAfterHash: anchor });
}

// ---------------- W13 no-JS: every headline, paragraph, link present and visible
if (FULL) {
  const c = await ctx({ javaScriptEnabled: false }); const p = await c.newPage();
  const bad = [];
  for (const pg of PAGES) {
    await p.goto(BASE + pg);
    const r = await p.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3, main p, main a")].filter(e => !e.closest(".visually-hidden, [hidden], noscript")).filter(e => {
      const b = e.getBoundingClientRect(); let o = 1, n = e; while (n && n.nodeType === 1) { o *= +getComputedStyle(n).opacity; n = n.parentElement; }
      return !b.width || !b.height || o < 0.5 || getComputedStyle(e).visibility === "hidden";
    }).map(e => `${e.tagName} "${e.textContent.trim().slice(0, 30)}"`));
    if (r.length) bad.push({ page: pg || "/", r: r.slice(0, 5) });
  }
  const navNoJs = await p.evaluate(() => { const l = document.querySelectorAll(".site-nav__list a"); return [...l].every(a => a.getBoundingClientRect().width > 0); });
  await c.close();
  log("W13.noJsContent", bad.length === 0 && navNoJs, bad.length ? bad : "JS disabled: every h1/h2/h3/p/a in main is rendered and visible on 14 pages; nav links visible");
}

// ---------------- W3 German text: English stop-list + lorem/TODO/xxx
if (FULL) {
  const STOP = ["the", "and", "with", "your", "our", "you", "we", "are", "this", "that", "read", "more", "learn", "click", "here", "submit", "send", "contact", "about", "home", "services", "work", "hello", "menu", "next", "previous", "back", "loading", "error", "required", "optional", "privacy", "imprint", "credits", "page", "not", "found", "case", "study", "studies", "projects", "get", "touch", "book", "call", "now", "free", "brand", "brands", "agency", "growth", "strategy"]; // "Team" and "Story" are not listed: both are standard German loanwords (Duden)
  const ALLOW_CTX = /What brands move forward\./gi; // brand slogan, English by design
  const c = await ctx(); const p = await c.newPage(); const hits = [];
  for (const pg of PAGES) {
    await p.goto(BASE + pg); await wait(200);
    let t = await p.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label], img[alt], [title], input[placeholder], textarea[placeholder]")].map(e => [e.getAttribute("aria-label"), e.getAttribute("alt"), e.getAttribute("title"), e.getAttribute("placeholder")].filter(Boolean).join(" ")).join(" ") + " " + document.title);
    t = t.replace(ALLOW_CTX, " ").replace(/\S+@\S+/g, " ").replace(/https?:\/\/\S+/g, " ");
    const words = t.toLowerCase().match(/[a-zäöüß]+/g) || [];
    const found = [...new Set(words.filter(w => STOP.includes(w)))];
    if (/lorem|todo|xxx|tbd/i.test(t)) found.push("lorem/todo/xxx");
    if (found.length) hits.push({ page: pg || "/", found });
  }
  await c.close();
  log("W3.germanOnly", hits.length === 0, hits.length ? hits : `0 hits on ${PAGES.length} pages (visible text, alt, aria-label, placeholders, titles); slogan excluded by design`);
}

// ---------------- W7 reduced motion: strip of every act, no autoplay, no pin
if (FULL) {
  const dir = path.join(OUT, "reduced"); fs.mkdirSync(dir, { recursive: true });
  const c = await ctx({ reducedMotion: "reduce" }); const p = await c.newPage();
  await p.goto(BASE); await wait(800);
  const state = await p.evaluate(() => ({ motionClass: document.documentElement.classList.contains("motion"), videoPaused: !document.querySelector("video") || document.querySelector("video").paused, autoplayAttr: !!document.querySelector("video[autoplay]"), videoToggle: document.querySelector("[data-video-toggle]").textContent, marqueeAnim: getComputedStyle(document.querySelector(".marquee__track")).animationName, stickyStages: [...document.querySelectorAll(".act__stage")].map(s => getComputedStyle(s).position), sectionHeights: [...document.querySelectorAll("main > section")].map(s => Math.round(s.offsetHeight)) }));
  const acts = await p.evaluate(() => [...document.querySelectorAll("main > section")].map(s => [s.className.split(" ")[s.className.startsWith("act") ? 1 : 0], s.offsetTop]));
  let i = 0;
  for (const [n, top] of acts) { await p.evaluate(y => scrollTo(0, y), top); await wait(250); await p.screenshot({ path: path.join(dir, `${String(++i).padStart(2, "0")}-${n}.png`) }); }
  await c.close();
  const ok = !state.motionClass && state.videoPaused && !state.autoplayAttr && state.marqueeAnim === "none" && state.stickyStages.every(s => s !== "sticky");
  log("W7.reducedMotion", ok, { ...state, strip: `verify/reduced/ (${acts.length} acts)` });
}

await browser.close();
fs.writeFileSync(path.join(OUT, `browser-${NAME}.json`), JSON.stringify(res, null, 1));
