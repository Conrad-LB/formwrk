/**
 * Custom-build rules — the "Custom" panel lets the user hand-assemble a frame set
 * (bottom → top) and reads back the serviceable height range, instead of entering a
 * target height and getting a configuration.
 *
 * The frame stack is picked in three slots with two structural rules:
 *   1. non-increasing bottom → top ("larger frames always lower"), and
 *   2. the top slot of a triple can never be a 7ft frame.
 * These are GUARDRAILS, deliberately broader than the 27-config catalogue: they admit
 * 54 distinct stacks (5 singles + 15 doubles + 34 triples) vs the catalogue's 18. That
 * is intentional — Custom is for exploring arbitrary builds; `calcHeightRange` returns a
 * correct range for any of them.
 *
 * Three catalogue rules are still preserved (they already hold for every catalogue config):
 *   - extensions apply to SINGLE frames only (none on doubles/triples),
 *   - extensions require HOLLOW jacks (no tested basis for solid stems in rockets), and
 *   - Prop Inner is available on SINGLE + THIN slabs only (never multi, never thick).
 * `customConfigFrom` coerces those so the built config can never violate them.
 */

import { FRAME_HEIGHTS, type JackType } from './frameData';
import { isThickSlab } from './heightCalc';
import type { FrameConfig, BaseType } from './configurations';

/** Selectable frame sizes, ordered small → large. */
export const FRAME_SIZES = ['3ft', '4ft', '5ft', '6ft', '7ft'] as const;

/** The three frame slots, bottom (slot 0) → top (slot 2). `null` = empty. */
export type Slots = [string | null, string | null, string | null];

export const EMPTY_SLOTS: Slots = [null, null, null];

const h = (size: string): number => FRAME_HEIGHTS[size] ?? 0;

/** A slot can be edited only once the slot directly below it is filled. */
export function slotEnabled(slots: Slots, index: number): boolean {
  if (index === 0) return true;
  return slots[index - 1] != null;
}

/**
 * Is `size` a legal choice for slot `index` given the current slots?
 *   - the top slot (2) can never be 7ft, and
 *   - every slot must be ≤ the slot directly below it (non-increasing).
 */
export function sizeAllowed(slots: Slots, index: number, size: string): boolean {
  if (index === 2 && size === '7ft') return false;
  if (index > 0) {
    const below = slots[index - 1];
    if (below == null) return false; // prerequisite slot not chosen yet
    if (h(size) > h(below)) return false;
  }
  return true;
}

/**
 * Set slot `index` to `value`, then clear any deeper slots the change invalidates
 * (a now-taller frame above, or a slot that lost its filled prerequisite).
 */
export function applySlot(slots: Slots, index: number, value: string | null): Slots {
  const next: Slots = [slots[0], slots[1], slots[2]];
  next[index] = value;
  for (let i = index + 1; i < 3; i++) {
    const below = next[i - 1];
    const here = next[i];
    if (below == null || here == null) {
      next[i] = null;
      continue;
    }
    if (h(here) > h(below) || (i === 2 && here === '7ft')) next[i] = null;
  }
  return next;
}

/** Filled slots as a bottom → top frame list (the shape `FrameConfig.frames` expects). */
export function framesFromSlots(slots: Slots): string[] {
  return slots.filter((s): s is string => s != null);
}

/** Extensions apply to single frames only, and require hollow jacks. */
export function extensionAllowed(slots: Slots, jackType: JackType): boolean {
  return framesFromSlots(slots).length <= 1 && jackType === 'hollow';
}

/** Prop Inner is available on a single frame + a thin slab only. */
export function propInnerAllowed(slots: Slots, slabThickness: number): boolean {
  return framesFromSlots(slots).length === 1 && !isThickSlab(slabThickness);
}

const KIND = ['Single', 'Double', 'Triple'] as const;
const sizeLabel = (size: string): string => size.replace('ft', 'Ft');

/** Human summary of a built stack, e.g. "Double · 6Ft + 5Ft". */
export function describeCustom(frames: string[]): string {
  const kind = KIND[Math.min(frames.length, 3) - 1] ?? `${frames.length}-frame`;
  return `${kind} · ${frames.map(sizeLabel).join(' + ')}`;
}

/**
 * Build a `FrameConfig` from the current custom selections, or `null` while no bottom
 * frame is chosen (the assembly isn't renderable yet). Coerces the extension and base
 * to the always-preserved catalogue rules (no extension on multi-frame or solid jacks;
 * no Prop Inner on multi-frame or thick slabs), so the returned config is always
 * structurally legal.
 */
export function customConfigFrom(
  slots: Slots,
  rocket: string,
  baseType: BaseType,
  slabThickness: number,
  jackType: JackType,
): FrameConfig | null {
  const frames = framesFromSlots(slots);
  if (frames.length === 0) return null;

  const effRocket = extensionAllowed(slots, jackType) ? rocket : 'none';
  const effBase: BaseType =
    baseType === 'propInner' && !propInnerAllowed(slots, slabThickness) ? 'flatJack' : baseType;

  return {
    id: `custom:${frames.join('+')}|${effRocket}|${effBase}`,
    label: describeCustom(frames),
    frames,
    rocket: effRocket,
    baseType: effBase,
  };
}
