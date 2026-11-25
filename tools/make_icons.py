import numpy as np
from PIL import Image, ImageDraw

S = 512

def gradient(size):
    x = np.linspace(0, 1, size)
    y = np.linspace(0, 1, size)
    gx, gy = np.meshgrid(x, y)
    t = np.clip((gx * 0.45 + gy * 0.55), 0, 1)
    c1 = np.array([116, 169, 255], dtype=float)
    c2 = np.array([37, 99, 235], dtype=float)
    arr = c1[None, None, :] * (1 - t[:, :, None]) + c2[None, None, :] * t[:, :, None]
    return arr.astype(np.uint8)

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask

def draw_mark(img, scale=1.0, offset=(0, 0)):
    d = ImageDraw.Draw(img)
    s = scale
    ox, oy = offset
    def pt(x, y):
        return (ox + x * s, oy + y * s)
    # diagonal pen stroke
    d.line([pt(160, 368), pt(335, 130)], fill=(255, 255, 255, 255), width=int(36 * s))
    for cx, cy in [(160, 368), (335, 130)]:
        x, y = pt(cx, cy)
        r = 18 * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))
    # baseline
    d.line([pt(158, 372), pt(250, 372)], fill=(255, 255, 255, 255), width=int(36 * s))
    x1, y1 = pt(158, 372)
    x2, y2 = pt(250, 372)
    r = 18 * s
    d.rounded_rectangle([x1 - r, y1 - r, x2 + r, y2 + r], radius=r, fill=(255, 255, 255, 255))
    # tip dot
    x, y = pt(352, 108)
    r = 19 * s
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 225))
    return img

base = Image.fromarray(gradient(S), 'RGB').convert('RGBA')
base.putalpha(rounded_mask(S, 150))
draw_mark(base, 1.0, (0, 0))
base.save('assets/icons/icon-512.png')
base.resize((192, 192), Image.LANCZOS).save('assets/icons/icon-192.png')

# maskable: full-bleed gradient, mark inset to the safe zone
maskable = Image.fromarray(gradient(S), 'RGB').convert('RGBA')
inner = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw_mark(inner, 0.72, (72, 74))
maskable.alpha_composite(inner)
maskable.convert('RGB').save('assets/icons/icon-maskable-512.png')

print('icons written')
