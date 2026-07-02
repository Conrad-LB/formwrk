import { describe, it, expect } from 'vitest';
import {
  FRAME_SIZES,
  EMPTY_SLOTS,
  slotEnabled,
  sizeAllowed,
  applySlot,
  framesFromSlots,
  extensionAllowed,
  propInnerAllowed,
  customConfigFrom,
  type Slots,
} from './customBuild';

/** Enumerate every stack reachable by clicking through the slot rules. */
function reachableStacks(): string[][] {
  const stacks: string[][] = [];
  for (const a of FRAME_SIZES) {
    if (!sizeAllowed(EMPTY_SLOTS, 0, a)) continue;
    const s1 = applySlot(EMPTY_SLOTS, 0, a);
    stacks.push(framesFromSlots(s1)); // single
    for (const b of FRAME_SIZES) {
      if (!sizeAllowed(s1, 1, b)) continue;
      const s2 = applySlot(s1, 1, b);
      stacks.push(framesFromSlots(s2)); // double
      for (const c of FRAME_SIZES) {
        if (!sizeAllowed(s2, 2, c)) continue;
        const s3 = applySlot(s2, 2, c);
        stacks.push(framesFromSlots(s3)); // triple
      }
    }
  }
  return stacks;
}

describe('customBuild: slot rules produce the intended 54-stack superset', () => {
  const stacks = reachableStacks();
  const byLen = (n: number) => stacks.filter((s) => s.length === n);

  it('yields 5 singles, 15 doubles, 34 triples (54 total)', () => {
    expect(byLen(1)).toHaveLength(5);
    expect(byLen(2)).toHaveLength(15);
    expect(byLen(3)).toHaveLength(34);
    expect(stacks).toHaveLength(54);
  });

  it('every stack is non-increasing bottom → top', () => {
    const height: Record<string, number> = { '3ft': 915, '4ft': 1219, '5ft': 1523, '6ft': 1830, '7ft': 2134 };
    for (const s of stacks) {
      for (let i = 1; i < s.length; i++) {
        expect(height[s[i]]).toBeLessThanOrEqual(height[s[i - 1]]);
      }
    }
  });

  it('never puts a 7ft frame on top of a triple (excludes 7+7+7)', () => {
    for (const s of byLen(3)) expect(s[2]).not.toBe('7ft');
    expect(byLen(3)).not.toContainEqual(['7ft', '7ft', '7ft']);
  });

  it('admits stacks the catalogue omits (proves it is a superset)', () => {
    const has = (stack: string[]) => stacks.some((s) => s.join('+') === stack.join('+'));
    expect(has(['7ft', '3ft'])).toBe(true); // double the catalogue never lists
    expect(has(['4ft', '4ft', '4ft'])).toBe(true); // triple the catalogue never lists
  });
});

describe('customBuild: slot enablement + cascade', () => {
  it('slot 1 and 2 are locked until the slot below is filled', () => {
    expect(slotEnabled(EMPTY_SLOTS, 0)).toBe(true);
    expect(slotEnabled(EMPTY_SLOTS, 1)).toBe(false);
    const s1: Slots = ['6ft', null, null];
    expect(slotEnabled(s1, 1)).toBe(true);
    expect(slotEnabled(s1, 2)).toBe(false);
  });

  it('lowering the bottom frame clears now-taller frames above it', () => {
    const built = applySlot(applySlot(applySlot(EMPTY_SLOTS, 0, '6ft'), 1, '6ft'), 2, '5ft');
    expect(framesFromSlots(built)).toEqual(['6ft', '6ft', '5ft']);
    const lowered = applySlot(built, 0, '4ft'); // 6ft/5ft above no longer legal
    expect(lowered).toEqual(['4ft', null, null]);
  });

  it('clearing a middle slot clears the top slot too', () => {
    const built = applySlot(applySlot(applySlot(EMPTY_SLOTS, 0, '6ft'), 1, '5ft'), 2, '4ft');
    const cleared = applySlot(built, 1, null);
    expect(cleared).toEqual(['6ft', null, null]);
  });
});

describe('customBuild: extension / prop-inner availability + coercion', () => {
  it('extensions only on a single frame with hollow jacks', () => {
    expect(extensionAllowed(['6ft', null, null], 'hollow')).toBe(true);
    expect(extensionAllowed(['6ft', '5ft', null], 'hollow')).toBe(false);
    expect(extensionAllowed(['6ft', null, null], 'solid')).toBe(false); // rockets are hollow-only
  });

  it('prop inner only on a single, thin slab', () => {
    expect(propInnerAllowed(['6ft', null, null], 200)).toBe(true);
    expect(propInnerAllowed(['6ft', null, null], 250)).toBe(false); // thick
    expect(propInnerAllowed(['6ft', '5ft', null], 200)).toBe(false); // double
  });

  it('customConfigFrom coerces extension + prop-inner off a double', () => {
    const c = customConfigFrom(['6ft', '5ft', null], '500mm', 'propInner', 200, 'hollow');
    expect(c).not.toBeNull();
    expect(c!.frames).toEqual(['6ft', '5ft']);
    expect(c!.rocket).toBe('none');
    expect(c!.baseType).toBe('flatJack');
    expect(c!.label).toBe('Double · 6Ft + 5Ft');
  });

  it('customConfigFrom coerces prop-inner off a thick single but keeps a legal single', () => {
    expect(customConfigFrom(['6ft', null, null], '500mm', 'propInner', 250, 'hollow')!.baseType).toBe('flatJack');
    const legal = customConfigFrom(['6ft', null, null], '500mm', 'propInner', 200, 'hollow')!;
    expect(legal.rocket).toBe('500mm');
    expect(legal.baseType).toBe('propInner');
  });

  it('customConfigFrom coerces the rocket off when the jacks are solid', () => {
    const c = customConfigFrom(['6ft', null, null], '500mm', 'flatJack', 200, 'solid')!;
    expect(c.rocket).toBe('none');
  });

  it('returns null until a bottom frame is chosen', () => {
    expect(customConfigFrom(EMPTY_SLOTS, 'none', 'flatJack', 200, 'hollow')).toBeNull();
  });
});
