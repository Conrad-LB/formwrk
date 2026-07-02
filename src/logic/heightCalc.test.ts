import { describe, it, expect } from 'vitest';
import { CONFIGURATIONS, CONFIG_BY_ID } from './configurations';
import {
  calcHeightRange,
  isAvailable,
  isAvailableForSlab,
  isAvailableForJack,
  isConfigValidForInputs,
  currentHeight,
  isThickSlab,
  allocateExtensionsToTarget,
} from './heightCalc';
import {
  simplestValidConfig,
  simplestAvailableConfig,
  validConfigsForInputs,
  validConfigsRanked,
  configsForSlab,
  isOptimalEligible,
  engineeringBadgeLabel,
} from './catalogue';
import type { JackType } from './frameData';

// A representative thin and thick slab thickness.
const THIN = 200;
const THICK = 250;

/**
 * Expected [min, max] taken DIRECTLY from Formwork_Material_Selection_v3.xlsx —
 * the spreadsheet acting as the test oracle, for both jack types and both slab bands.
 * Configs absent from a table are unavailable there (Prop Inner when thick; rocket
 * configs when solid) and are asserted unavailable separately.
 */
const HOLLOW_THIN: Record<string, [number, number]> = {
  's-3ft-fj': [1332, 2382],
  's-4ft-fj': [1636, 2686],
  's-5ft-fj': [1940, 2990],
  's-6ft-fj': [2247, 3297],
  's-6ft-500-fj': [2747, 3797],
  's-7ft-fj': [2551, 3601],
  's-7ft-300-fj': [2851, 3901],
  's-7ft-500-fj': [3051, 4101],
  's-6ft-pi': [2497, 3747],
  's-6ft-300-pi': [2797, 4047],
  's-6ft-500-pi': [2997, 4247],
  's-7ft-pi': [2801, 4051],
  's-7ft-300-pi': [3101, 4351],
  's-7ft-500-pi': [3301, 4551],
  'd-4-6': [3466, 4516],
  'd-5-6': [3770, 4820],
  'd-5-7': [4074, 5124],
  'd-6-6': [4077, 5127],
  'd-6-7': [4381, 5431],
  'd-7-7': [4685, 5735],
  't-3-3-3': [3162, 4012],
  't-3-3-4': [3466, 4316],
  't-3-5-5': [4378, 5228],
  't-4-5-5': [4682, 5532],
  't-5-5-5': [4986, 5836],
  't-5-5-6': [5293, 6143],
  't-5-6-6': [5600, 6450],
  't-6-6-6': [5907, 6757],
};

const SOLID_THIN: Record<string, [number, number]> = {
  's-3ft-fj': [1332, 2082],
  's-4ft-fj': [1636, 2386],
  's-5ft-fj': [1940, 2690],
  's-6ft-fj': [2247, 2997],
  's-7ft-fj': [2551, 3301],
  's-6ft-pi': [2497, 3597],
  's-7ft-pi': [2801, 3901],
  'd-4-6': [3466, 4216],
  'd-5-6': [3770, 4520],
  'd-5-7': [4074, 4824],
  'd-6-6': [4077, 4827],
  'd-6-7': [4381, 5131],
  'd-7-7': [4685, 5435],
  't-3-3-3': [3162, 3912],
  't-3-3-4': [3466, 4216],
  't-3-5-5': [4378, 5128],
  't-4-5-5': [4682, 5432],
  't-5-5-5': [4986, 5736],
  't-5-5-6': [5293, 6043],
  't-5-6-6': [5600, 6350],
  't-6-6-6': [5907, 6657],
};

const HOLLOW_THICK: Record<string, [number, number]> = {
  's-3ft-fj': [1332, 1932],
  's-4ft-fj': [1636, 2236],
  's-5ft-fj': [1940, 2540],
  's-6ft-fj': [2247, 2847],
  's-6ft-500-fj': [2747, 3347],
  's-7ft-fj': [2551, 3151],
  's-7ft-300-fj': [2851, 3451],
  's-7ft-500-fj': [3051, 3651],
  'd-4-6': [3466, 3916],
  'd-5-6': [3770, 4220],
  'd-5-7': [4074, 4524],
  'd-6-6': [4077, 4527],
  'd-6-7': [4381, 4831],
  'd-7-7': [4685, 5135],
  't-3-3-3': [3162, 3612],
  't-3-3-4': [3466, 3916],
  't-3-5-5': [4378, 4828],
  't-4-5-5': [4682, 5132],
  't-5-5-5': [4986, 5436],
  't-5-5-6': [5293, 5743],
  't-5-6-6': [5600, 6050],
  't-6-6-6': [5907, 6357],
};

const SOLID_THICK: Record<string, [number, number]> = {
  's-3ft-fj': [1332, 1782],
  's-4ft-fj': [1636, 2086],
  's-5ft-fj': [1940, 2390],
  's-6ft-fj': [2247, 2697],
  's-7ft-fj': [2551, 3001],
  'd-4-6': [3466, 3916],
  'd-5-6': [3770, 4220],
  'd-5-7': [4074, 4524],
  'd-6-6': [4077, 4527],
  'd-6-7': [4381, 4831],
  'd-7-7': [4685, 5135],
  't-3-3-3': [3162, 3612],
  't-3-3-4': [3466, 3916],
  't-3-5-5': [4378, 4828],
  't-4-5-5': [4682, 5132],
  't-5-5-5': [4986, 5436],
  't-5-5-6': [5293, 5743],
  't-5-6-6': [5600, 6050],
  't-6-6-6': [5907, 6357],
};

const ORACLES: Array<[string, Record<string, [number, number]>, number, JackType]> = [
  ['hollow thin', HOLLOW_THIN, THIN, 'hollow'],
  ['solid thin', SOLID_THIN, THIN, 'solid'],
  ['hollow thick', HOLLOW_THICK, THICK, 'hollow'],
  ['solid thick', SOLID_THICK, THICK, 'solid'],
];

describe('catalogue shape', () => {
  it('has 28 canonical configs (14 singles + 6 doubles + 8 triples)', () => {
    expect(CONFIGURATIONS).toHaveLength(28);
    expect(CONFIGURATIONS.filter((c) => c.frames.length === 1)).toHaveLength(14);
    expect(CONFIGURATIONS.filter((c) => c.frames.length === 2)).toHaveLength(6);
    expect(CONFIGURATIONS.filter((c) => c.frames.length === 3)).toHaveLength(8);
  });

  it('has unique ids', () => {
    expect(new Set(CONFIGURATIONS.map((c) => c.id)).size).toBe(28);
  });

  it('availability tables match the sheet: hollow thin 28, solid thin 21, hollow thick 22, solid thick 19', () => {
    expect(configsForSlab(THIN, 'hollow')).toHaveLength(28);
    expect(configsForSlab(THIN, 'solid')).toHaveLength(21); // minus 7 rocket configs
    expect(configsForSlab(THICK, 'hollow')).toHaveLength(22); // minus 6 Prop Inner
    expect(configsForSlab(THICK, 'solid')).toHaveLength(19); // minus PI + minus 3 FJ rocket configs
  });
});

for (const [name, oracle, thickness, jackType] of ORACLES) {
  describe(`calcHeightRange — ${name} matches the v3 spreadsheet`, () => {
    for (const [id, [min, max]] of Object.entries(oracle)) {
      it(`${id}: ${min}..${max}`, () => {
        const r = calcHeightRange(CONFIG_BY_ID[id], thickness, jackType);
        expect(r.min).toBe(min);
        expect(r.max).toBe(max);
      });
    }
  });
}

describe('slab threshold + availability', () => {
  it('221mm is thick (boundary inclusive)', () => {
    expect(isThickSlab(220)).toBe(false);
    expect(isThickSlab(221)).toBe(true);
  });

  it('Prop Inner unavailable for thick, available for thin', () => {
    expect(isAvailableForSlab(CONFIG_BY_ID['s-6ft-pi'], THIN)).toBe(true);
    expect(isAvailableForSlab(CONFIG_BY_ID['s-6ft-pi'], THICK)).toBe(false);
  });

  it('rockets require hollow jacks', () => {
    expect(isAvailableForJack(CONFIG_BY_ID['s-6ft-500-fj'], 'hollow')).toBe(true);
    expect(isAvailableForJack(CONFIG_BY_ID['s-6ft-500-fj'], 'solid')).toBe(false);
    expect(isAvailableForJack(CONFIG_BY_ID['s-6ft-fj'], 'solid')).toBe(true);
    expect(isAvailable(CONFIG_BY_ID['s-7ft-300-pi'], THIN, 'solid')).toBe(false);
  });

  it('a thick Prop Inner / solid rocket config is never valid even within a nominal range', () => {
    expect(isConfigValidForInputs(CONFIG_BY_ID['s-6ft-pi'], 3000, THICK, 'hollow')).toBe(false);
    expect(isConfigValidForInputs(CONFIG_BY_ID['s-7ft-500-fj'], 3500, THIN, 'solid')).toBe(false);
  });
});

describe('currentHeight = min at min extensions, = max at max extensions', () => {
  it('6ft FJ endpoints reproduce the range for both jack types', () => {
    const c = CONFIG_BY_ID['s-6ft-fj'];
    for (const jt of ['hollow', 'solid'] as JackType[]) {
      const r = calcHeightRange(c, THIN, jt);
      expect(currentHeight(c, r.uHeadMin, r.baseMin)).toBe(r.min);
      expect(currentHeight(c, r.uHeadMax, r.baseMax)).toBe(r.max);
    }
  });
});

describe('Optimal policy: single -> single+rocket -> double; PI + triples never optimal', () => {
  it('3000mm thin hollow -> 6ft Flat Jack (plain single beats rocketed single)', () => {
    expect(simplestValidConfig(3000, THIN, 'hollow')?.id).toBe('s-6ft-fj');
  });

  it('3600mm thick hollow -> 7ft+500 (single + rocket beats the 4+6 double)', () => {
    // Both s-7ft-500-fj [3051,3651] and d-4-6 [3466,3916] are valid at 3600 thick.
    expect(isConfigValidForInputs(CONFIG_BY_ID['d-4-6'], 3600, THICK, 'hollow')).toBe(true);
    expect(simplestValidConfig(3600, THICK, 'hollow')?.id).toBe('s-7ft-500-fj');
  });

  it('3700mm thick hollow -> Double 4ft+6ft (the gap the double was added to close)', () => {
    expect(simplestValidConfig(3700, THICK, 'hollow')?.id).toBe('d-4-6');
  });

  it('5000mm thin hollow -> the smallest valid double', () => {
    expect(simplestValidConfig(5000, THIN, 'hollow')?.id).toBe('d-5-7');
  });

  it('a Prop Inner is never optimal even when it is the only single that fits', () => {
    // 4300mm thin hollow: several PI singles are valid; d-4-6 [3466,4516] is also valid.
    expect(isConfigValidForInputs(CONFIG_BY_ID['s-7ft-300-pi'], 4300, THIN, 'hollow')).toBe(true);
    const best = simplestValidConfig(4300, THIN, 'hollow');
    expect(best?.baseType).toBe('flatJack');
    expect(best?.id).toBe('d-4-6');
  });

  it('returns null when only engineering-flagged configs service the height (solid thick gap)', () => {
    // 3200mm thick solid: singles top out at 3001, d-4-6 starts 3466 — only t-3-3-3 fits.
    expect(validConfigsForInputs(3200, THICK, 'solid').map((c) => c.id)).toEqual(['t-3-3-3']);
    expect(simplestValidConfig(3200, THICK, 'solid')).toBeNull();
  });

  it('returns null below the smallest min', () => {
    expect(simplestValidConfig(500, THIN, 'hollow')).toBeNull();
  });

  it('ranked list orders: FJ single < FJ single+rocket < double < PI single < PI+rocket < triple', () => {
    const ids = validConfigsRanked(3500, THIN, 'hollow').map((c) => c.id);
    const pos = (id: string) => ids.indexOf(id);
    expect(pos('s-7ft-fj')).toBeGreaterThanOrEqual(0); // plain single valid at 3500
    expect(pos('s-7ft-fj')).toBeLessThan(pos('s-6ft-500-fj')); // plain < rocketed
    expect(pos('s-6ft-500-fj')).toBeLessThan(pos('d-4-6')); // rocketed single < double
    expect(pos('d-4-6')).toBeLessThan(pos('s-6ft-pi')); // double < PI
    expect(pos('s-6ft-pi')).toBeLessThan(pos('s-6ft-300-pi')); // PI plain < PI + rocket
    expect(pos('t-3-3-4')).toBe(ids.length - 1); // triples last
  });

  it('every returned optimal is valid and optimal-eligible', () => {
    for (const jt of ['hollow', 'solid'] as JackType[]) {
      for (const t of [THIN, THICK]) {
        for (const h of [1500, 2500, 3500, 4500, 5500]) {
          const c = simplestValidConfig(h, t, jt);
          if (c) {
            expect(isConfigValidForInputs(c, h, t, jt)).toBe(true);
            expect(isOptimalEligible(c)).toBe(true);
          }
        }
      }
    }
  });
});

describe('engineeringBadgeLabel: single source for the Select-list and Optimal-view badges', () => {
  it('is null for every Optimal-eligible config (FJ singles + doubles)', () => {
    for (const c of CONFIGURATIONS.filter(isOptimalEligible)) {
      expect(engineeringBadgeLabel(c)).toBeNull();
    }
  });

  it('flags Prop Inner as "TWE required"', () => {
    expect(engineeringBadgeLabel(CONFIG_BY_ID['s-6ft-pi'])).toBe('TWE required');
    expect(engineeringBadgeLabel(CONFIG_BY_ID['s-6ft-500-pi'])).toBe('TWE required');
  });

  it('flags triples as "Engineering required"', () => {
    expect(engineeringBadgeLabel(CONFIG_BY_ID['t-3-3-3'])).toBe('Engineering required');
  });
});

describe('simplestAvailableConfig (safe fallback)', () => {
  it('is a Flat Jack single for every slab band and jack type', () => {
    for (const jt of ['hollow', 'solid'] as JackType[]) {
      for (const t of [THIN, THICK]) {
        const c = simplestAvailableConfig(t, jt);
        expect(c.baseType).toBe('flatJack');
        expect(c.frames.length).toBe(1);
        expect(c.rocket).toBe('none');
      }
    }
  });
});

describe('allocateExtensionsToTarget (auto-adjust the assembly to the soffit)', () => {
  it('hits the target exactly for every hollow-thin config + representative targets', () => {
    for (const id of Object.keys(HOLLOW_THIN)) {
      const c = CONFIG_BY_ID[id];
      const r = calcHeightRange(c, THIN, 'hollow');
      for (const target of [r.min, Math.round((r.min + r.max) / 2), r.max]) {
        const { uHeadExtension, baseExtension } = allocateExtensionsToTarget(c, THIN, 'hollow', target);
        expect(uHeadExtension).toBeGreaterThanOrEqual(r.uHeadMin);
        expect(uHeadExtension).toBeLessThanOrEqual(r.uHeadMax);
        expect(baseExtension).toBeGreaterThanOrEqual(r.baseMin);
        expect(baseExtension).toBeLessThanOrEqual(r.baseMax);
        expect(currentHeight(c, uHeadExtension, baseExtension)).toBe(target);
      }
    }
  });

  it('clamps to the nearest end when the target is outside the range', () => {
    const c = CONFIG_BY_ID['s-6ft-fj'];
    const r = calcHeightRange(c, THIN, 'solid');
    const below = allocateExtensionsToTarget(c, THIN, 'solid', r.min - 500);
    expect(currentHeight(c, below.uHeadExtension, below.baseExtension)).toBe(r.min);
    const above = allocateExtensionsToTarget(c, THIN, 'solid', r.max + 500);
    expect(currentHeight(c, above.uHeadExtension, above.baseExtension)).toBe(r.max);
  });
});
