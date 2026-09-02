#!/usr/bin/env python3
"""
tabs.py — turn a folder of interface-tab screenshots into aligned, same-size web frames.

Why: screenshots of the same synth window come out a few pixels different in size, so when the
page crossfades between them the picture creeps left/right ("jitter"). Every frame here is aligned to the
first one by matching the oscillator block (identical on every tab), cropped to one rectangle, then
exported at one width, so the interface never moves between frames.

Usage:
  python3 tools/tabs.py "<folder of PNGs>" assets [--width 1100]

Naming: the output name comes from the screenshot's filename, lower-cased, with anything that is
not a letter or digit turned into a dash, prefixed "tab-":  "env:cut.png" → tab-env-cut.webp,
"Stepped sequencer.png" → tab-stepped-sequencer.webp. Reference those names in index.html
(data-cycle on the hero frames, data-step on the walkthrough frames).

Checks: it prints each frame's size and the row where the first dark landmark appears; after alignment those
rows should match within 1–2 px; if they don't, the screenshots differ in zoom, not position —
retake them at one window size (never crop from coordinates guessed off a preview).
"""
import os, re, sys
from PIL import Image

src = sys.argv[1]; out = sys.argv[2]
width = int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else 1100
files = sorted(f for f in os.listdir(src) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
ims = {f: Image.open(os.path.join(src, f)).convert("RGB") for f in files}
# --- align every frame to the first one by matching the region that is the same on every tab
#     (the top-left third: the oscillator block). Search ±12 px, downsampled 4x, least difference wins.
ref = ims[files[0]]
def region(im, dx, dy):
    return im.crop((dx, dy, dx + ref.size[0] // 2, dy + ref.size[1] // 2)).resize((ref.size[0] // 8, ref.size[1] // 8)).convert("L")
base = region(ref, 0, 0); bpx = base.load(); bw, bh = base.size
def diff(im, dx, dy):
    c = region(im, dx, dy).load(); return sum(abs(c[x, y] - bpx[x, y]) for y in range(bh) for x in range(bw))
shift = {}
for f, im in ims.items():
    best = min(((diff(im, dx, dy), dx, dy) for dy in range(0, 13) for dx in range(0, 13)), key=lambda t: t[0]) if f != files[0] else (0, 0, 0)
    shift[f] = (best[1], best[2])
W = min(im.size[0] - shift[f][0] for f, im in ims.items()); H = min(im.size[1] - shift[f][1] for f, im in ims.items())
print(f"aligned crop: {W}x{H}  (sources: " + ", ".join(f"{im.size[0]}x{im.size[1]} shift {shift[f]}" for f, im in ims.items()) + ")")
os.makedirs(out, exist_ok=True)
for f, im in ims.items():
    dx, dy = shift[f]
    frame = im.crop((dx, dy, dx + W, dy + H))
    px = frame.load()
    landmark = next((y for y in range(0, H, 2) if any(sum(px[x, y]) < 200 for x in range(0, W, 4))), None)
    name = "tab-" + re.sub(r"[^a-z0-9]+", "-", os.path.splitext(f)[0].lower()).strip("-") + ".webp"
    frame = frame.resize((width, round(H * width / W)), Image.LANCZOS)
    frame.save(os.path.join(out, name), "WEBP", quality=84, method=6)
    print(f"  {name:28s} first dark row {landmark:4d}  {os.path.getsize(os.path.join(out, name)) // 1024} KB")
