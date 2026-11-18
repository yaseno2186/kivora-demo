// Minimal local server for the built site: node tools/serve.mjs [dist|dist-launch] [port]
// Binds to 127.0.0.1 only. Serves index.html for folders and 404.html (status 404) for unknown paths.
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(WEB, process.argv[2] || "dist");
const PORT = Number(process.argv[3] || 4600);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }).end(); return; }
    file = path.join(file, "index.html");
  }
  let status = 200;
  if (!fs.existsSync(file)) { status = 404; file = path.join(ROOT, "404.html"); }
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const stat = fs.statSync(file);
  const range = req.headers.range;
  const cache = /\.(avif|webp|png|jpg|woff2|mp4|webm|svg)$/.test(file) ? "public, max-age=31536000" : "no-cache";
  if (range && status === 200) {
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = Number(s), end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": cache });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  // gzip text like a production host (GitHub Pages, Netlify) would
  if (/^(text\/|application\/(json|xml|manifest))|image\/svg/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
    const gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 });
    res.writeHead(status, { "Content-Type": type, "Content-Encoding": "gzip", "Content-Length": gz.length, "Vary": "Accept-Encoding", "Cache-Control": cache });
    res.end(gz);
    return;
  }
  res.writeHead(status, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`KIVORA: http://127.0.0.1:${PORT}/  (root ${path.relative(WEB, ROOT)})`));
