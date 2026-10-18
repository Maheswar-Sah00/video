"""Paper + grain textures -> public/tex/*.png (mid-grey based, for overlay/soft-light blends)."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "tex"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

for i in range(4):
    h, w = 1936, 1096
    g = rng.normal(0, 1, (h, w))
    g = gaussian_filter(g, 0.65)
    g = g / g.std() * 22 + 128
    Image.fromarray(np.clip(g, 0, 255).astype(np.uint8), "L").save(OUT / f"grain{i}.png", optimize=True)

h, w = 1920, 1080
p = np.zeros((h, w))
for s, a in [(160, 10), (60, 7), (18, 4), (4, 2.5)]:
    n = gaussian_filter(rng.normal(0, 1, (h, w)), s)
    p += n / (n.std() + 1e-9) * a
# fibres: short random strokes
fib = np.zeros((h, w))
for _ in range(2600):
    x, y = rng.uniform(0, w), rng.uniform(0, h)
    ang = rng.uniform(0, np.pi)
    L = rng.uniform(8, 40)
    for t in np.linspace(0, 1, int(L)):
        xi, yi = int(x + np.cos(ang) * L * t), int(y + np.sin(ang) * L * t)
        if 0 <= xi < w and 0 <= yi < h:
            fib[yi, xi] += 1
fib = gaussian_filter(fib, 0.6)
p += fib / (fib.max() + 1e-9) * 30 * rng.choice([-1, 1])
p = p + 128
Image.fromarray(np.clip(p, 0, 255).astype(np.uint8), "L").save(OUT / "paper.png", optimize=True)
print("textures ok")
