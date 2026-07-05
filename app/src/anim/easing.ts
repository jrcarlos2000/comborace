// Motion helpers ported from ~/animation-lab/lib.js (easing set) and the squash-stretch /
// damped-slam math in scene-bounce.html. Kept dependency-free so the race loop can lean on
// the same feel the sting scenes use without pulling in anything heavy.

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Deterministic PRNG (same LCG the scenes use) for reproducible jitter.
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Volume-preserving squash: as the vertical scale drops the width grows, so a car that
// stretches on a fast dash and squashes on a landing keeps its mass. Lifted from the Luxo
// slam in scene-bounce.html.
export function squashWidth(scaleY: number): number {
  return 1 / Math.sqrt(Math.max(scaleY, 0.4));
}

// Damped elastic settle used for the cash landing: a quick bounce that decays to rest.
// tau is seconds since the car crossed the line. Adapted from the post-impact slam pose.
export function landingBounce(tau: number): number {
  if (tau <= 0) return 0;
  return 2.2 * Math.exp(-3.2 * tau) * Math.abs(Math.sin(8 * tau));
}
