#!/usr/bin/env python3
# Turns the heavy Blender renders in assets-3d/cars into web-light sprites the race can ship:
# one trimmed hero PNG per car plus a single horizontal crash sprite sheet per car (18 frames).
# Source stays untouched; output lands in app/public/cars so Vite serves it as static files.
import os
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "assets-3d", "cars")
OUT = os.path.join(ROOT, "app", "public", "cars")

CARS = ["car1", "car2", "car3", "car4"]
CRASH_FRAMES = 18
HERO_W = 220
FRAME_W = 150


def alpha_bbox(im, thresh):
    a = np.asarray(im.split()[-1])
    ys, xs = np.where(a > thresh)
    if len(xs) == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def save_png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    return os.path.getsize(path)


def shared_hero_box():
    box = None
    for car in CARS:
        im = Image.open(os.path.join(SRC, car, "hero.png")).convert("RGBA")
        b = alpha_bbox(im, 40)
        if b is None:
            continue
        box = list(b) if box is None else [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    return tuple(box)


def build_hero(car, box):
    im = Image.open(os.path.join(SRC, car, "hero.png")).convert("RGBA").crop(box)
    w, h = im.size
    scaled = im.resize((HERO_W, max(1, round(h * HERO_W / w))), Image.LANCZOS)
    size = save_png(scaled, os.path.join(OUT, car, "hero.png"))
    return scaled.size, size


def build_crash_sheet(car):
    frames = []
    box = None
    for i in range(1, CRASH_FRAMES + 1):
        im = Image.open(os.path.join(SRC, car, "crash", f"crash_{i:04d}.png")).convert("RGBA")
        frames.append(im)
        b = alpha_bbox(im, 24)
        if b:
            box = list(b) if box is None else [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    box = tuple(box)
    cw, ch = box[2] - box[0], box[3] - box[1]
    fh = max(1, round(ch * FRAME_W / cw))
    sheet = Image.new("RGBA", (FRAME_W * CRASH_FRAMES, fh), (0, 0, 0, 0))
    for idx, im in enumerate(frames):
        f = im.crop(box).resize((FRAME_W, fh), Image.LANCZOS)
        sheet.paste(f, (idx * FRAME_W, 0), f)
    size = save_png(sheet, os.path.join(OUT, car, "crash-sheet.png"))
    return (FRAME_W, fh), size


def main():
    box = shared_hero_box()
    print("hero crop box", box)
    total = 0
    for car in CARS:
        (hw, hh), hs = build_hero(car, box)
        (fw, fh), cs = build_crash_sheet(car)
        total += hs + cs
        print(f"{car}: hero {hw}x{hh} {hs//1024}KB | crash frame {fw}x{fh} sheet {cs//1024}KB")
    print(f"total sprite weight {total//1024}KB")


if __name__ == "__main__":
    main()
