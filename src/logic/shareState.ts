/**
 * Shareable-link state — encode the current view into the URL hash and back, so a
 * configuration can be linked or bookmarked. This is NOT persistence (nothing is written
 * to local/session storage): the hash is user-facing, shareable state that only exists in
 * the URL. Only the ACTIVE panel is captured; opening a link restores that panel and view,
 * leaving the other panel at its default.
 */

import { FRAME_SIZES } from './customBuild';
import type { PanelMode, ViewMode } from '../store/formworkStore';
import type { BaseType } from './configurations';
import type { JackType } from './frameData';

export interface ShareState {
  panelMode: PanelMode;
  viewMode: ViewMode;
  slabThickness: number;
  jackType: JackType;
  uHead: number;
  base: number;
  // Inputs panel:
  slabHeight?: number;
  configId?: string;
  // Custom panel:
  frames?: string[]; // filled slots, bottom -> top
  rocket?: string;
  baseType?: BaseType;
}

const VIEW_MODES: ViewMode[] = ['assembled', 'exploded', 'packed'];
const JACK_TYPES: JackType[] = ['hollow', 'solid'];
const ROCKETS = ['none', '300mm', '500mm'];
const BASES: BaseType[] = ['flatJack', 'propInner'];
const FRAMES: readonly string[] = FRAME_SIZES;

const int = (v: string | null): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

/** Encode the active view into a compact URL-hash string (no leading '#'). */
export function encodeShare(s: ShareState): string {
  const p = new URLSearchParams();
  p.set('pm', s.panelMode);
  p.set('vm', s.viewMode);
  p.set('st', String(Math.round(s.slabThickness)));
  p.set('jt', s.jackType);
  p.set('uh', String(Math.round(s.uHead)));
  p.set('ba', String(Math.round(s.base)));
  if (s.panelMode === 'inputs') {
    if (s.slabHeight != null) p.set('sh', String(Math.round(s.slabHeight)));
    if (s.configId) p.set('cfg', s.configId);
  } else {
    if (s.frames && s.frames.length) p.set('fr', s.frames.join('-'));
    if (s.rocket) p.set('rk', s.rocket);
    if (s.baseType) p.set('bt', s.baseType);
  }
  return p.toString();
}

/** Decode a URL-hash string into a validated ShareState, or null if it carries no view. */
export function decodeShare(hash: string): ShareState | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  const pm = p.get('pm');
  if (pm !== 'inputs' && pm !== 'custom') return null;

  const vmRaw = p.get('vm') as ViewMode | null;
  const viewMode: ViewMode = vmRaw && VIEW_MODES.includes(vmRaw) ? vmRaw : 'assembled';
  const slabThickness = int(p.get('st')) ?? 200;
  const jtRaw = p.get('jt') as JackType | null;
  const jackType: JackType = jtRaw && JACK_TYPES.includes(jtRaw) ? jtRaw : 'hollow';
  const uHead = int(p.get('uh')) ?? 0;
  const base = int(p.get('ba')) ?? 0;

  const s: ShareState = { panelMode: pm, viewMode, slabThickness, jackType, uHead, base };

  if (pm === 'inputs') {
    const sh = int(p.get('sh'));
    if (sh != null) s.slabHeight = sh;
    const cfg = p.get('cfg');
    if (cfg) s.configId = cfg; // validated against the catalogue by the store
  } else {
    const fr = p.get('fr');
    if (fr) {
      const frames = fr.split('-').filter((f) => FRAMES.includes(f));
      if (frames.length) s.frames = frames;
    }
    const rk = p.get('rk');
    if (rk && ROCKETS.includes(rk)) s.rocket = rk;
    const bt = p.get('bt') as BaseType | null;
    if (bt && BASES.includes(bt)) s.baseType = bt;
  }
  return s;
}
