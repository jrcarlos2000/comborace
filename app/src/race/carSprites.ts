import { carColors } from '../theme/colors';

export interface CarSprite {
  hero: string;
  crashSheet: string;
  frames: number;
}

// The Blender set only rendered the first four liveries (teal, gold, orchid, sage). Match on
// the exact rgb string each combo already carries instead of a per-id table, so any car that
// draws one of those colors gets its 3D sprite and anything else falls back to the CSS body.
const RENDERED = carColors.slice(0, 4).map((c) => c.rgb);

export const CRASH_FRAMES = 18;

export function carSpriteFor(colorRgb: string | undefined): CarSprite | null {
  if (!colorRgb) return null;
  const idx = RENDERED.indexOf(colorRgb);
  if (idx < 0) return null;
  const dir = `/cars/car${idx + 1}`;
  return { hero: `${dir}/hero.png`, crashSheet: `${dir}/crash-sheet.png`, frames: CRASH_FRAMES };
}
