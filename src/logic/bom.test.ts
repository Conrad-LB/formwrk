import { describe, it, expect } from 'vitest';
import { buildBom, type BomSection } from './bom';
import { CONFIG_BY_ID } from './configurations';
import { calcHeightRange } from './heightCalc';
import { BAY_QUANTITIES } from './bayLayout';

const bomFor = (id: string, thickness = 200): BomSection[] => {
  const c = CONFIG_BY_ID[id];
  return buildBom(c, calcHeightRange(c, thickness, 'hollow'), 'hollow');
};
const findItem = (sections: BomSection[], name: string) =>
  sections.flatMap((s) => s.items).find((i) => i.name === name);

describe('BOM completeness + scene parity (Finding 2)', () => {
  it('joist quantity equals the shared scene joist count', () => {
    expect(findItem(bomFor('s-6ft-fj'), 'LVL Joist')?.qty).toBe(BAY_QUANTITIES.joists);
  });

  it('ply and bearer carry quantities', () => {
    const s = bomFor('s-6ft-fj');
    expect(findItem(s, 'Form-Ply deck')?.qty).toBe(BAY_QUANTITIES.plySheets);
    expect(findItem(s, 'LVL Bearer')?.qty).toBe(BAY_QUANTITIES.bearers);
  });

  it('every core component has a positive quantity for singles, doubles and triples', () => {
    for (const id of ['s-6ft-fj', 'd-5-6', 't-3-3-3']) {
      const s = bomFor(id);
      for (const name of ['U-Head Screwjack', 'LVL Bearer', 'LVL Joist', 'Form-Ply deck']) {
        expect(findItem(s, name)?.qty ?? 0).toBeGreaterThan(0);
      }
      expect(s.find((sec) => sec.title === 'Frames')?.items.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('frame and cross-brace quantities scale with the number of levels', () => {
    const braceSingle = findItem(bomFor('s-6ft-fj'), 'Diagonal cross-brace')?.qty ?? 0;
    const braceTriple = findItem(bomFor('t-6-6-6'), 'Diagonal cross-brace')?.qty ?? 0;
    expect(braceSingle).toBe(BAY_QUANTITIES.crossBracesPerLevel * 1);
    expect(braceTriple).toBe(BAY_QUANTITIES.crossBracesPerLevel * 3);

    // 6Ft Frame ×6 for a 6+6+6 triple (2 per level × 3 levels)
    expect(findItem(bomFor('t-6-6-6'), '6Ft Frame')?.qty).toBe(6);
  });
});
