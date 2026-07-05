// Palette source of truth. Raw hex per shade lives ONLY here. Shadows, gradients and
// animation tokens live in tailwind.config.js; composed @apply classes live in
// src/styles/components.css; @font-face lives in src/styles/fonts.css.
//
// Ported from Stormbit's refined purple + grey + supporting scales. ComboRace runs the
// palette on a dark race track, so the deep grey shades double as surface tones. There are
// no neon or fluorescent values here: the old electric car set is replaced by the muted
// `carColors` series below.

const colors = {
  brand: {
    DEFAULT: "#7E5DFE",
    deep: "#6631F6",
    purple: { light: "#A089FF" },
    red: { light: "#FF9797" },
  },

  // Dark race-track surfaces. A near-black with a faint purple-blue cast so the brand reads
  // through the whole arena instead of a flat neutral black.
  track: {
    bg: "#0A0A12",
    panel: "#12121F",
    lane: "#0E0E1A",
    line: "#23234010",
  },

  // Semantic race states, pulled onto the Stormbit red/green scales so danger and payout
  // stay legible without the old fluorescent crash/cash tones.
  crash: "#FF5757",
  cash: "#2FDB99",
  gold: "#E0B052",

  purple: {
    50: "#F4F2FF",
    100: "#EAE8FF",
    200: "#DBD4FF",
    300: "#BAB1FF",
    400: "#9885FF",
    500: "#7E5DFE",
    600: "#6631F6",
    700: "#571FE2",
    800: "#4819BE",
    900: "#3E179B",
    950: "#240C69",
  },
  grey: {
    50: "#F8F8F8",
    100: "#F1F1F1",
    200: "#DCDCDC",
    300: "#BDBDBD",
    400: "#989898",
    500: "#787878",
    600: "#656565",
    700: "#525252",
    800: "#464646",
    900: "#3D3D3D",
    950: "#191919",
  },
  red: {
    50: "#FFF0F0",
    100: "#FFDDDD",
    200: "#FFC0C0",
    300: "#FF9494",
    400: "#FF5757",
    500: "#FF2323",
    600: "#FF0000",
    700: "#D70000",
    800: "#B10303",
    900: "#920A0A",
    950: "#500000",
  },
  yellow: {
    50: "#FFFAEC",
    100: "#FFF4D3",
    200: "#FFE5A5",
    300: "#FFD16D",
    400: "#FFB232",
    500: "#FF980A",
    600: "#FF8000",
    700: "#CC5D02",
    800: "#A1480B",
    900: "#823D0C",
    950: "#461D04",
  },
  green: {
    50: "#EBFEF5",
    100: "#D0FBE5",
    200: "#A4F6D0",
    300: "#6AEBB7",
    400: "#2FDB99",
    500: "#0ABF82",
    600: "#008C60",
    700: "#007C59",
    800: "#036247",
    900: "#04503C",
    950: "#012D23",
  },
  blue: {
    50: "#EEF4FF",
    100: "#D9E5FF",
    200: "#BCD2FF",
    300: "#8EB6FF",
    400: "#598EFF",
    500: "#4674FF",
    600: "#1B42F5",
    700: "#142FE1",
    800: "#1727B6",
    900: "#19288F",
    950: "#141A57",
  },
};

// Comma-joined channels for the semantic race states, for the rare inline `rgba(var,alpha)`
// consumer (share card accents, particle tints) that needs an alpha ramp off the same hex the
// Tailwind `crash` / `cash` / `gold` tokens use. Kept here so no raw channel triples live in JSX.
export const crashRgb = "255,87,87";
export const cashRgb = "47,219,153";
export const goldRgb = "224,176,82";

export interface CarColor {
  name: string;
  hex: string;
  rgb: string;
}

// Car identity colors. Kept OUTSIDE `colors` (Tailwind color tokens cannot be arrays) and
// consumed as inline styles / CSS custom properties, the same way Stormbit keeps chart
// series out of the palette. Muted, mutually distinguishable jewel tones that sit on the
// dark track without the fluorescent glow of the retired neon set. `rgb` mirrors `hex` for
// the `--crgb` custom property the car sprite reads.
export const carColors: CarColor[] = [
  { name: "teal", hex: "#3FB6B0", rgb: "63,182,176" },
  { name: "gold", hex: "#E0B052", rgb: "224,176,82" },
  { name: "orchid", hex: "#B478D6", rgb: "180,120,214" },
  { name: "sage", hex: "#7FB86A", rgb: "127,184,106" },
  { name: "blue", hex: "#5B8DE0", rgb: "91,141,224" },
  { name: "rose", hex: "#DE6E97", rgb: "222,110,151" },
  { name: "violet", hex: "#8A78E8", rgb: "138,120,232" },
  { name: "coral", hex: "#E0885A", rgb: "224,136,90" },
];

export default colors;
