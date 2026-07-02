import { describe, it, expect, beforeEach } from 'vitest';
import { useFormworkStore } from './formworkStore';
import { CONFIG_BY_ID } from '../logic/configurations';

const get = () => useFormworkStore.getState();

beforeEach(() => {
  // Reset to a known baseline: Inputs mode, no custom build / saved workspaces,
  // thin 200mm slab, 2800mm soffit, hollow jacks, Build view.
  useFormworkStore.setState({
    panelMode: 'inputs',
    viewMode: 'assembled',
    customFrames: [null, null, null],
    customRocket: 'none',
    customBaseType: 'flatJack',
    savedInputs: null,
    savedCustom: null,
  });
  get().setJackType('hollow');
  get().setSlabThickness(200);
  get().setSlabHeight(2800);
});

describe('store: slab-availability invariant (Finding 1)', () => {
  it('a Prop Inner never stays active on a thick slab, even when no config services the height', () => {
    get().setSlabHeight(4100);
    get().setConfig(CONFIG_BY_ID['s-6ft-500-pi']); // a thin Prop Inner config (valid at 4100 thin)
    expect(get().config.id).toBe('s-6ft-500-pi');

    get().setSlabHeight(7000); // nothing services this height
    get().setSlabThickness(250); // thick
    expect(get().config.baseType).not.toBe('propInner');
    expect(get().available).toBe(true); // active config is always permitted for the slab
  });

  it('setConfig coerces away a Prop Inner that is prohibited for a thick slab', () => {
    get().setSlabThickness(250); // thick -> Prop Inner unavailable
    get().setConfig(CONFIG_BY_ID['s-6ft-pi']); // attempt a prohibited config
    expect(get().config.baseType).not.toBe('propInner');
    expect(get().available).toBe(true);
  });

  it('isValid requires BOTH availability and height-in-range; flags no-valid-option', () => {
    get().setSlabHeight(7000);
    expect(get().hasValidOption).toBe(false);
    expect(get().isValid).toBe(false);
  });
});

describe('store: input hardening (Finding 7)', () => {
  it('rejects non-finite slab inputs (Infinity / NaN)', () => {
    const h = get().slabHeight;
    get().setSlabHeight(Infinity);
    get().setSlabHeight(NaN);
    expect(get().slabHeight).toBe(h);

    const t = get().slabThickness;
    get().setSlabThickness(Infinity);
    expect(get().slabThickness).toBe(t);
  });

  it('clamps absurdly large values to the supported maximum (no Infinity into the scene)', () => {
    get().setSlabHeight(999999);
    expect(Number.isFinite(get().slabHeight)).toBe(true);
    expect(get().slabHeight).toBeLessThanOrEqual(20000);
  });

  it('clamps slab thickness to the 450mm design maximum (TWE note territory)', () => {
    get().setSlabThickness(600);
    expect(get().slabThickness).toBe(450);
  });

  it('rejects non-finite extension values', () => {
    const u = get().uHeadExtension;
    get().setUHeadExtension(Infinity);
    expect(get().uHeadExtension).toBe(u);
  });
});

describe('store: renders adjusted to the target soffit (every entry path)', () => {
  it('loads adjusted to the target (current == target, meetsTarget)', () => {
    // v3 hollow-thin jacks reach 600/600, so a 5ft single now services 2800 (smaller frames win).
    expect(get().config.id).toBe('s-5ft-fj');
    expect(get().currentHeight).toBe(2800);
    expect(get().meetsTarget).toBe(true);
  });

  it('re-allocates to reach a new target height', () => {
    get().setSlabHeight(2600);
    expect(get().currentHeight).toBe(2600);
    expect(get().meetsTarget).toBe(true);

    get().setSlabHeight(5000); // auto-assembles a double that services 5000
    expect(get().currentHeight).toBe(5000);
    expect(get().meetsTarget).toBe(true);
  });

  it('picking a config from Other renders it adjusted to the current target', () => {
    get().setSlabHeight(3500);
    get().setConfig(CONFIG_BY_ID['s-7ft-pi']); // valid alternative at 3500 thin (2801–3951)
    expect(get().config.id).toBe('s-7ft-pi');
    expect(get().currentHeight).toBe(3500);
    expect(get().meetsTarget).toBe(true);
  });

  it('allocated extensions stay within each jack’s range', () => {
    const s = get();
    expect(s.uHeadExtension).toBeGreaterThanOrEqual(s.range.uHeadMin);
    expect(s.uHeadExtension).toBeLessThanOrEqual(s.range.uHeadMax);
    expect(s.baseExtension).toBeGreaterThanOrEqual(s.range.baseMin);
    expect(s.baseExtension).toBeLessThanOrEqual(s.range.baseMax);
  });

  it('a manual drag away from the target shows not-at-target (verdict no longer green)', () => {
    get().setUHeadExtension(get().range.uHeadMin);
    get().setBaseExtension(get().range.baseMin);
    expect(get().meetsTarget).toBe(false);
    expect(get().currentHeight).toBeLessThan(get().slabHeight);
    expect(get().isValid).toBe(true); // still serviceable, just not dialled
  });

  it('when nothing services the height, the assembly sits at the nearest end (no crash)', () => {
    get().setSlabHeight(7000);
    expect(get().hasValidOption).toBe(false);
    expect(Number.isFinite(get().currentHeight)).toBe(true);
    expect(get().currentHeight).toBe(get().range.max); // closest reachable below an unreachable target
  });
});

describe('store: custom build panel', () => {
  it('switching to custom with no frame leaves the tower hidden and range empty', () => {
    get().setPanelMode('custom');
    expect(get().panelMode).toBe('custom');
    expect(get().towerVisible).toBe(false);
    expect(get().range.max).toBe(0);
  });

  it('picking a bottom frame completes the build, seated at the range minimum', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    expect(get().towerVisible).toBe(true);
    expect(get().config.frames).toEqual(['6ft']);
    expect(get().config.baseType).toBe('flatJack'); // base defaults
    expect(get().config.rocket).toBe('none'); // extension defaults
    expect(get().currentHeight).toBe(get().range.min); // jacks seated at min
  });

  it('enforces non-increasing slots and clears now-illegal frames above', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    get().setCustomSlot(1, '6ft');
    get().setCustomSlot(2, '5ft');
    expect(get().config.frames).toEqual(['6ft', '6ft', '5ft']);
    get().setCustomSlot(0, '4ft'); // 6ft/5ft above are no longer legal
    expect(get().config.frames).toEqual(['4ft']);
    expect(get().customFrames).toEqual(['4ft', null, null]);
  });

  it('coerces extension + prop inner off a double', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    get().setCustomRocket('500mm');
    get().setCustomBaseType('propInner');
    expect(get().config.rocket).toBe('500mm');
    expect(get().config.baseType).toBe('propInner');
    get().setCustomSlot(1, '5ft'); // now a double
    expect(get().config.frames).toEqual(['6ft', '5ft']);
    expect(get().config.rocket).toBe('none'); // extension coerced off
    expect(get().config.baseType).toBe('flatJack'); // prop inner coerced off
  });

  it('coerces prop inner off when the slab turns thick', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    get().setCustomBaseType('propInner');
    expect(get().config.baseType).toBe('propInner'); // single + thin: allowed
    get().setSlabThickness(250); // thick
    expect(get().config.baseType).toBe('flatJack');
  });

  it('custom jacks are draggable and clamp to the custom range', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    get().setUHeadExtension(99999); // clamps to uHeadMax
    expect(get().uHeadExtension).toBe(get().range.uHeadMax);
    get().setBaseExtension(99999); // clamps to baseMax
    expect(get().baseExtension).toBe(get().range.baseMax);
    expect(get().currentHeight).toBe(get().range.max); // both jacks maxed → top of range
  });

  it('round-trip inputs → custom → inputs restores the inputs workspace verbatim', () => {
    get().setSlabHeight(3500);
    get().setConfig(CONFIG_BY_ID['s-7ft-pi']); // an "Other" pick
    expect(get().config.id).toBe('s-7ft-pi');
    const dialled = get().currentHeight;

    get().setPanelMode('custom');
    get().setCustomSlot(0, '5ft');
    expect(get().config.frames).toEqual(['5ft']);

    get().setPanelMode('inputs');
    expect(get().panelMode).toBe('inputs');
    expect(get().config.id).toBe('s-7ft-pi'); // restored
    expect(get().slabHeight).toBe(3500);
    expect(get().currentHeight).toBe(dialled); // exact state preserved
    expect(get().towerVisible).toBe(true);
  });

  it('slab thickness is INDEPENDENT per panel', () => {
    get().setSlabThickness(260); // inputs: thick
    expect(get().slabThickness).toBe(260);

    get().setPanelMode('custom');
    expect(get().slabThickness).toBe(200); // custom keeps its own default, unaffected
    get().setSlabThickness(150);
    expect(get().slabThickness).toBe(150);

    get().setPanelMode('inputs');
    expect(get().slabThickness).toBe(260); // inputs unchanged by custom

    get().setPanelMode('custom');
    expect(get().slabThickness).toBe(150); // custom restored
  });

  it('view mode is INDEPENDENT per panel', () => {
    get().setViewMode('exploded');
    get().setPanelMode('custom');
    expect(get().viewMode).toBe('assembled'); // custom default view

    get().setViewMode('packed');
    get().setPanelMode('inputs');
    expect(get().viewMode).toBe('exploded'); // inputs restored

    get().setPanelMode('custom');
    expect(get().viewMode).toBe('packed'); // custom restored
  });

  it('a completed custom build is restored on switch-back', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '5ft');
    get().setCustomSlot(1, '5ft');
    expect(get().config.frames).toEqual(['5ft', '5ft']);
    get().setPanelMode('inputs');
    get().setPanelMode('custom');
    expect(get().towerVisible).toBe(true);
    expect(get().config.frames).toEqual(['5ft', '5ft']); // rebuilt from persisted slots
  });

  it('setConfig / setSlabHeight are no-ops while in custom mode', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    const before = get().config.id;
    get().setConfig(CONFIG_BY_ID['s-3ft-fj']);
    get().setSlabHeight(9000);
    expect(get().config.id).toBe(before);
  });
});

describe('store: jack type (hollow / solid)', () => {
  it('switching to solid never leaves a rocket config active', () => {
    get().setSlabHeight(3400); // hollow: optimal is a plain 7ft, but force a rocket config
    get().setConfig(CONFIG_BY_ID['s-6ft-500-fj']);
    expect(get().config.id).toBe('s-6ft-500-fj');
    get().setJackType('solid');
    expect(get().config.rocket).toBe('none'); // rockets are hollow-only
    expect(get().available).toBe(true);
  });

  it('solid jacks shrink ranges, so the optimal single steps up a frame size at 2800', () => {
    expect(get().config.id).toBe('s-5ft-fj'); // hollow: 5ft reaches 2990
    expect(get().range.max).toBe(2990);
    get().setJackType('solid');
    expect(get().config.id).toBe('s-6ft-fj'); // solid 5ft tops out at 2690 -> 6ft takes over
    expect(get().range.max).toBe(2997);
  });

  it('custom build coerces the rocket off when switching to solid', () => {
    get().setPanelMode('custom');
    get().setCustomSlot(0, '6ft');
    get().setCustomRocket('500mm');
    expect(get().config.rocket).toBe('500mm');
    get().setJackType('solid');
    expect(get().config.rocket).toBe('none');
  });

  it('no optimal exists in the solid thick gap; the previous config is kept (never auto-swaps onto a triple)', () => {
    get().setSlabThickness(300); // thick
    get().setJackType('solid');
    get().setSlabHeight(3200); // only t-3-3-3 services this — engineering required
    expect(get().hasValidOption).toBe(true); // a (flagged) option exists…
    expect(get().config.frames.length).toBeLessThanOrEqual(2); // …but we never auto-assemble it
  });
});

describe('store: setHeight / dialToTarget / resetView', () => {
  it('setHeight allocates the jacks to reach a height, clamped to the range', () => {
    get().setHeight(2500);
    expect(get().currentHeight).toBe(2500);
    expect(get().uHeadExtension).toBeGreaterThanOrEqual(get().range.uHeadMin);
    expect(get().baseExtension).toBeLessThanOrEqual(get().range.baseMax);

    get().setHeight(99999); // clamps to range max
    expect(get().currentHeight).toBe(get().range.max);
  });

  it('dialToTarget re-dials a drifted assembly back to the target', () => {
    get().setUHeadExtension(get().range.uHeadMin);
    get().setBaseExtension(get().range.baseMin);
    expect(get().meetsTarget).toBe(false);
    get().dialToTarget();
    expect(get().currentHeight).toBe(get().slabHeight);
    expect(get().meetsTarget).toBe(true);
  });

  it('resetView bumps the nonce', () => {
    const n = get().viewResetNonce;
    get().resetView();
    expect(get().viewResetNonce).toBe(n + 1);
  });
});

describe('store: hydrateFromShare', () => {
  it('restores an inputs workspace', () => {
    get().hydrateFromShare({
      panelMode: 'inputs',
      viewMode: 'exploded',
      slabThickness: 250,
      jackType: 'hollow',
      uHead: 200,
      base: 250,
      slabHeight: 3500,
      configId: 's-7ft-fj',
    });
    expect(get().panelMode).toBe('inputs');
    expect(get().viewMode).toBe('exploded');
    expect(get().slabThickness).toBe(250);
    expect(get().slabHeight).toBe(3500);
    expect(get().config.id).toBe('s-7ft-fj');
    expect(get().towerVisible).toBe(true);
  });

  it('restores a custom workspace and rebuilds the config from frames', () => {
    get().hydrateFromShare({
      panelMode: 'custom',
      viewMode: 'packed',
      slabThickness: 200,
      jackType: 'hollow',
      uHead: 300,
      base: 120,
      frames: ['6ft', '5ft'],
      rocket: 'none',
      baseType: 'flatJack',
    });
    expect(get().panelMode).toBe('custom');
    expect(get().viewMode).toBe('packed');
    expect(get().towerVisible).toBe(true);
    expect(get().config.frames).toEqual(['6ft', '5ft']);
  });

  it('normalizes an illegal shared frame stack (bigger frame on top) to a legal one', () => {
    get().hydrateFromShare({
      panelMode: 'custom', viewMode: 'assembled', slabThickness: 200, jackType: 'hollow', uHead: 100, base: 50,
      frames: ['3ft', '7ft'], rocket: 'none', baseType: 'flatJack',
    });
    expect(get().config.frames).toEqual(['3ft']); // 7ft over 3ft is illegal -> dropped
  });

  it('normalizes 7-7-7 (top slot cannot be 7ft) to a legal double', () => {
    get().hydrateFromShare({
      panelMode: 'custom', viewMode: 'assembled', slabThickness: 200, jackType: 'hollow', uHead: 100, base: 50,
      frames: ['7ft', '7ft', '7ft'], rocket: 'none', baseType: 'flatJack',
    });
    expect(get().config.frames).toEqual(['7ft', '7ft']); // top 7ft dropped
  });

  it('coerces a prohibited shared config for the slab (prop inner on a thick slab)', () => {
    get().hydrateFromShare({
      panelMode: 'inputs',
      viewMode: 'assembled',
      slabThickness: 260, // thick
      jackType: 'hollow',
      uHead: 100,
      base: 50,
      slabHeight: 3000,
      configId: 's-6ft-pi', // prop inner — prohibited when thick
    });
    expect(get().config.baseType).not.toBe('propInner');
  });
});

describe('store: view mode (Build / Explode / Pack)', () => {
  it('defaults to the assembled view', () => {
    expect(get().viewMode).toBe('assembled');
  });

  it('switches modes and is purely presentational (no effect on the assembly)', () => {
    const before = {
      config: get().config.id,
      currentHeight: get().currentHeight,
      uHead: get().uHeadExtension,
      base: get().baseExtension,
    };
    get().setViewMode('exploded');
    expect(get().viewMode).toBe('exploded');
    get().setViewMode('packed');
    expect(get().viewMode).toBe('packed');
    get().setViewMode('assembled');
    expect(get().viewMode).toBe('assembled');
    // The view mode must not perturb the configuration or the height solve.
    expect(get().config.id).toBe(before.config);
    expect(get().currentHeight).toBe(before.currentHeight);
    expect(get().uHeadExtension).toBe(before.uHead);
    expect(get().baseExtension).toBe(before.base);
  });
});
