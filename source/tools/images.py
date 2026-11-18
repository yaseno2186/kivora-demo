"""KIVORA asset pipeline: masters (assets-src) -> optimized delivery files (web/static/assets).
Run: python web/tools/images.py
Writes AVIF + WebP at several widths, favicons, OG image, video copies and assets.json
(intrinsic sizes + hero O-lens geometry) that the HTML generator reads.
"""
import json, math, os, shutil
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
PROJ = os.path.dirname(WEB)
SRC = os.path.join(PROJ, "assets-src")
OUT = os.path.join(WEB, "static", "assets")
IMG = os.path.join(OUT, "img")
os.makedirs(IMG, exist_ok=True)
manifest = {}


def save_variants(im, name, widths, q_avif=52, q_webp=74, alpha=False):
    """Save AVIF + WebP at each width (never upscale). Records sizes in manifest."""
    entry = {"w": [], "ratio": im.height / im.width}
    for w in widths:
        if w > im.width:
            w = im.width
        h = round(w * im.height / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        if not alpha:
            r = r.convert("RGB")
        r.save(os.path.join(IMG, f"{name}-{w}.avif"), quality=q_avif, speed=4)
        r.save(os.path.join(IMG, f"{name}-{w}.webp"), quality=q_webp, method=6)
        if w not in entry["w"]:
            entry["w"].append(w)
    entry["h_at_max"] = round(max(entry["w"]) * entry["ratio"])
    manifest[name] = entry


def crop_ratio(im, rw, rh, fx=0.5, fy=0.5):
    """Crop to ratio rw:rh around focal point (fx, fy)."""
    W, H = im.size
    target = rw / rh
    if W / H > target:
        nw = round(H * target); x = min(max(round(W * fx - nw / 2), 0), W - nw)
        return im.crop((x, 0, x + nw, H))
    nh = round(W / target); y = min(max(round(H * fy - nh / 2), 0), H - nh)
    return im.crop((0, y, W, y + nh))


def trim(im, pad=0.02):
    bb = im.getbbox()
    p = round(max(im.size) * pad)
    bb = (max(bb[0] - p, 0), max(bb[1] - p, 0), min(bb[2] + p, im.width), min(bb[3] + p, im.height))
    return im.crop(bb), bb


R = os.path.join(SRC, "renders")
G = os.path.join(SRC, "graded")

# ---- 3D KO, hero (no dot) + lens geometry -------------------------------------------
front = Image.open(os.path.join(R, "ko3d-front-nodot.png")).convert("RGBA")
front_c, bb = trim(front)
pxm = 2000 / 11.5                      # ortho_scale 11.5 over 2000 px
cx, cy = 1000 + 2.0 * pxm, 1000        # O centre: svg (80,60) -> blender x=2.0
r_in = 2.0 * pxm                       # inner radius 20 svg units = 2.0 m
manifest["lens"] = {
    "cx": round((cx - bb[0]) / front_c.width * 100, 3),
    "cy": round((cy - bb[1]) / front_c.height * 100, 3),
    "d": round(2 * r_in / front_c.width * 100, 3),
}
save_variants(front_c, "ko-3d-symbol", [640, 1000, 1600], alpha=True)

angle, _ = trim(Image.open(os.path.join(R, "ko3d-angle.png")).convert("RGBA"))
save_variants(angle, "ko-3d-symbol-schraeg", [480, 800, 1200], alpha=True)
ring, _ = trim(Image.open(os.path.join(R, "ko3d-ring.png")).convert("RGBA"), pad=0.0)
save_variants(ring, "ko-ring-portal", [800, 1600], alpha=True)

# ---- hero foreground light planes ------------------------------------------------------
save_variants(Image.open(os.path.join(R, "hero-fg-desktop-soft.png")).convert("RGBA"), "hero-licht-vorn", [1600, 2400], q_webp=70, alpha=True)
save_variants(Image.open(os.path.join(R, "hero-fg-mobile-soft.png")).convert("RGBA"), "hero-licht-vorn-mobil", [720, 1080], q_webp=70, alpha=True)

# ---- lens video poster -----------------------------------------------------------------
save_variants(Image.open(os.path.join(R, "o-lens-poster.png")).convert("RGB"), "o-linse-poster", [480, 720])

# ---- photos: reel cards (9:16), key visuals (4:5), textures -----------------------------
# name in delivery (German, descriptive) : (graded master, focal x, focal y)
reels = {
    "reel-cafe-latte-art": ("food-coffee", .5, .5),
    "reel-serum-flasche": ("beauty-bottle", .5, .55),
    "reel-mode-strasse": ("fashion-walk", .5, .5),
    "reel-fahrrad-nacht": ("mobility-cyclist", .6, .5),
    "reel-fitness-hantel": ("fitness-hand", .45, .7),
    "reel-haende-smartphone": ("creator-hands", .55, .5),
    "reel-ringlicht-studio": ("studio-ringlight", .6, .5),
    "reel-hochhaus-nacht": ("city-tower-night", .5, .4),
    "reel-creator-gimbal": ("creator-gimbal", .45, .5),
    "reel-kamera-monitor": ("creator-phone", .5, .55),
    "reel-lichtlinie": ("texture-bluelight", .5, .5),
    "reel-lichtkurven": ("texture-curves", .5, .5),
}
for name, (src, fx, fy) in reels.items():
    im = crop_ratio(Image.open(os.path.join(G, src + ".jpg")).convert("RGB"), 9, 16, fx, fy)
    save_variants(im, name, [360, 540, 720], q_avif=50, q_webp=72)

keys = {
    "konzept-nordlicht-cafe": ("food-coffee", .5, .5),
    "konzept-velura-skin": ("beauty-bottle", .5, .5),
    "konzept-atelier-mira": ("fashion-walk", .5, .45),
    "konzept-kanto-bikes": ("mobility-cyclist", .6, .5),
    "konzept-studio-wellenform": ("fitness-hand", .45, .6),
}
for name, (src, fx, fy) in keys.items():
    im = crop_ratio(Image.open(os.path.join(G, src + ".jpg")).convert("RGB"), 4, 5, fx, fy)
    save_variants(im, name, [480, 800, 1200], q_avif=50, q_webp=72)

tex = Image.open(os.path.join(G, "texture-bluelight.jpg")).convert("RGB")
save_variants(crop_ratio(tex, 16, 10, .5, .45), "licht-textur-ende", [960, 1600], q_avif=45, q_webp=68)

# ---- grain ----------------------------------------------------------------------------
Image.open(os.path.join(R, "grain-tile.png")).save(os.path.join(IMG, "koernung.webp"), quality=80, method=6)

# ---- OG image ---------------------------------------------------------------------------
Image.open(os.path.join(R, "og-image.png")).convert("RGB").save(os.path.join(IMG, "og-kivora.jpg"), quality=86, optimize=True, progressive=True)

# ---- favicons from the brand geometry (no dot: below 48 px) ------------------------------
def draw_symbol(size, bg=None, pad=0.0, dot=False):
    S = size * 4
    stops = [(0, (0x1A, 0x2E, 0xFF)), (.65, (0x78, 0xA4, 0xF9)), (1, (0xFF, 0xFF, 0xFF))]
    grad = Image.new("RGB", (S, S))
    gp = grad.load()
    inner = S * (1 - 2 * pad)
    off = S * pad
    k = inner / 120
    ax, ay, bx, by = 12, 98, 112, 22
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
    for y in range(S):
        for x in range(S):
            u = ((x - off) / k - ax) * dx + ((y - off) / k - ay) * dy
            t = min(max(u / L2, 0), 1)
            for (a, ca), (b, cb) in zip(stops, stops[1:]):
                if t <= b:
                    f = (t - a) / (b - a); gp[x, y] = tuple(round(ca[i] + (cb[i] - ca[i]) * f) for i in range(3)); break
    mask = Image.new("L", (S, S), 0); d = ImageDraw.Draw(mask)
    T = lambda px, py: (off + px * k, off + py * k)
    d.rectangle([T(12, 22), T(24, 98)], fill=255)
    # chevron as polygon (stroke 12, miter)
    def offs(p, q, s):
        vx, vy = q[0] - p[0], q[1] - p[1]; l = math.hypot(vx, vy); return (-vy / l * s, vx / l * s)
    P = [(54, 24), (29, 60), (54, 96)]
    o1, o2 = offs(P[0], P[1], 6), offs(P[1], P[2], 6)
    def inter(p1, d1, p2, d2):
        den = d1[0] * d2[1] - d1[1] * d2[0]; t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        return (p1[0] + d1[0] * t, p1[1] + d1[1] * t)
    d1 = (P[1][0] - P[0][0], P[1][1] - P[0][1]); d2 = (P[2][0] - P[1][0], P[2][1] - P[1][1])
    side = lambda s: [(P[0][0] + s * o1[0], P[0][1] + s * o1[1]), inter((P[0][0] + s * o1[0], P[0][1] + s * o1[1]), d1, (P[1][0] + s * o2[0], P[1][1] + s * o2[1]), d2), (P[2][0] + s * o2[0], P[2][1] + s * o2[1])]
    d.polygon([T(*p) for p in side(1) + side(-1)[::-1]], fill=255)
    d.ellipse([T(48, 28), T(112, 92)], fill=255); d.ellipse([T(60, 40), T(100, 80)], fill=0)
    if dot:
        d.ellipse([T(74, 54), T(86, 66)], fill=255)
    out = Image.new("RGBA", (S, S), bg + (255,) if bg else (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)

BG = (0x05, 0x07, 0x0F)
draw_symbol(32, pad=0.0).save(os.path.join(OUT, "favicon-32.png"))
draw_symbol(180, bg=BG, pad=0.14).save(os.path.join(OUT, "apple-touch-icon.png"))
draw_symbol(512, bg=BG, pad=0.18, dot=True).save(os.path.join(OUT, "icon-512.png"))
draw_symbol(192, bg=BG, pad=0.16).save(os.path.join(OUT, "icon-192.png"))
shutil.copy(os.path.join(SRC, "svg", "ko-symbol-color-nodot.svg"), os.path.join(OUT, "favicon.svg"))
for n in ("ko-symbol-color", "ko-symbol-color-nodot", "ko-symbol-white", "icon-reel", "icon-karussell", "icon-story", "icon-markenauftritt", "phone-frame"):
    shutil.copy(os.path.join(SRC, "svg", n + ".svg"), os.path.join(IMG, n + ".svg"))

# ---- video ------------------------------------------------------------------------------
V = os.path.join(OUT, "video"); os.makedirs(V, exist_ok=True)
shutil.copy(os.path.join(R, "o-lens-loop.mp4"), os.path.join(V, "o-linse-stadt-filmen.mp4"))
shutil.copy(os.path.join(R, "o-lens-loop.webm"), os.path.join(V, "o-linse-stadt-filmen.webm"))

with open(os.path.join(WEB, "tools", "assets.json"), "w", encoding="utf8") as f:
    json.dump(manifest, f, indent=1)
print("assets ok", len(manifest))
