import { describe, it, expect } from 'vitest';
import { encodeShare, decodeShare, type ShareState } from './shareState';

describe('shareState: round-trips', () => {
  it('inputs view survives encode -> decode', () => {
    const s: ShareState = {
      panelMode: 'inputs',
      viewMode: 'exploded',
      slabThickness: 250,
      jackType: 'solid',
      uHead: 203,
      base: 500,
      slabHeight: 3500,
      configId: 's-7ft-pi',
    };
    const back = decodeShare('#' + encodeShare(s));
    expect(back).toEqual(s);
  });

  it('custom view survives encode -> decode', () => {
    const s: ShareState = {
      panelMode: 'custom',
      viewMode: 'packed',
      slabThickness: 200,
      jackType: 'hollow',
      uHead: 300,
      base: 120,
      frames: ['6ft', '5ft'],
      rocket: 'none',
      baseType: 'flatJack',
    };
    const back = decodeShare('#' + encodeShare(s));
    expect(back).toEqual(s);
  });
});

describe('shareState: validation', () => {
  it('returns null for an empty / garbage hash', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#')).toBeNull();
    expect(decodeShare('#pm=nonsense')).toBeNull();
  });

  it('drops invalid enums and non-finite numbers, keeping safe defaults', () => {
    const back = decodeShare('#pm=custom&vm=spinning&st=abc&jt=titanium&uh=NaN&ba=50&fr=6ft-9ft-5ft&rk=999mm&bt=hoverjack');
    expect(back).not.toBeNull();
    expect(back!.viewMode).toBe('assembled'); // bad vm -> default
    expect(back!.slabThickness).toBe(200); // bad st -> default
    expect(back!.jackType).toBe('hollow'); // bad jt -> default
    expect(back!.uHead).toBe(0); // bad uh -> default
    expect(back!.base).toBe(50);
    expect(back!.frames).toEqual(['6ft', '5ft']); // '9ft' filtered out
    expect(back!.rocket).toBeUndefined(); // invalid rocket dropped
    expect(back!.baseType).toBeUndefined(); // invalid base dropped
  });

  it('inputs config id passes through verbatim (store validates it)', () => {
    const back = decodeShare('#pm=inputs&vm=assembled&st=200&uh=100&ba=50&cfg=made-up-id');
    expect(back!.configId).toBe('made-up-id');
  });
});
