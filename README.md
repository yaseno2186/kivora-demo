# KIVORA, concept website by Armsin

This is a **concept website** made by Armsin as a free showcase for KIVORA, a marketing agency in Dresden. It is not KIVORA's official website. All work shown is labelled "Konzeptprojekt" (fictional brands); no clients, reviews or figures are real. The site is set to `noindex` and `robots.txt` disallows crawling. The contact form is a demo and sends nothing.

Live demo (GitHub Pages): https://yaseno2186.github.io/kivora-demo/

## What is in this repository
- The built site at the repository root (plain HTML, CSS and JavaScript, no build step to view it).
- `source/`: the generator and assets used to build it.
  - `source/content/de.json`: all visible German copy.
  - `source/tools/build.mjs`: writes the pages from the content file (`node tools/build.mjs`, or `--launch` for an indexable build on the real domain, `--root=/kivora-demo/` for this Pages folder).
  - `source/static/`: CSS (one entry file on brand tokens), JS modules, fonts (Cal Sans + Inter, SIL OFL), optimised images and video.
  - `source/tools/verify/`: the verification scripts used before delivery.

## Run locally
```bash
cd source
node tools/build.mjs --root=/
node tools/serve.mjs dist 4600
```
Open http://127.0.0.1:4600/ (ES modules need a local server; without JavaScript all content is still readable).

## Booking later
The Kontakt page has a commented placeholder (`BOOKING-PLATZHALTER` in `source/tools/build.mjs`, function `kontaktPage()`) for a Cal.com or Calendly embed.

## Credits
Photos: Unsplash (Unsplash License), video: Pexels (Pexels License); full list on the page `/bildnachweise/`. 3D renders, logo variants, icons and grading made in-house. Fonts: Cal Sans and Inter, SIL Open Font License.
