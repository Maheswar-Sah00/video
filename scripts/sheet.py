"""Contact sheet: sheet.py OUT.png img1.png img2.png ... (labels from the -fNNNN suffix)."""
import sys, re
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
tw = 300
th = int(ims[0].height * tw / ims[0].width)
cols = min(len(ims), 4 if len(ims) <= 8 else 5)
rows = (len(ims) + cols - 1) // cols
pad, lab = 8, 22
sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + pad + lab) + pad), (28, 28, 30))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    r, c = divmod(i, cols)
    x, y = pad + c * (tw + pad), pad + r * (th + pad + lab)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + lab))
    m = re.search(r"-f(\d+)\.png$", f)
    d.text((x + 2, y + 4), (f"f{m.group(1)}  {int(m.group(1))/30:.1f}s") if m else f, fill=(220, 200, 150))
sheet.save(out)
