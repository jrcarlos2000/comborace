# Equalize per-frame brightness across a crash sprite sequence.
# Each frame is scaled so the mean luminance of its opaque (car + debris) pixels
# matches the sequence median, which removes denoiser flicker and any residual
# exposure drift as the car tumbles. Scale is clamped so real shading is kept.
import sys, os, glob
import numpy as np
from PIL import Image

WHT = np.array([0.2126, 0.7152, 0.0722])


def frame_mean(im):
    a = im[..., 3] / 255.0
    mask = a > 0.5
    if not mask.any():
        return 0.0
    return float((im[..., :3][mask] @ WHT).mean())


def main(d):
    files = sorted(glob.glob(os.path.join(d, 'crash_*.png')))
    imgs = [np.asarray(Image.open(f).convert('RGBA'), dtype=np.float64) for f in files]
    means = [frame_mean(im) for im in imgs]
    target = float(np.median([m for m in means if m > 0]))
    for f, im, m in zip(files, imgs, means):
        if m <= 0:
            continue
        scale = min(1.18, max(0.85, target / m))
        im[..., :3] = np.clip(im[..., :3] * scale, 0, 255)
        Image.fromarray(im.astype(np.uint8), 'RGBA').save(f)
        print(f'{os.path.basename(f)} mean={m:6.2f} -> scale={scale:.3f}')
    print(f'normalized {len(files)} frames to target luma {target:.2f}')


if __name__ == '__main__':
    main(sys.argv[1])
