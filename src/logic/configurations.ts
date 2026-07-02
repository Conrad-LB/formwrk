/**
 * The canonical formwork configuration catalogue.
 *
 * The v3 spreadsheet evaluates 28 CANONICAL configs across two slab tables (thin < 221mm,
 * thick 221-450mm). The thick table is exactly the thin set MINUS the 6 Prop-Inner configs
 * (Prop Inner is unavailable for thick slabs); rocket configs additionally require hollow
 * jacks. So we store 28 configs and derive availability + height ranges via rules
 * (see heightCalc.ts). One source, no drift.
 *
 * 28 = 14 singles (8 Flat Jack + 6 Prop Inner) + 6 doubles + 8 triples.
 * Labels mirror the spreadsheet column headers (sheet row 45 / row 90).
 * v3 added Double: 4ft + 6ft — it closes the thick-band 3652-3769mm gap with a standard
 * double (previously bridged only by the engineering-flagged Triple 3+3+4).
 * 4ft + 7ft remains excluded: identical frames total to 5ft + 6ft (both 3353mm).
 */

export type BaseType = 'flatJack' | 'propInner';

export interface FrameConfig {
  /** Stable id, e.g. 's-6ft-500-fj', 'd-5-6', 't-3-3-4'. */
  id: string;
  /** Human label, matches the spreadsheet column header. */
  label: string;
  /** Frame stack bottom→top, e.g. ['6ft'] or ['5ft','6ft'] or ['3ft','3ft','4ft']. */
  frames: string[];
  /** Frame-leg extension: 'none' | '300mm' | '500mm'. */
  rocket: string;
  baseType: BaseType;
}

export const CONFIGURATIONS: FrameConfig[] = [
  // ---- Singles · Flat Jack (8) ---- sheet cols C,D,E,F,I,K,M,O
  { id: 's-3ft-fj', label: '3ft', frames: ['3ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 's-4ft-fj', label: '4ft', frames: ['4ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 's-5ft-fj', label: '5ft', frames: ['5ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 's-6ft-fj', label: '6ft', frames: ['6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 's-6ft-500-fj', label: '6ft + 500 Extension', frames: ['6ft'], rocket: '500mm', baseType: 'flatJack' },
  { id: 's-7ft-fj', label: '7ft', frames: ['7ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 's-7ft-300-fj', label: '7ft + 300 Extension', frames: ['7ft'], rocket: '300mm', baseType: 'flatJack' },
  { id: 's-7ft-500-fj', label: '7ft + 500 Extension', frames: ['7ft'], rocket: '500mm', baseType: 'flatJack' },

  // ---- Singles · Prop Inner (6) — thin slabs only ---- sheet cols G,H,J,L,N,P
  { id: 's-6ft-pi', label: '6ft Prop Inner', frames: ['6ft'], rocket: 'none', baseType: 'propInner' },
  { id: 's-6ft-300-pi', label: '6ft + 300 Extension Prop Inner', frames: ['6ft'], rocket: '300mm', baseType: 'propInner' },
  { id: 's-6ft-500-pi', label: '6ft + 500 Extension Prop Inner', frames: ['6ft'], rocket: '500mm', baseType: 'propInner' },
  { id: 's-7ft-pi', label: '7ft Prop Inner', frames: ['7ft'], rocket: 'none', baseType: 'propInner' },
  { id: 's-7ft-300-pi', label: '7ft + 300 Extension Prop Inner', frames: ['7ft'], rocket: '300mm', baseType: 'propInner' },
  { id: 's-7ft-500-pi', label: '7ft + 500 Extension Prop Inner', frames: ['7ft'], rocket: '500mm', baseType: 'propInner' },

  // ---- Doubles · Flat Jack, no rocket (6) ---- sheet cols R,S,T,U,V,W
  { id: 'd-4-6', label: 'Double: 4ft + 6ft', frames: ['4ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 'd-5-6', label: 'Double: 5ft + 6ft', frames: ['5ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 'd-5-7', label: 'Double: 5ft + 7ft', frames: ['5ft', '7ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 'd-6-6', label: 'Double: 6ft + 6ft', frames: ['6ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 'd-6-7', label: 'Double: 6ft + 7ft', frames: ['6ft', '7ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 'd-7-7', label: 'Double: 7ft + 7ft', frames: ['7ft', '7ft'], rocket: 'none', baseType: 'flatJack' },

  // ---- Triples · Flat Jack, no rocket (8) ---- sheet cols X,Y,Z,AA,AB,AC,AD,AE
  { id: 't-3-3-3', label: 'Triple: 3ft + 3ft + 3ft', frames: ['3ft', '3ft', '3ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-3-3-4', label: 'Triple: 3ft + 3ft + 4ft', frames: ['3ft', '3ft', '4ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-3-5-5', label: 'Triple: 3ft + 5ft + 5ft', frames: ['3ft', '5ft', '5ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-4-5-5', label: 'Triple: 4ft + 5ft + 5ft', frames: ['4ft', '5ft', '5ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-5-5-5', label: 'Triple: 5ft + 5ft + 5ft', frames: ['5ft', '5ft', '5ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-5-5-6', label: 'Triple: 5ft + 5ft + 6ft', frames: ['5ft', '5ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-5-6-6', label: 'Triple: 5ft + 6ft + 6ft', frames: ['5ft', '6ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
  { id: 't-6-6-6', label: 'Triple: 6ft + 6ft + 6ft', frames: ['6ft', '6ft', '6ft'], rocket: 'none', baseType: 'flatJack' },
];

/** Lookup by id. */
export const CONFIG_BY_ID: Record<string, FrameConfig> = Object.fromEntries(
  CONFIGURATIONS.map((c) => [c.id, c]),
);
