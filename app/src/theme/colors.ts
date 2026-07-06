// Palette source of truth. Raw hex per shade lives ONLY here. Shadows, gradients and
// animation tokens live in tailwind.config.js; composed @apply classes live in
// src/styles/components.css; @font-face lives in src/styles/fonts.css.
//
// A clean blue accent (centered on the docs blue #2f68d8) over a grey + supporting scale set.
// ComboRace runs the palette on a LIGHT surface, so the pale grey shades carry the page and card
// surfaces and the deep grey shades carry text. There are no neon or fluorescent values here: the
// old electric car set is replaced by the muted `carColors` series below.

const colors = {
  brand: {
    DEFAULT: "#2F68D8",
    deep: "#1E4AA6",
    purple: { light: "#8FB1EA" },
    red: { light: "#FF9797" },
  },

  // Light race-track surfaces. A soft cool off-white page with near-white raised cards, so the
  // engineered shadows read and the blue brand pops against the neutral field.
  track: {
    // `base` is the true page background (the softest neutral tone); `bg` is the frosted
    // near-white used for sticky headers and overlays. Focus-ring offsets read against `base`
    // so the ring sits on the real page. `panel` is the raised white card surface, `lane` the
    // soft light-grey strip a car sits on (never pure white), `line` the faint grid rule.
    base: "#EDEEF2",
    bg: "#F6F6F9",
    panel: "#FFFFFF",
    lane: "#ECEDF1",
    line: "#E1E1E8",
  },

  // Semantic race states, pulled onto the red/green/amber scales at shades that stay legible as
  // text on the light surfaces while still reading as danger, payout and lead.
  crash: "#E5342E",
  cash: "#07966A",
  gold: "#B7791F",

  // The brand accent ramp. Kept under the `purple` token name for continuity with the existing
  // `-purple-*` utility classes (focus rings, borders, text gradient), but the values are the
  // clean blue centered on the docs blue #2f68d8: 500 is the base, 600 the hover step, 700 the
  // active step, 400 the focus ring.
  purple: {
    50: "#EEF3FC",
    100: "#DAE6F9",
    200: "#BCD0F3",
    300: "#8FB1EA",
    400: "#5A8CE6",
    500: "#2F68D8",
    600: "#255AC2",
    700: "#1E4AA6",
    800: "#1A3E8A",
    900: "#17335F",
    950: "#0F1F3D",
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
export const crashRgb = "229,52,46";
export const cashRgb = "7,150,106";
export const goldRgb = "183,121,31";
export const brandRgb = "47,104,216";

export interface CarColor {
  name: string;
  hex: string;
  rgb: string;
}

// Car identity colors. Kept OUTSIDE `colors` (Tailwind color tokens cannot be arrays) and
// consumed as inline styles / CSS custom properties, the same way Stormbit keeps chart
// series out of the palette. Muted, mutually distinguishable jewel tones deepened enough to
// read as bold handle text on the light surfaces while keeping each livery's hue. `rgb`
// mirrors `hex` for the `--crgb` custom property the CSS-fallback car sprite reads; both the
// combo table and the 3D sprite matcher derive from this list, so they stay in sync.
export const carColors: CarColor[] = [
  { name: "teal", hex: "#1F8079", rgb: "31,128,121" },
  { name: "gold", hex: "#A97A16", rgb: "169,122,22" },
  { name: "orchid", hex: "#9A4FC4", rgb: "154,79,196" },
  { name: "sage", hex: "#4E9B4A", rgb: "78,155,74" },
  { name: "blue", hex: "#3D6FC7", rgb: "61,111,199" },
  { name: "rose", hex: "#C43D6B", rgb: "196,61,107" },
  { name: "violet", hex: "#6B54D6", rgb: "107,84,214" },
  { name: "coral", hex: "#C7602F", rgb: "199,96,47" },
];

export default colors;
