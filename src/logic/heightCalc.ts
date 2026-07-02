/**
 * Core height calculation — replicates the v3 spreadsheet's min/max logic exactly.
 *
 *   Min = FramesTotal + Extension + FIXED_TIMBER + U_HEAD_MIN + BaseMin
 *   Max = FramesTotal + Extension + FIXED_TIMBER + uHeadMax   + baseMax
 *
 * where uHeadMax / baseMax come from the JACK_MAX matrix (jack type × slab band ×
 * config class) and the Prop Inner base has its own fixed range. Availability rules:
 *   - Prop Inner: thin slabs + single frames only (superseded practice — TWE required);
 *   - Rockets: HOLLOW jacks only (lab-test basis: Royal RF60RS_V21).
 * Verified against every config in the v3 sheet (see heightCalc.test.ts).
 */

import type { FrameConfig } from './configurations';
import {
  FRAME_HEIGHTS,
  ROCKETS,
  FIXED_TIMBER,
  JACK_MAX,
  U_HEAD_MIN,
  BASE_MIN,
  PROP_INNER,
  SLAB_THRESHOLD,
  type JackType,
  type ConfigClass,
} from './frameData';

export interface HeightRange {
  min: number;
  max: number;
  uHeadMin: number;
  uHeadMax: number;
  baseMin: number;
  baseMax: number;
}

/** Slab is "thick" at or above the threshold (>= 221mm). */
export function isThickSlab(slabThickness: number): boolean {
  return slabThickness >= SLAB_THRESHOLD;
}

/** Sum of frame heights in mm. */
export function framesTotal(frames: string[]): number {
  return frames.reduce((sum, f) => sum + (FRAME_HEIGHTS[f] ?? 0), 0);
}

/** Configuration class (single / double / triple) by frame count. */
export function classOf(config: FrameConfig): ConfigClass {
  if (config.frames.length === 1) return 'single';
  if (config.frames.length === 2) return 'double';
  return 'triple';
}

/** U-Head maximum extension for a config + slab thickness + jack type (mm). */
export function uHeadMaxFor(config: FrameConfig, slabThickness: number, jackType: JackType): number {
  const band = isThickSlab(slabThickness) ? 'thick' : 'thin';
  return JACK_MAX[jackType][band][classOf(config)].uHead;
}

/** Base (Flat Jack or Prop Inner) min/max for a config + slab thickness + jack type (mm). */
export function baseRangeFor(
  config: FrameConfig,
  slabThickness: number,
  jackType: JackType,
): { min: number; max: number } {
  if (config.baseType === 'propInner') {
    return { min: PROP_INNER.min, max: PROP_INNER.max }; // 300 / 1050 (thin singles only)
  }
  const band = isThickSlab(slabThickness) ? 'thick' : 'thin';
  return { min: BASE_MIN, max: JACK_MAX[jackType][band][classOf(config)].base };
}

/** Full serviceable height range for a config at a given slab thickness + jack type. */
export function calcHeightRange(
  config: FrameConfig,
  slabThickness: number,
  jackType: JackType,
): HeightRange {
  const fixedBelowJacks = framesTotal(config.frames) + (ROCKETS[config.rocket] ?? 0) + FIXED_TIMBER;
  const uHeadMax = uHeadMaxFor(config, slabThickness, jackType);
  const base = baseRangeFor(config, slabThickness, jackType);

  return {
    min: fixedBelowJacks + U_HEAD_MIN + base.min,
    max: fixedBelowJacks + uHeadMax + base.max,
    uHeadMin: U_HEAD_MIN,
    uHeadMax,
    baseMin: base.min,
    baseMax: base.max,
  };
}

/** Prop Inner is unavailable for thick slabs; everything else is slab-agnostic. */
export function isAvailableForSlab(config: FrameConfig, slabThickness: number): boolean {
  return !(isThickSlab(slabThickness) && config.baseType === 'propInner');
}

/** Rockets require hollow jacks (no published/tested basis for solid stems in rockets). */
export function isAvailableForJack(config: FrameConfig, jackType: JackType): boolean {
  return config.rocket === 'none' || jackType === 'hollow';
}

/** Combined availability: slab rule (Prop Inner) + jack rule (rockets). */
export function isAvailable(config: FrameConfig, slabThickness: number, jackType: JackType): boolean {
  return isAvailableForSlab(config, slabThickness) && isAvailableForJack(config, jackType);
}

/** True if slabHeight (floor-to-soffit) falls within this config's range for the inputs. */
export function isConfigValidForInputs(
  config: FrameConfig,
  slabHeight: number,
  slabThickness: number,
  jackType: JackType,
): boolean {
  if (!isAvailable(config, slabThickness, jackType)) return false;
  const { min, max } = calcHeightRange(config, slabThickness, jackType);
  return slabHeight >= min && slabHeight <= max;
}

/**
 * Live assembled height given the current adjustable screwjack extensions (mm).
 * This is what the 3D tower renders to and what the height panel shows as "Current".
 */
export function currentHeight(config: FrameConfig, uHeadExtension: number, baseExtension: number): number {
  return framesTotal(config.frames) + (ROCKETS[config.rocket] ?? 0) + FIXED_TIMBER + uHeadExtension + baseExtension;
}

/**
 * Deterministically allocate the U-Head and base extensions so the assembled
 * height reaches the target soffit, clamped to the config's serviceable range
 * (if the target is below min / above max, the assembly sits at the nearest end).
 *
 * Preference (site-appropriate): the BASE jack carries the gross height, the
 * U-Head takes the remainder — i.e. extend the base first, then the U-head. Both
 * components always stay within their allowed range.
 */
export function allocateExtensionsToTarget(
  config: FrameConfig,
  slabThickness: number,
  jackType: JackType,
  slabHeight: number,
): { uHeadExtension: number; baseExtension: number } {
  const r = calcHeightRange(config, slabThickness, jackType);
  const fixedBelowJacks = r.min - (r.uHeadMin + r.baseMin); // frames + rocket + timber
  const sumMin = r.uHeadMin + r.baseMin;
  const sumMax = r.uHeadMax + r.baseMax;
  const needed = Math.min(sumMax, Math.max(sumMin, slabHeight - fixedBelowJacks));
  const baseExtension = Math.min(r.baseMax, Math.max(r.baseMin, needed - r.uHeadMin));
  const uHeadExtension = Math.min(r.uHeadMax, Math.max(r.uHeadMin, needed - baseExtension));
  return { uHeadExtension, baseExtension };
}
