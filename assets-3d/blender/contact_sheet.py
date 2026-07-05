# Build a contact sheet for the 4-car set: one row per car, hero + crash samples,
# on a dark brand background with a body-hue swatch and label per row.
import sys, os
from PIL import Image, ImageDraw, ImageFont

CARS = [
    ('car1', '2E8E86', 'teal'),
    ('car2', 'C79A44', 'gold'),
    ('car3', 'A663A6', 'orchid'),
    ('car4', '7C9A5E', 'sage'),
]
CRASH_SAMPLES = [2, 7, 12, 17]
BG = (18, 15, 26)
FG = (232, 228, 240)
SUB = (150, 143, 168)
TILE_W, TILE_H = 400, 300
LABEL_W, GAP, PAD, HEADER = 190, 12, 26, 96


def font(size, bold=False):
    paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else ''),
        os.path.expanduser('~/blender-5.1.2-linux-x64/5.1/datafiles/fonts/'),
    ]
    for p in paths:
        if os.path.isfile(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def tile(path):
    t = Image.new('RGBA', (TILE_W, TILE_H), (0, 0, 0, 0))
    if os.path.isfile(path):
        im = Image.open(path).convert('RGBA')
        im.thumbnail((TILE_W, TILE_H), Image.LANCZOS)
        t.alpha_composite(im, ((TILE_W - im.width) // 2, (TILE_H - im.height) // 2))
    return t


def main(root, out):
    cols = 1 + len(CRASH_SAMPLES)
    row_w = LABEL_W + cols * TILE_W + cols * GAP
    row_h = TILE_H + GAP
    W = PAD * 2 + row_w
    H = HEADER + PAD + len(CARS) * row_h + PAD
    sheet = Image.new('RGBA', (W, H), (*BG, 255))
    d = ImageDraw.Draw(sheet)

    d.text((PAD, 30), 'ComboRace car set', font=font(40, True), fill=FG)
    d.text((PAD, 74), 'shared brand: grey roof + #7E5DFE accents, low-metallic finish '
           '. hero + crash sprite per player', font=font(19), fill=SUB)

    y = HEADER + PAD
    for name, hexc, label in CARS:
        rgb = tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4))
        d.rounded_rectangle((PAD, y + 20, PAD + 44, y + 64), 8, fill=rgb)
        d.text((PAD, y + 78), name, font=font(22, True), fill=FG)
        d.text((PAD, y + 106), label, font=font(18), fill=SUB)
        d.text((PAD, y + 132), '#' + hexc, font=font(15), fill=SUB)

        x = PAD + LABEL_W
        sheet.alpha_composite(tile(os.path.join(root, name, 'hero.png')), (x, y))
        x += TILE_W + GAP
        for fnum in CRASH_SAMPLES:
            fp = os.path.join(root, name, 'crash', 'crash_%04d.png' % fnum)
            sheet.alpha_composite(tile(fp), (x, y))
            x += TILE_W + GAP
        y += row_h

    sheet.convert('RGB').save(out)
    print('contact sheet ->', out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
