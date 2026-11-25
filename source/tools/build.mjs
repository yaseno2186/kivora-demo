// KIVORA static site generator.
//   node tools/build.mjs            -> dist/        (demo: noindex everywhere, robots Disallow)
//   node tools/build.mjs --launch   -> dist-launch/ (launch build: indexable pages, sitemap, Allow)
//   --root=/kivora-demo/            -> base path for the 404 page when hosted in a sub folder
// All visible copy comes from content/de.json. Pages are plain HTML: readable without JavaScript.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.dirname(HERE);
const LAUNCH = process.argv.includes("--launch");
const ROOT = (process.argv.find(a => a.startsWith("--root=")) || "--root=/").slice(7);
const OUT = path.join(WEB, LAUNCH ? "dist-launch" : "dist");
const C = JSON.parse(fs.readFileSync(path.join(WEB, "content", "de.json"), "utf8"));
const A = JSON.parse(fs.readFileSync(path.join(HERE, "assets.json"), "utf8"));
const S = C.site;
const BASE = S.baseUrl;

// ---------------------------------------------------------------- helpers
// Soft hyphens at proper syllable points for long German words in headings: correct breaks in every
// browser, also where no German hyphenation dictionary is available (headless engines, some WebKit builds).
const SHY = { Aufmerksamkeit: "Aufmerk­samkeit", Gründungskunden: "Gründungs­kunden", Marketingagentur: "Marketing­agentur", Markenauftritte: "Marken­auftritte", Konzeptprojekte: "Konzept­projekte", Zusammenarbeit: "Zusammen­arbeit", Wellenform: "Wellen­form", Herausforderung: "Heraus­forderung", Bildnachweise: "Bild­nachweise", weitergezogen: "weiter­gezogen", Datenschutz: "Daten­schutz" };
const shy = s => String(s).replace(/[A-Za-zÄÖÜäöüß]{10,}/g, w => SHY[w] || w);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Signature detail: a headline's final period is the KO symbol's centre dot.
const hd = s => { const t = esc(shy(s)); return t.endsWith(".") ? `${t.slice(0, -1)}<span class="dot">.</span>` : t; };
const concept = slug => C.concepts.find(c => c.slug === slug);
const svcPath = { strategie: "leistungen/#strategie", content: "leistungen/#content", wachstum: "leistungen/#wachstum" };

function pic(name, { sizes = "100vw", alt = "", cls = "", eager = false, priority = false, ratio } = {}) {
  const a = A[name];
  if (!a) throw new Error("missing asset " + name);
  const set = ext => a.w.map(w => `${R}assets/img/${name}-${w}.${ext} ${w}w`).join(", ");
  const w = a.w[a.w.length - 1], h = Math.round(w * (ratio || a.ratio));
  const mid = a.w[Math.min(1, a.w.length - 1)];
  return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${R}assets/img/${name}-${mid}.webp" width="${w}" height="${h}" alt="${esc(alt)}"${eager ? "" : ' loading="lazy"'} decoding="async"${priority ? ' fetchpriority="high"' : ""}></picture>`;
}
const svgImg = (name, alt = "", cls = "", w = 24, h = 24) => `<img class="${cls}" src="${R}assets/img/${name}.svg" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

let R = ""; // relative prefix to site root for the page being rendered

// ---------------------------------------------------------------- JSON-LD
function jsonld(key, crumbs) {
  const org = {
    "@type": ["Organization", "ProfessionalService"], "@id": `${BASE}/#kivora`, name: S.name, slogan: S.slogan,
    description: C.start.about.text, url: `${BASE}/`, logo: `${BASE}/assets/icon-512.png`, image: `${BASE}/assets/img/og-kivora.jpg`,
    email: S.email,
    address: { "@type": "PostalAddress", addressLocality: S.city, addressRegion: S.region, addressCountry: "DE" },
    areaServed: [{ "@type": "City", name: S.city }, { "@type": "State", name: S.region }],
    knowsAbout: ["Marketingstrategie", "Content-Produktion", "Social-Media-Marketing", "Kampagnen"]
  };
  const site = { "@type": "WebSite", "@id": `${BASE}/#website`, url: `${BASE}/`, name: S.name, inLanguage: "de-DE", publisher: { "@id": `${BASE}/#kivora` } };
  const graph = [org, site];
  if (crumbs) graph.push({
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${BASE}/${c.path}` }))
  });
  if (key === "start") graph.push({
    "@type": "FAQPage", mainEntity: C.start.faq.items.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  });
  return `<!-- TODO sameAs: KIVORA hat noch keine Social-Media-Profile. Erst nach Anlage echte Profil-URLs als "sameAs" ergänzen, nie erfundene. -->
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;
}

// ---------------------------------------------------------------- shell
function head(key, seo, extra = "") {
  const url = `${BASE}/${seo.path === "404.html" ? "404.html" : seo.path}`;
  const robots = !LAUNCH ? "noindex, nofollow" : seo.index ? "index, follow" : "noindex, follow";
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${key === "404" ? `<base href="${ROOT}">\n` : ""}<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="theme-color" content="#05070F">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="KIVORA">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/assets/img/og-kivora.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="KIVORA, Marketingagentur in Dresden: das KO-Symbol in Blau auf dunklem Grund">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${R}assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${R}assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${R}assets/apple-touch-icon.png">
<link rel="manifest" href="${R}site.webmanifest">
${extra}<link rel="preload" href="${R}assets/fonts/cal-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${R}assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${R}assets/css/main.css">
<script>document.documentElement.classList.add("js");var d=document.documentElement,m=matchMedia("(min-width: 1024px)");if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("motion");d.classList.toggle("scenes",m.matches);m.addEventListener("change",function(e){d.classList.toggle("scenes",e.matches)})}</script>
<script type="module" src="${R}assets/js/main.js"></script>
${jsonld(key, seo.crumbs)}
</head>`;
}

function header(active) {
  const links = C.nav.map(n => `<li><a href="${R}${n.key}/"${active === n.key ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`).join("");
  return `<a class="skip" href="#inhalt">${esc(S.skip)}</a>
<header class="site-head" data-head>
  <a class="brand" href="${R}" aria-label="${esc(S.homeLabel)}">
    <img class="brand__mark" src="${R}assets/img/ko-symbol-color-nodot.svg" width="32" height="32" alt="" data-brand-mark>
    <span class="brand__word">KIVORA</span>
  </a>
  <nav class="site-nav" aria-label="${esc(S.navLabel)}" id="menu" data-menu>
    <ul class="site-nav__list">${links}</ul>
    <a class="btn btn--primary btn--small site-nav__cta" href="${R}kontakt/">${esc(S.cta)}</a>
  </nav>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle hidden><span class="menu-toggle__label" data-label-open="${esc(S.menuOpen)}" data-label-close="${esc(S.menuClose)}">${esc(S.menuOpen)}</span><span class="menu-toggle__icon" aria-hidden="true"></span></button>
</header>`;
}

function footer({ sticky = true } = {}) {
  const nav = C.nav.map(n => `<li><a href="${R}${n.key}/">${esc(n.label)}</a></li>`).join("");
  return `<footer class="site-foot">
  <div class="site-foot__grid">
    <div class="site-foot__brand">
      <p class="site-foot__word">KIVORA</p>
      <p class="slogan">${esc(S.slogan)}</p>
      <p class="site-foot__offer">${esc(S.descriptor)} · ${esc(S.offer)}</p>
    </div>
    <nav aria-label="${esc(S.footerNavLabel)}"><p class="site-foot__h">${esc(S.footerNavLabel)}</p><ul>${nav}</ul></nav>
    <div><p class="site-foot__h">${esc(S.footerContactLabel)}</p><ul><li><a href="mailto:${S.email}">${S.email}</a></li><li>${esc(S.city)}, ${esc(S.region)}</li><li class="site-foot__muted">${esc(S.socialPlaceholder)}</li></ul></div>
    <nav aria-label="${esc(S.footerLegalLabel)}"><p class="site-foot__h">${esc(S.footerLegalLabel)}</p><ul><li><a href="${R}impressum/">Impressum</a></li><li><a href="${R}datenschutz/">Datenschutz</a></li><li><a href="${R}bildnachweise/">Bildnachweise</a></li></ul></nav>
  </div>
  <p class="site-foot__note">${esc(S.demoNote)} · <a href="https://armsin.de/">Webdesign aus Freiberg: armsin.de</a></p>
</footer>
${sticky ? `<aside class="sticky-cta" aria-label="Schnellkontakt" data-sticky-cta><a class="btn btn--primary" href="${R}kontakt/">${esc(S.cta)}</a></aside>` : ""}`;
}

function crumbsNav(crumbs) {
  return `<nav class="crumbs" aria-label="${esc(S.breadcrumbLabel)}"><ol>${crumbs.map((c, i) => i === crumbs.length - 1
    ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
    : `<li><a href="${R}${c.path}">${esc(c.name)}</a></li>`).join("")}</ol></nav>`;
}

function ctaBlock(h2, text, id = "cta") {
  return `<section class="cta-block" aria-labelledby="${id}">
  <h2 id="${id}" class="h2">${hd(h2)}</h2>
  <p class="lead">${esc(text)}</p>
  <a class="btn btn--primary" href="${R}kontakt/">${esc(S.cta)}</a>
</section>`;
}

function page(key, seo, body, { active, sticky = true, bodyClass = "", extraHead = "" } = {}) {
  return `${head(key, seo, extraHead)}
<body class="${[bodyClass, sticky ? "has-sticky" : ""].filter(Boolean).join(" ")}">
${header(active)}
<main id="inhalt" tabindex="-1">
${body}
</main>
${footer({ sticky })}
<div class="grain" aria-hidden="true"></div>
</body>
</html>
`;
}

// ---------------------------------------------------------------- shared pieces
function serviceVisual(item) {
  if (item.key === "strategie") return `<div class="svc-vis svc-vis--plan" aria-hidden="true">${item.visual.map(v => `<span>${esc(v)}</span>`).join('<i></i>')}</div>`;
  if (item.key === "content") return `<div class="svc-vis svc-vis--phones" aria-hidden="true">${["reel-cafe-latte-art", "reel-lichtkurven", "reel-haende-smartphone"].map((n, i) => `<span class="mini-phone">${pic(n, { sizes: "90px" })}<b>${esc(item.visual[i])}</b></span>`).join("")}</div>`;
  return `<div class="svc-vis svc-vis--growth" aria-hidden="true"><svg viewBox="0 0 240 110" focusable="false"><path class="svc-vis__grid" d="M0 100H240M0 66H240M0 33H240"/><path class="svc-vis__line" d="M6 92C40 88 58 74 82 70S124 64 148 46 196 22 234 12"/><circle cx="82" cy="70" r="4"/><circle cx="148" cy="46" r="4"/><circle cx="234" cy="12" r="5" class="svc-vis__end"/></svg><span>${item.visual.map(esc).join("</span><span>")}</span></div>`;
}

function formatTile(f, mock) {
  let screen = "";
  if (f.key === "reel") screen = `${pic(f.image, { sizes: "260px" })}<span class="ph-ui ph-ui--reel"><i class="ph-play"></i><i class="ph-bar"><i></i></i></span>`;
  if (f.key === "karussell") screen = `${pic(f.image, { sizes: "260px" })}<span class="ph-ui ph-ui--cover"><b>${esc(mock.carouselCover)}</b><i class="ph-dots"><i></i><i></i><i></i><i></i><i></i></i></span>`;
  if (f.key === "story") screen = `${pic(f.image, { sizes: "260px" })}<span class="ph-ui ph-ui--story"><i class="ph-segs"><i></i><i></i><i></i></i><span class="ph-poll"><b>${esc(mock.storyPoll)}</b><span>${esc(mock.pollA)}</span><span>${esc(mock.pollB)}</span></span></span>`;
  if (f.key === "markenauftritt") screen = `<span class="ph-ui ph-ui--brand"><img src="${R}assets/img/ko-symbol-color.svg" width="64" height="64" alt="" loading="lazy"><span class="ph-swatches"><i></i><i></i><i></i><i></i><i></i></span><b>${esc(mock.brandLine)}</b><span class="ph-type">Aa</span></span>`;
  return `<li class="format" data-tile>
  <div class="phone" aria-hidden="true"><div class="phone__screen">${screen}</div><img class="phone__frame" src="${R}assets/img/phone-frame.svg" width="400" height="820" alt="" loading="lazy"></div>
  <div class="format__text"><span class="format__icon" data-icon>${svgImg("icon-" + f.key)}</span><h3 class="h3">${esc(shy(f.title))}</h3><p>${esc(f.text)}</p></div>
</li>`;
}

function wallCard(w, i) {
  const c = concept(w.concept);
  const media = w.type === "text"
    ? `${pic(w.image, { sizes: "(max-width: 767px) 44vw, 18vw" })}<span class="reel__cover">${esc(w.line)}</span>`
    : pic(w.image, { sizes: "(max-width: 767px) 44vw, 18vw", alt: w.alt });
  return `<li class="reel" data-cat="${c.category}" data-card style="--i:${i};--col:${i % 4}">
  <a class="reel__link" href="${R}arbeiten/${c.slug}/">
    <span class="reel__media">${media}</span>
    <span class="badge">${esc(C.case.label)}</span>
    <span class="reel__meta"><span class="reel__format">${esc(w.format)}</span><span class="reel__brand">${esc(c.name)}</span>${w.type === "text" ? "" : `<span class="reel__line">${esc(w.line)}</span>`}</span>
  </a>
</li>`;
}

function chips(id) {
  const W = C.start.work;
  return `<div class="chips" role="group" aria-label="${esc(W.filterLabel)}" data-filter="${id}" hidden>
  <button type="button" class="chip" aria-pressed="true" data-chip="all">${esc(W.filterAll)}</button>
  ${C.categories.map(c => `<button type="button" class="chip" aria-pressed="false" data-chip="${c.key}">${esc(c.label)}</button>`).join("")}
</div>
<p class="filter-status visually-hidden" aria-live="polite" data-filter-status data-tpl="${esc(W.filterStatus)}" data-tpl-one="${esc(W.filterStatusOne)}"></p>`;
}

function conceptCard(c, headingLevel = 3) {
  return `<li class="concept" data-cat="${c.category}">
  <a class="concept__link" href="${R}arbeiten/${c.slug}/">
    <span class="concept__media">${pic(c.image, { sizes: "(max-width: 767px) 92vw, (max-width: 1199px) 45vw, 30vw", alt: c.alt })}<span class="badge">${esc(C.case.label)}</span></span>
    <span class="concept__cat">${esc(c.categoryLabel)}</span>
    <h${headingLevel} class="h3 concept__name">${esc(c.name)}</h${headingLevel}>
    <span class="concept__idea">„${esc(c.idea)}“ · ${esc(c.teaser)}</span>
  </a>
</li>`;
}

// ---------------------------------------------------------------- pages
function startPage() {
  const H = C.start.hero, Sv = C.start.services, P = C.start.process, W = C.start.work, F = C.start.founding, Fm = C.start.formats, Q = C.start.faq, E = C.start.ending;
  const L = A.lens;
  const heroImg = A["ko-3d-symbol"];
  const preload = `<link rel="preload" as="image" type="image/avif" imagesrcset="${heroImg.w.map(w => `assets/img/ko-3d-symbol-${w}.avif ${w}w`).join(", ")}" imagesizes="(max-width: 767px) 82vw, 44vw" fetchpriority="high">\n`;
  const body = `
<section class="hero" data-act="hero" data-sc-act="scrub" aria-labelledby="hero-title">
  <div class="hero__glow" aria-hidden="true" data-plane="glow"></div>
  <div class="hero__stage">
    <div class="hero__symbol" data-plane="symbol" style="--lens-x:${L.cx}%;--lens-y:${L.cy}%;--lens-d:${L.d}%">
      <div class="hero__lens" data-plane="lens">
        <img class="hero__video" src="${R}assets/img/o-linse-poster-480.webp" srcset="${R}assets/img/o-linse-poster-480.webp 480w, ${R}assets/img/o-linse-poster-720.webp 720w" sizes="(max-width: 767px) 32vw, 18vw" width="720" height="720" alt="${esc(H.videoLabel)}" fetchpriority="low" data-video data-webm="${R}assets/video/o-linse-stadt-filmen.webm" data-mp4="${R}assets/video/o-linse-stadt-filmen.mp4">
        <span class="hero__rec" aria-hidden="true"></span>
      </div>
      ${pic("ko-3d-symbol", { cls: "hero__ko", sizes: "(max-width: 767px) 82vw, 44vw", eager: true, priority: true })}
      ${H.cursors.map((c, i) => `<span class="cursor cursor--${i + 1}" aria-hidden="true" data-cursor="${i}">${esc(c)}</span>`).join("")}
    </div>
    <div class="hero__text" data-plane="text">
      <h1 id="hero-title" class="hero__h1"><span class="hero__label">${esc(shy(H.label))}</span><span class="visually-hidden"> · </span><span class="hero__title">${hd(H.title)}</span></h1>
      <a class="btn btn--primary btn--large" href="${R}kontakt/" data-hero-cta>${esc(S.cta)}</a>
    </div>
  </div>
  <picture class="hero__fg" aria-hidden="true" data-plane="fg"><source media="(max-width: 767px)" type="image/avif" srcset="${R}assets/img/hero-licht-vorn-mobil-720.avif 720w, ${R}assets/img/hero-licht-vorn-mobil-1080.avif 1080w" sizes="100vw"><source media="(max-width: 767px)" type="image/webp" srcset="${R}assets/img/hero-licht-vorn-mobil-720.webp 720w, ${R}assets/img/hero-licht-vorn-mobil-1080.webp 1080w" sizes="100vw"><source type="image/avif" srcset="${R}assets/img/hero-licht-vorn-1600.avif 1600w, ${R}assets/img/hero-licht-vorn-2400.avif 2400w" sizes="100vw"><img src="${R}assets/img/hero-licht-vorn-1600.webp" width="2400" height="1350" alt="" decoding="async" fetchpriority="low"></picture>
  <button class="media-toggle hero__toggle" type="button" aria-pressed="false" data-video-toggle data-label-pause="${esc(S.videoPause)}" data-label-play="${esc(S.videoPlay)}" hidden>${esc(S.videoPause)}</button>
</section>

<section class="act services" data-act="stack" data-sc-act="pin" id="was-wir-tun" aria-labelledby="services-title">
  <div class="act__stage services__stage">
    <div class="services__head">
      <h2 id="services-title" class="h2">${hd(Sv.h2)}</h2>
      <p class="lead">${esc(Sv.intro)}</p>
      <div class="answer"><h3 class="answer__h">${esc(C.start.about.h3)}</h3><p>${esc(C.start.about.text)}</p></div>
      <a class="link-arrow" href="${R}leistungen/">${esc(Sv.link)}</a>
    </div>
    <ol class="services__cards">
      ${Sv.items.map((it, i) => `<li class="svc-card svc-card--${it.key}" data-card style="--i:${i}">${serviceVisual(it)}<h3 class="h3">${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`).join("\n      ")}
    </ol>
  </div>
</section>

<section class="act process" data-act="steps" data-sc-act="pin" aria-labelledby="process-title">
  <div class="act__stage process__stage">
    <div class="process__num" aria-hidden="true"><span class="process__window"><span class="process__roll" data-roll>${P.steps.map((s, i) => `<span>0${i + 1}</span>`).join("")}</span></span><span class="dot">.</span></div>
    <div class="process__body">
      <h2 id="process-title" class="h2">${hd(P.h2)}</h2>
      <div class="process__list">
        <span class="process__track" aria-hidden="true"><span class="process__fill" data-fill></span></span>
        <ol class="steps">${P.steps.map((s, i) => `<li class="step" data-step="${i}"><span class="step__n" aria-hidden="true">0${i + 1}</span><h3 class="h3">${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("")}</ol>
      </div>
    </div>
  </div>
</section>

<section class="act work" data-act="burst" data-sc-act="pin" id="arbeiten-start" aria-labelledby="work-title">
  <div class="act__stage work__stage">
    <div class="work__head">
      <h2 id="work-title" class="h2">${hd(W.h2)}</h2>
      <p class="lead">${esc(W.intro)}</p>
      ${chips("wall")}
      <a class="link-arrow" href="${R}arbeiten/">${esc(W.all)}</a>
    </div>
    <div class="work__launcher" aria-hidden="true" data-launcher>${pic("ko-ring-portal", { sizes: "160px" })}</div>
    <ul class="wall" data-wall>
      ${C.wall.map(wallCard).join("\n      ")}
    </ul>
  </div>
</section>

<section class="act founding" data-act="portal" data-sc-act="pin" aria-labelledby="founding-title">
  <div class="founding__stage" data-portal-stage>
    <div class="founding__inner">
      <div class="founding__text">
        <p class="eyebrow">${esc(shy(F.label))}</p>
        <h2 id="founding-title" class="h2">${hd(F.h2)}</h2>
        <p class="lead">${esc(F.text)}</p>
        <ul class="ticks">${F.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        <a class="btn btn--primary" href="${R}kontakt/">${esc(S.cta)}</a>
      </div>
      ${pic("ko-3d-symbol-schraeg", { cls: "founding__ko", sizes: "(max-width: 767px) 70vw, 34vw" })}
    </div>
  </div>
  <span class="portal-ring" aria-hidden="true" data-portal-ring></span>
</section>

<section class="act formats" data-act="gallery" data-sc-act="pan" aria-labelledby="formats-title">
  <div class="act__stage formats__stage">
    <div class="formats__head">
      <h2 id="formats-title" class="h2">${hd(Fm.h2)}</h2>
      <p class="lead">${esc(Fm.intro)}</p>
      <a class="btn btn--primary" href="${R}kontakt/">${esc(S.cta)}</a>
    </div>
    <div class="formats__viewport" tabindex="0" role="region" aria-label="Formate, seitlich scrollbar" data-gallery-viewport>
      <ul class="formats__row" data-row>
        ${Fm.items.map(f => formatTile(f, Fm.mock)).join("\n        ")}
      </ul>
    </div>
  </div>
</section>

<section class="faq" data-sc-act="flow" aria-labelledby="faq-title">
  <div class="faq__inner">
    <h2 id="faq-title" class="h2">${hd(Q.h2)}</h2>
    <div class="faq__list">
      ${Q.items.map(f => `<details class="qa"><summary><h3 class="qa__q">${esc(f.q)}</h3><span class="qa__icon" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join("\n      ")}
    </div>
    <p class="faq__more"><a class="link-arrow" href="${R}kontakt/">${esc(Q.more)}</a></p>
  </div>
</section>

<section class="ending" data-sc-act="flow" aria-labelledby="ending-title" data-ending>
  ${pic("licht-textur-ende", { cls: "ending__bg", sizes: "100vw" })}
  <div class="ending__inner">
    <h2 id="ending-title" class="h2">${hd(E.h2)}</h2>
    <p class="lead">${esc(E.text)}</p>
    <a class="btn btn--primary btn--large" href="${R}kontakt/" data-ending-cta>${esc(S.cta)}</a>
  </div>
  <p class="ending__word" aria-hidden="true">KIVORA</p>
  <div class="marquee" data-marquee>
    <a class="marquee__link" href="${R}kontakt/"><span class="marquee__track"><span>${esc(E.marquee)} →</span>${Array.from({ length: 5 }, () => `<span aria-hidden="true">${esc(E.marquee)} →</span>`).join("")}</span></a>
  </div>
</section>`;
  return page("start", C.seo.start, body, { active: "", bodyClass: "page-start", extraHead: preload });
}

function leistungenPage() {
  const L = C.leistungen, seo = { ...C.seo.leistungen, crumbs: [{ name: "Startseite", path: "" }, { name: "Leistungen", path: "leistungen/" }] };
  const body = `
<div class="page-head">
  ${crumbsNav(seo.crumbs)}
  <h1 class="h1">${hd(seo.h1)}</h1>
  <p class="lead">${esc(L.intro)}</p>
</div>
<div class="svc-list">
${L.services.map((s, i) => {
  const item = C.start.services.items.find(x => x.key === s.key), c = concept(s.concept);
  return `<section class="svc" id="${s.key}" aria-labelledby="svc-${s.key}">
  <div class="svc__text">
    <span class="svc__n" aria-hidden="true">0${i + 1}</span>
    <h2 id="svc-${s.key}" class="h2">${esc(s.title)}</h2>
    <p class="lead">${esc(s.lead)}</p>
    <ul class="ticks">${s.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
    <a class="link-arrow" href="${R}arbeiten/${c.slug}/">${esc(L.conceptLink)}: ${esc(c.name)}</a>
  </div>
  <div class="svc__vis svc-card svc-card--${s.key}">${serviceVisual(item)}</div>
</section>`;
}).join("\n")}
</div>
<section class="band" aria-labelledby="ablauf">
  <h2 id="ablauf" class="h2">${hd(C.start.process.h2)}</h2>
  <ol class="steps steps--grid">${C.start.process.steps.map((s, i) => `<li class="step"><span class="step__n" aria-hidden="true">0${i + 1}</span><h3 class="h3">${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("")}</ol>
</section>
<section class="band" aria-labelledby="formate">
  <h2 id="formate" class="h2">${hd(L.formatsH2)}</h2>
  <ul class="format-icons">${C.start.formats.items.map(f => `<li>${svgImg("icon-" + f.key, "", "", 32, 32)}<h3 class="h3">${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join("")}</ul>
</section>
${ctaBlock(C.start.ending.h2, C.start.ending.text)}`;
  return page("leistungen", seo, body, { active: "leistungen" });
}

function arbeitenPage() {
  const seo = { ...C.seo.arbeiten, crumbs: [{ name: "Startseite", path: "" }, { name: "Arbeiten", path: "arbeiten/" }] };
  const body = `
<div class="page-head">
  ${crumbsNav(seo.crumbs)}
  <h1 class="h1">${hd(seo.h1)}</h1>
  <p class="lead">${esc(C.arbeiten.intro)}</p>
  ${chips("grid")}
</div>
<ul class="concepts" data-filter-target="grid">
${C.concepts.map(c => conceptCard(c, 2)).join("\n")}
</ul>
${ctaBlock(C.case.ctaH2, C.case.ctaText)}`;
  return page("arbeiten", seo, body, { active: "arbeiten" });
}

function casePage(c, i) {
  const K = C.case, next = C.concepts[(i + 1) % C.concepts.length];
  const svc = C.leistungen.services.find(s => s.key === c.service);
  const crumbs = [{ name: "Startseite", path: "" }, { name: "Arbeiten", path: "arbeiten/" }, { name: c.name, path: `arbeiten/${c.slug}/` }];
  const seo = { path: `arbeiten/${c.slug}/`, title: c.seoTitle, description: c.seoDescription, h1: `${c.name}: ${c.idea}`, index: true, crumbs };
  const wallImgs = C.wall.filter(w => w.concept === c.slug);
  const body = `
<article class="case">
  <header class="case__head">
    <div class="case__intro">
      ${crumbsNav(crumbs)}
      <p class="case__labels"><span class="badge badge--static">${esc(K.label)}</span><span class="case__cat">${esc(c.categoryLabel)}</span></p>
      <h1 class="h1 case__h1">${esc(c.name)}: <span class="case__idea">${esc(c.idea)}</span></h1>
      <p class="lead">${esc(c.teaser)}</p>
      <p class="case__note">${esc(K.note)}</p>
    </div>
    ${pic(c.image, { cls: "case__visual", sizes: "(max-width: 767px) 92vw, 42vw", alt: c.alt, eager: true, priority: true })}
  </header>
  <div class="case__body">
    <section aria-labelledby="h-challenge"><h2 id="h-challenge" class="h2 h2--s">${esc(K.challenge)}</h2><p class="lead">${esc(c.challenge)}</p></section>
    <section aria-labelledby="h-idea"><h2 id="h-idea" class="h2 h2--s">${esc(K.idea)}</h2><p class="lead">${esc(c.ideaText)}</p></section>
  </div>
  <section class="case__formats" aria-labelledby="h-formats">
    <h2 id="h-formats" class="h2 h2--s">${esc(K.formats)}</h2>
    <ol class="case-formats">${c.formats.map((f, j) => {
      const w = wallImgs[j % Math.max(wallImgs.length, 1)];
      return `<li class="case-format"><div class="phone phone--small" aria-hidden="true"><div class="phone__screen">${w ? pic(w.image, { sizes: "200px" }) : ""}<span class="badge">${esc(K.label)}</span></div><img class="phone__frame" src="${R}assets/img/phone-frame.svg" width="400" height="820" alt="" loading="lazy"></div><h3 class="h3">${esc(f.type)}</h3><p>${esc(f.text)}</p></li>`;
    }).join("")}</ol>
  </section>
  <section class="case__kpi" aria-labelledby="h-kpi">
    <h2 id="h-kpi" class="h2 h2--s">${esc(K.kpis)}</h2>
    <p class="kpi"><span class="kpi__value">${esc(c.kpi.value)}</span><span class="kpi__label">${esc(c.kpi.label)}</span></p>
    <p class="case__note">${esc(K.kpiNote)}</p>
  </section>
  <nav class="case__links" aria-label="${esc(K.service)} und ${esc(K.next)}">
    <a class="case__link" href="${R}${svcPath[c.service]}"><span>${esc(K.service)}</span><b>${esc(svc.title)}</b></a>
    <a class="case__link" href="${R}arbeiten/${next.slug}/"><span>${esc(K.next)}</span><b>${esc(next.name)}</b></a>
    <a class="case__link" href="${R}arbeiten/"><span>${esc(K.label)}e</span><b>${esc(K.back)}</b></a>
  </nav>
</article>
${ctaBlock(K.ctaH2, K.ctaText)}`;
  return page("case", seo, body, { active: "arbeiten", extraHead: "" });
}

function ueberUnsPage() {
  const U = C.ueberUns, seo = { ...C.seo["ueber-uns"], crumbs: [{ name: "Startseite", path: "" }, { name: "Über uns", path: "ueber-uns/" }] };
  const F = C.start.founding;
  const body = `
<div class="page-head">
  ${crumbsNav(seo.crumbs)}
  <h1 class="h1">${hd(seo.h1)}</h1>
  <p class="lead">${esc(U.intro)}</p>
</div>
<section class="band band--split" aria-labelledby="was-ist">
  <h2 id="was-ist" class="h2 h2--s">${esc(C.start.about.h3)}</h2>
  <p class="lead">${esc(C.start.about.text)}</p>
</section>
<section class="band band--split" aria-labelledby="story">
  <h2 id="story" class="h2 h2--s">${esc(U.storyH2)}</h2>
  <p class="placeholder">${esc(U.storyPlaceholder)}</p>
</section>
<section class="band" aria-labelledby="team">
  <h2 id="team" class="h2">${hd(U.teamH2)}</h2>
  <p class="lead">${esc(U.teamNote)}</p>
  <ul class="team">${U.team.map(t => `<li class="person"><span class="person__portrait" aria-hidden="true"><span>${esc(t.initials)}</span></span><h3 class="h3">${esc(t.name)}</h3><p>${esc(t.role)}</p></li>`).join("")}</ul>
</section>
<section class="band" aria-labelledby="werte">
  <h2 id="werte" class="h2">${hd(U.valuesH2)}</h2>
  <ul class="values">${U.values.map(v => `<li><h3 class="h3">${hd(v.title)}</h3><p>${esc(v.text)}</p></li>`).join("")}</ul>
</section>
<section class="band band--glow" aria-labelledby="gruendung">
  <p class="eyebrow">${esc(F.label)}</p>
  <h2 id="gruendung" class="h2">${hd(F.h2)}</h2>
  <p class="lead">${esc(F.text)}</p>
  <ul class="ticks">${F.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
  <a class="btn btn--primary" href="${R}kontakt/">${esc(S.cta)}</a>
</section>`;
  return page("ueber-uns", seo, body, { active: "ueber-uns" });
}

function kontaktPage() {
  const K = C.kontakt, seo = { ...C.seo.kontakt, crumbs: [{ name: "Startseite", path: "" }, { name: "Kontakt", path: "kontakt/" }] };
  const f = K.fields, e = K.errors;
  const field = (id, label, input, { req = true, hint = "" } = {}) => `<div class="field" data-field="${id}">
        <label for="f-${id}">${esc(label)}${req ? ` <span class="req">(${esc(K.required)})</span>` : ` <span class="opt">(${esc(K.optional)})</span>`}</label>
        ${input}
        <p class="field__error" id="e-${id}" data-error hidden></p>
      </div>`;
  const body = `
<div class="contact">
  <div class="contact__aside">
    ${crumbsNav(seo.crumbs)}
    <h1 class="h1">${hd(seo.h1)}</h1>
    <p class="lead">${esc(K.intro)}</p>
    <p class="contact__direct">${esc(K.direct)} <a href="mailto:${S.email}">${S.email}</a></p>
    <h2 class="h2 h2--s">${esc(K.asideH2)}</h2>
    <ol class="mini-steps">${K.asideSteps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
  </div>
  <div class="contact__main">
    <!--
      BOOKING-PLATZHALTER (später): Hier kommt die Terminbuchung hin, z. B. Cal.com oder Calendly.
      So ersetzen: den eingebetteten Code des Anbieters (Inline-Embed) an dieser Stelle einfügen,
      Skript selbst hosten oder in der Datenschutzerklärung nennen und einen Cookie-Hinweis prüfen.
      Bis dahin bewusst kein Kalender, keine Zeitfenster, keine .ics-Dateien.
    -->
    <form class="form" action="mailto:${S.email}" method="post" enctype="text/plain" novalidate data-form aria-labelledby="form-title">
      <h2 id="form-title" class="h2 h2--s">${esc(K.formH2)}</h2>
      <div class="form__summary" role="alert" data-summary hidden></div>
      ${field("name", f.name, `<input id="f-name" name="Name" type="text" autocomplete="name" required aria-describedby="e-name">`)}
      ${field("email", f.email, `<input id="f-email" name="E-Mail" type="email" autocomplete="email" inputmode="email" required placeholder="${esc(K.placeholders.email)}" aria-describedby="e-email">`)}
      ${field("company", f.company, `<input id="f-company" name="Unternehmen" type="text" autocomplete="organization" required aria-describedby="e-company">`)}
      ${field("website", f.website, `<input id="f-website" name="Website oder Instagram" type="text" autocomplete="url" placeholder="${esc(K.placeholders.website)}" aria-describedby="e-website">`, { req: false })}
      <fieldset class="field field--chips" data-field="topics" aria-describedby="e-topics">
        <legend>${esc(f.topics)} <span class="req">(${esc(K.required)})</span></legend>
        <div class="chip-set">${K.topics.map((t, i) => `<label class="chip chip--check"><input type="checkbox" name="Thema" value="${esc(t)}" data-topic${i === 0 ? ' id="f-topics"' : ""}><span>${esc(t)}</span></label>`).join("")}</div>
        <p class="field__error" id="e-topics" data-error hidden></p>
      </fieldset>
      ${field("message", f.message, `<textarea id="f-message" name="Nachricht" rows="6" required minlength="20" placeholder="${esc(K.placeholders.message)}" aria-describedby="e-message"></textarea>`)}
      <div class="field field--consent" data-field="consent">
        <label class="check"><input id="f-consent" type="checkbox" name="Einwilligung" value="ja" required aria-describedby="e-consent"><span>${esc(f.consent)} <a href="${R}datenschutz/">${esc(f.consentLink)}</a></span></label>
        <p class="field__error" id="e-consent" data-error hidden></p>
      </div>
      <button class="btn btn--primary btn--large" type="submit">${esc(K.submit)}</button>
      <noscript><p class="form__nojs">${esc(K.noJs)} <a href="mailto:${S.email}">${S.email}</a></p></noscript>
    </form>
    <div class="form-success" role="status" aria-live="polite" data-success hidden tabindex="-1">
      <p class="form-success__title">${hd(K.success)}</p>
      <p class="form-success__demo">${esc(K.demo)}</p>
      <button class="btn btn--secondary" type="button" data-again>${esc(K.again)}</button>
    </div>
    <div hidden data-messages ${Object.entries(e).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}></div>
  </div>
</div>`;
  return page("kontakt", seo, body, { active: "kontakt", sticky: false, bodyClass: "page-contact" });
}

function legalPage(key, inner) {
  const seo = { ...C.seo[key], crumbs: [{ name: "Startseite", path: "" }, { name: C.seo[key].h1, path: C.seo[key].path }] };
  return page(key, seo, `<div class="page-head page-head--legal">${crumbsNav(seo.crumbs)}<h1 class="h1">${esc(seo.h1)}</h1></div><div class="prose">${inner}</div>`);
}

function notFoundPage() {
  R = "";
  const seo = C.seo["404"];
  const body = `
<section class="nf" aria-labelledby="nf-title">
  <span class="nf__o" aria-hidden="true"><span></span></span>
  <h1 id="nf-title" class="h1">${hd(seo.h1)}</h1>
  <p class="lead">${esc(C.notFound.text)}</p>
  <ul class="nf__links"><li><a href="">Startseite</a></li><li><a href="arbeiten/">Arbeiten</a></li><li><a href="kontakt/">${esc(S.cta)}</a></li></ul>
  <a class="btn btn--primary" href="">${esc(C.notFound.home)}</a>
</section>`;
  return page("404", seo, body);
}

// ---------------------------------------------------------------- write
function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(WEB, "static"), OUT);
const depth = p => p.split("/").filter(Boolean).length;
const at = p => { R = "../".repeat(depth(p)); };

at(""); write("index.html", startPage());
at("leistungen/"); write("leistungen/index.html", leistungenPage());
at("arbeiten/"); write("arbeiten/index.html", arbeitenPage());
C.concepts.forEach((c, i) => { at(`arbeiten/${c.slug}/`); write(`arbeiten/${c.slug}/index.html`, casePage(c, i)); });
at("ueber-uns/"); write("ueber-uns/index.html", ueberUnsPage());
at("kontakt/"); write("kontakt/index.html", kontaktPage());
at("impressum/"); write("impressum/index.html", legalPage("impressum", `<p class="placeholder">${esc(C.legal.placeholder)}</p>${C.legal.impressum.map(l => `<p>${esc(l)}</p>`).join("")}`));
at("datenschutz/"); write("datenschutz/index.html", legalPage("datenschutz", `<p class="placeholder">${esc(C.legal.placeholder)}</p>${C.legal.datenschutz.map(s => `<h2 class="h2 h2--s">${esc(s.h2)}</h2><p>${esc(s.p)}</p>`).join("")}`));
at("bildnachweise/"); {
  const B = C.bildnachweise;
  write("bildnachweise/index.html", legalPage("bildnachweise", `<p class="lead">${esc(B.intro)}</p>
<h2 class="h2 h2--s">${esc(B.photosH2)}</h2>
<ul class="credits">${B.credits.map(c => `<li><b>${esc(c.what)}</b><span>${esc(c.author)} · ${esc(c.source)} · ${esc(c.license)}</span><a href="${c.url}" rel="noopener">${esc(c.source)}-Seite öffnen<span class="visually-hidden">: ${esc(c.what)}</span></a></li>`).join("")}</ul>
<p>${B.licenseLinks.map(l => `<a href="${l.url}" rel="noopener">${esc(l.label)}</a>`).join(" · ")}</p>
<h2 class="h2 h2--s">${esc(B.madeH2)}</h2>
<ul class="ticks">${B.made.map(m => `<li>${esc(m)}</li>`).join("")}</ul>`));
}
write("404.html", notFoundPage());

// robots, sitemap, manifest, llms.txt
const indexable = [C.seo.start, C.seo.leistungen, C.seo.arbeiten, ...C.concepts.map(c => ({ path: `arbeiten/${c.slug}/` })), C.seo["ueber-uns"], C.seo.kontakt];
write("robots.txt", LAUNCH ? `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n` : `# Demo-Website (Konzept von Armsin): nicht indexieren.\nUser-agent: *\nDisallow: /\n`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${indexable.map(p => `  <url><loc>${BASE}/${p.path}</loc><xhtml:link rel="alternate" hreflang="de" href="${BASE}/${p.path}"/><xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/${p.path}"/></url>`).join("\n")}\n</urlset>\n`);
write("site.webmanifest", JSON.stringify({ name: "KIVORA · Marketingagentur in Dresden", short_name: "KIVORA", lang: "de", start_url: "./", display: "browser", background_color: "#05070F", theme_color: "#05070F", icons: [{ src: "assets/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "assets/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "assets/favicon.svg", sizes: "any", type: "image/svg+xml" }] }, null, 1));
write("llms.txt", `# KIVORA\n\n> ${C.start.about.text}\n\n${indexable.map(p => `- ${BASE}/${p.path}`).join("\n")}\n`);
console.log(`built ${LAUNCH ? "launch" : "demo"} -> ${path.relative(WEB, OUT)}`);
