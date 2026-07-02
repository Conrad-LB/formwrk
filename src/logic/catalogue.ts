/**
 * Catalogue queries layered on top of the calc engine:
 *   - which configs apply to a slab + jack type,
 *   - which are valid for given inputs,
 *   - the "Optimal" valid config (auto-assemble recommendation),
 *   - snap-to-catalogue option filtering for the palette.
 *
 * OPTIMAL POLICY (v3): only configurations fully backed by published supplier data are
 * ever recommended — flat-jack singles (with or without rockets) and doubles. Prop Inner
 * configs (superseded practice, TWE design required) and triples (no published data for
 * three-high stacks, engineering required) are NEVER optimal: they stay selectable in the
 * ranked list ("Select") behind an engineering flag. Where only those service the height,
 * `simplestValidConfig` returns null and the UI shows no Optimal.
 */

import { CONFIGURATIONS, type FrameConfig, type BaseType } from './configurations';
import { FRAME_HEIGHTS, type JackType } from './frameData';
import { framesTotal, isAvailable, isConfigValidForInputs } from './heightCalc';

/** All configs usable for a slab thickness + jack type (drops Prop Inner when thick, rockets when solid). */
export function configsForSlab(slabThickness: number, jackType: JackType): FrameConfig[] {
  return CONFIGURATIONS.filter((c) => isAvailable(c, slabThickness, jackType));
}

/** Configs whose serviceable range contains the target slab height. */
export function validConfigsForInputs(
  slabHeight: number,
  slabThickness: number,
  jackType: JackType,
): FrameConfig[] {
  return CONFIGURATIONS.filter((c) => isConfigValidForInputs(c, slabHeight, slabThickness, jackType));
}

/** Eligible for the Optimal recommendation: flat-jack singles + doubles only. */
export function isOptimalEligible(c: FrameConfig): boolean {
  return c.baseType === 'flatJack' && c.frames.length <= 2;
}

/**
 * Engineering-sign-off badge text for a config, or null if it's Optimal-eligible.
 * Single source for this label so the Optimal view and the Select list can never
 * show different text for the same config (Prop Inner -> TWE, triples -> general).
 */
export function engineeringBadgeLabel(c: FrameConfig): string | null {
  if (isOptimalEligible(c)) return null;
  return c.baseType === 'propInner' ? 'TWE required' : 'Engineering required';
}

/**
 * Display/preference rank (lower = preferred). Sheet v3 Optimal preference order:
 *   0  Single (Flat Jack, no rocket)
 *   1  Single + rocket (Flat Jack)
 *   2  Double
 * Never optimal (listed under "Select" with an engineering flag):
 *   3  Single + Prop Inner (no rocket)
 *   4  Single + rocket + Prop Inner
 *   5  Triple
 */
function archetypeRank(c: FrameConfig): number {
  const n = c.frames.length;
  if (n >= 3) return 5;
  if (n === 2) return 2;
  const hasExt = c.rocket !== 'none';
  if (c.baseType === 'flatJack') return hasExt ? 1 : 0;
  return hasExt ? 4 : 3;
}

/**
 * Total ordering for the ranked list (lower = simpler):
 *   1) archetype rank (above)
 *   2) smaller frames first (by total frame height)
 *   3) id, as a stable final tie-break
 */
export function compareSimplicity(a: FrameConfig, b: FrameConfig): number {
  return (
    archetypeRank(a) - archetypeRank(b) ||
    framesTotal(a.frames) - framesTotal(b.frames) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * The single Optimal config for the inputs, or null if none fits. Only optimal-eligible
 * configs are considered — a height serviced solely by Prop Inner / triple configurations
 * returns null (the UI then offers those under "Select" with an engineering flag).
 */
export function simplestValidConfig(
  slabHeight: number,
  slabThickness: number,
  jackType: JackType,
): FrameConfig | null {
  const eligible = validConfigsForInputs(slabHeight, slabThickness, jackType).filter(isOptimalEligible);
  if (eligible.length === 0) return null;
  return eligible.sort(compareSimplicity)[0];
}

/**
 * The simplest configuration that is merely AVAILABLE for the slab + jack type (ignoring
 * height fit). Used as a SAFE fallback so the active assembly is never a prohibited one
 * (e.g. a Prop Inner on a thick slab) when nothing services the entered height.
 */
export function simplestAvailableConfig(slabThickness: number, jackType: JackType): FrameConfig {
  return configsForSlab(slabThickness, jackType).slice().sort(compareSimplicity)[0];
}

/** All valid configs sorted simplest-first (the "Select" list, engineering options last). */
export function validConfigsRanked(
  slabHeight: number,
  slabThickness: number,
  jackType: JackType,
): FrameConfig[] {
  return validConfigsForInputs(slabHeight, slabThickness, jackType).sort(compareSimplicity);
}

// ---------------------------------------------------------------------------
// Snap-to-catalogue palette support
// ---------------------------------------------------------------------------

export interface PartialSelection {
  /** Frame stack so far (exact order). */
  frames?: string[];
  rocket?: string;
  baseType?: BaseType;
}

/** A frame stack identity string, e.g. ['5ft','6ft'] -> '5ft+6ft'. */
export const frameKey = (frames: string[]): string => frames.join('+');

function matchesPartial(c: FrameConfig, sel: PartialSelection): boolean {
  if (sel.frames && frameKey(sel.frames) !== frameKey(c.frames)) return false;
  if (sel.rocket !== undefined && c.rocket !== sel.rocket) return false;
  if (sel.baseType !== undefined && c.baseType !== sel.baseType) return false;
  return true;
}

const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];

/**
 * Given a partial selection + slab thickness + jack type, return the option values on
 * each axis that keep the assembly inside the catalogue. This is what makes the palette
 * "snap to catalogue": only offer choices that can complete to a real config.
 */
export function validOptions(sel: PartialSelection, slabThickness: number, jackType: JackType) {
  const pool = configsForSlab(slabThickness, jackType).filter((c) => matchesPartial(c, sel));
  return {
    frameStacks: uniq(pool.map((c) => frameKey(c.frames))),
    rockets: uniq(pool.map((c) => c.rocket)),
    baseTypes: uniq(pool.map((c) => c.baseType)),
    configs: pool,
  };
}

/** Frame sizes (single-frame additions) that can begin/extend a valid stack. */
export function availableFrameSizes(): string[] {
  return Object.keys(FRAME_HEIGHTS);
}
