/**
 * All formwork constants.
 *
 * SOURCE OF TRUTH: Formwork_Material_Selection_v3.xlsx, sheet "Mat. Selection v3".
 * Cell references are noted inline so every magic number is traceable to the spreadsheet.
 * The spreadsheet is non-negotiable: if it changes, change these constants to match.
 *
 * v3 design basis (see the sheet's NOTES block): product-agnostic and conservative —
 * where supplier data differs (Royal jack60/RF60RS, Acrow V-Shore, Cassaform Super Shore)
 * the more conservative value governs; nominal frame spacing <= 1.5 m; bearers-parallel
 * (worst) orientation.
 */

/** Shoring-frame nominal heights, in mm. Sheet E10:E14. */
export const FRAME_HEIGHTS: Record<string, number> = {
  '3ft': 915, // E10
  '4ft': 1219, // E11
  '5ft': 1523, // E12
  '6ft': 1830, // E13
  '7ft': 2134, // E14
};

/** Frame-leg extension tubes, in mm. Sheet D17:D18. HOLLOW JACKS ONLY (sheet B16). */
export const ROCKETS: Record<string, number> = {
  none: 0,
  '300mm': 300, // D17
  '500mm': 500, // D18
};

/** Fixed formwork timber — vertical height contribution, in mm. Sheet rows 30-32. */
export const TIMBER = {
  joists: 100, // E30
  bearer: 150, // E31
  ply: 17, // E32
} as const;

/** Always-present timber stack contribution: 100 + 150 + 17 = 267mm. */
export const FIXED_TIMBER = TIMBER.joists + TIMBER.bearer + TIMBER.ply;

/**
 * Screwjack stem type. Capacity and working extension differ:
 *   hollow — tubular stem (48mm class, e.g. ROYALjack60), working max 600mm;
 *   solid  — 36-38mm solid stem, working max 450mm; takes NO rocket extensions.
 */
export type JackType = 'hollow' | 'solid';

/** Configuration class by frame count — the sheet's Singles / Doubles / Triples rows. */
export type ConfigClass = 'single' | 'double' | 'triple';

/**
 * Jack adjustment MAXIMA (mm) by jack type × slab band × config class.
 * Sheet "Jack Adjustment Ranges" matrix, D20:H26:
 *   columns E/F = thin (hollow/solid), G/H = thick (hollow/solid);
 *   rows 21-22 singles, 23-24 doubles, 25-26 triples (U-Head / Base).
 */
export const JACK_MAX: Record<
  JackType,
  Record<'thin' | 'thick', Record<ConfigClass, { uHead: number; base: number }>>
> = {
  hollow: {
    thin: {
      single: { uHead: 600, base: 600 }, // E21 / E22
      double: { uHead: 600, base: 600 }, // E23 / E24
      triple: { uHead: 500, base: 500 }, // E25 / E26
    },
    thick: {
      single: { uHead: 450, base: 300 }, // G21 / G22
      double: { uHead: 300, base: 300 }, // G23 / G24
      triple: { uHead: 300, base: 300 }, // G25 / G26
    },
  },
  solid: {
    thin: {
      single: { uHead: 450, base: 450 }, // F21 / F22
      double: { uHead: 450, base: 450 }, // F23 / F24
      triple: { uHead: 450, base: 450 }, // F25 / F26
    },
    thick: {
      single: { uHead: 300, base: 300 }, // H21 / H22
      double: { uHead: 300, base: 300 }, // H23 / H24
      triple: { uHead: 300, base: 300 }, // H25 / H26
    },
  },
};

/** U-Head minimum engagement, in mm — all classes and jack types. Sheet D21/D23/D25. */
export const U_HEAD_MIN = 100;

/** Flat-jack base minimum, in mm — all classes and jack types. Sheet D22/D24/D26. */
export const BASE_MIN = 50;

/**
 * Prop Inner No 1 (ROYALprop No.1 inner tube used as a pinned base), in mm. Sheet D27/E27.
 * Thin slabs + single frames only. SUPERSEDED PRACTICE — the supplier no longer
 * recommends it; Temporary Works Engineer design required. Never returned as Optimal.
 */
export const PROP_INNER = {
  min: 300, // D27
  max: 1050, // E27
} as const;

/** Slab thickness at or above which the slab is "thick". Sheet E35. */
export const SLAB_THRESHOLD = 221;

/**
 * Maximum design slab thickness, in mm. Sheet E37. Thicker slabs must be checked by a
 * Temporary Works Engineer — the tool clamps the input here and shows that note.
 */
export const SLAB_THICKNESS_MAX = 450;

/** Defensive bounds for the slab inputs (mm) — keep non-finite / absurd values out of state. */
export const INPUT_LIMITS = {
  slabHeightMax: 20000,
  slabThicknessMax: SLAB_THICKNESS_MAX,
} as const;
