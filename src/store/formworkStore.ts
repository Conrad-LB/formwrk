/**
 * Global scene + configuration state (zustand).
 *
 * The Left Rail has two INDEPENDENT tools, selected by `panelMode`:
 *   - 'inputs': enter a target slab height + thickness → the tool picks a configuration
 *     and dials the screwjacks to the target.
 *   - 'custom': hand-build a frame set (no target) → the tool reports its height range.
 *
 * The two panels are fully independent workspaces. The fields the scene renders
 * (`config`, jacks, `slabThickness`, `jackType`, `viewMode`, …) always reflect the ACTIVE
 * panel. On a panel switch the active fields are snapshotted into the outgoing panel's
 * slot (`savedInputs` / `savedCustom`) and the incoming panel's snapshot is restored
 * verbatim (or its default on first visit). Nothing is shared between the two — changing
 * the slab thickness, jack type or the view in one panel never touches the other.
 *
 * Within Inputs, every mutation goes through the same resolver so two invariants hold:
 *   1. the active config is ALWAYS available for the current slab + jack type (a Prop
 *      Inner can never remain active on a thick slab; a rocket never on solid jacks), and
 *   2. derived `isValid` reflects BOTH availability and the height range.
 */

import { create } from 'zustand';
import { CONFIG_BY_ID, type FrameConfig, type BaseType } from '../logic/configurations';
import {
  calcHeightRange,
  currentHeight as calcCurrentHeight,
  isAvailable,
  allocateExtensionsToTarget,
  type HeightRange,
} from '../logic/heightCalc';
import { simplestValidConfig, simplestAvailableConfig, validConfigsForInputs } from '../logic/catalogue';
import {
  customConfigFrom,
  applySlot,
  sizeAllowed,
  extensionAllowed,
  propInnerAllowed,
  EMPTY_SLOTS,
  type Slots,
} from '../logic/customBuild';
import type { ShareState } from '../logic/shareState';
import { INPUT_LIMITS, type JackType } from '../logic/frameData';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The raw rocket selection, downgraded to 'none' once it's no longer selectable (switching
 * to solid jacks, or building past a single frame). Without this, `customConfigFrom` still
 * coerces the ACTIVE config's rocket off correctly, but the raw `customRocket` field would
 * survive untouched and silently reassert itself the moment the build becomes eligible again
 * (e.g. switching back to hollow) — and would leak a stale value into the share link.
 */
function effectiveCustomRocket(frames: Slots, jackType: JackType, rocket: string): string {
  return extensionAllowed(frames, jackType) ? rocket : 'none';
}

/**
 * The raw base-type selection, downgraded to 'flatJack' once Prop Inner is no longer
 * selectable (switching to a thick slab, or building past a single frame). Same rationale
 * as effectiveCustomRocket — without this, a Prop Inner pick silently reasserts itself the
 * moment the build becomes thin+single again, and leaks a stale value into the share link.
 */
function effectiveCustomBaseType(slots: Slots, slabThickness: number, baseType: BaseType): BaseType {
  return baseType === 'propInner' && !propInnerAllowed(slots, slabThickness) ? 'flatJack' : baseType;
}

/**
 * How the tower is presented in the 3D viewport:
 *  - 'assembled': the erected shoring tower (the default working view),
 *  - 'exploded':  every component type separated along the build axis + labelled,
 *  - 'packed':    the tower ghosted, with the materials shown stored in the yard.
 */
export type ViewMode = 'assembled' | 'exploded' | 'packed';

/**
 * Which Left-Rail panel is active:
 *  - 'inputs': enter a target slab height + thickness → the tool picks a configuration,
 *  - 'custom': hand-build a frame set (no target) → the tool reports its height range.
 */
export type PanelMode = 'inputs' | 'custom';

interface Derived {
  range: ReturnType<typeof calcHeightRange>;
  currentHeight: number;
  /** Active config is permitted for the current slab thickness + jack type. */
  available: boolean;
  /** Some configuration in the catalogue services the entered height (incl. engineering-flagged ones). */
  hasValidOption: boolean;
  /** Target slab height falls within the active config's range AND it's available. */
  isValid: boolean;
  /** Live current height equals the target (within 2mm). */
  meetsTarget: boolean;
}

function derive(
  config: FrameConfig,
  slabThickness: number,
  jackType: JackType,
  slabHeight: number,
  uHeadExtension: number,
  baseExtension: number,
): Derived {
  const range = calcHeightRange(config, slabThickness, jackType);
  const currentHeight = calcCurrentHeight(config, uHeadExtension, baseExtension);
  const available = isAvailable(config, slabThickness, jackType);
  const hasValidOption = validConfigsForInputs(slabHeight, slabThickness, jackType).length > 0;
  return {
    range,
    currentHeight,
    available,
    hasValidOption,
    isValid: available && slabHeight >= range.min && slabHeight <= range.max,
    meetsTarget: Math.abs(currentHeight - slabHeight) <= 2,
  };
}

const EMPTY_RANGE: HeightRange = { min: 0, max: 0, uHeadMin: 0, uHeadMax: 0, baseMin: 0, baseMax: 0 };

/**
 * Resolve the full INPUTS assembly for a set of inputs:
 *  - prefer the Optimal (simplest valid, supplier-backed) config for the height,
 *  - else keep the previous config IF it's still available for the slab + jack type
 *    (an engineering-flagged pick from Select survives — we never auto-swap ONTO one),
 *  - else fall back to the simplest available config (never a prohibited one),
 * then ALLOCATE the screwjacks so the assembly is rendered adjusted to the target
 * soffit (clamped to the config's range). Manual drags afterward are preserved.
 */
function resolveInputs(slabHeight: number, slabThickness: number, jackType: JackType, prevConfig: FrameConfig) {
  const config =
    simplestValidConfig(slabHeight, slabThickness, jackType) ??
    (isAvailable(prevConfig, slabThickness, jackType)
      ? prevConfig
      : simplestAvailableConfig(slabThickness, jackType));
  const { uHeadExtension, baseExtension } = allocateExtensionsToTarget(config, slabThickness, jackType, slabHeight);
  return {
    slabHeight,
    slabThickness,
    jackType,
    config,
    uHeadExtension,
    baseExtension,
    towerVisible: true,
    ...derive(config, slabThickness, jackType, slabHeight, uHeadExtension, baseExtension),
  };
}

/**
 * Resolve the CUSTOM assembly from the current slot selections + slab thickness + jack
 * type, seating the jacks at `desiredUHead`/`desiredBase` (clamped to the config's
 * range). While no bottom frame is chosen the build is incomplete → `towerVisible =
 * false` and the height range reads empty; `fallbackConfig` is kept only so the (hidden)
 * scene has something to hold. Custom has no target height, so target-derived flags are
 * set to safe values.
 */
function resolveCustom(
  frames: Slots,
  rocket: string,
  baseType: BaseType,
  slabThickness: number,
  jackType: JackType,
  desiredUHead: number,
  desiredBase: number,
  fallbackConfig: FrameConfig,
) {
  const config = customConfigFrom(frames, rocket, baseType, slabThickness, jackType);
  if (!config) {
    return {
      config: fallbackConfig,
      uHeadExtension: 0,
      baseExtension: 0,
      range: EMPTY_RANGE,
      currentHeight: 0,
      available: true,
      hasValidOption: false,
      isValid: false,
      meetsTarget: false,
      towerVisible: false,
    };
  }
  const range = calcHeightRange(config, slabThickness, jackType);
  const uHeadExtension = clamp(Math.round(desiredUHead), range.uHeadMin, range.uHeadMax);
  const baseExtension = clamp(Math.round(desiredBase), range.baseMin, range.baseMax);
  return {
    config,
    uHeadExtension,
    baseExtension,
    range,
    currentHeight: calcCurrentHeight(config, uHeadExtension, baseExtension),
    available: true,
    hasValidOption: true,
    isValid: true,
    meetsTarget: false,
    towerVisible: true,
  };
}

/** The full active-field set of one panel, saved when it's inactive. */
type PanelSnapshot = Derived & {
  slabHeight: number;
  slabThickness: number;
  /** The raw value the user typed, pre-clamp — lets the UI warn accurately when it
   *  exceeds the design maximum, instead of comparing the already-clamped value. */
  slabThicknessRaw: number;
  jackType: JackType;
  config: FrameConfig;
  uHeadExtension: number;
  baseExtension: number;
  viewMode: ViewMode;
  towerVisible: boolean;
};

export interface FormworkState extends Derived {
  // Inputs
  slabHeight: number; // mm, floor to soffit
  slabThickness: number; // mm, clamped to INPUT_LIMITS.slabThicknessMax
  slabThicknessRaw: number; // mm, the unclamped value the user typed (for the TWE warning)
  jackType: JackType; // hollow (tubular) or solid-stem screwjacks

  // Active configuration + live adjustable extensions (mm)
  config: FrameConfig;
  uHeadExtension: number;
  baseExtension: number;

  // Presentation
  viewMode: ViewMode;
  /** Which Left-Rail panel is active (Inputs vs Custom). */
  panelMode: PanelMode;
  /** Whether the assembly should render in the 3D scene (false while a custom build is incomplete). */
  towerVisible: boolean;
  /** Bumped to ask the camera rig to reframe to the default pose for the current view. */
  viewResetNonce: number;

  // Custom-panel selections (bottom → top frame slots + extension/base choices). These
  // are the Custom panel's persistent selection; they survive switching to Inputs and back.
  customFrames: Slots;
  customRocket: string;
  customBaseType: BaseType;

  // Saved workspace of the INACTIVE panel, restored verbatim on switch-back (null = never
  // visited → use its default). The active panel's state lives in the flat fields above.
  savedInputs: PanelSnapshot | null;
  savedCustom: PanelSnapshot | null;

  // Actions
  setSlabHeight: (h: number) => void;
  setSlabThickness: (t: number) => void;
  /** Switch between hollow (tubular) and solid-stem jacks; re-resolves the active panel. */
  setJackType: (t: JackType) => void;
  /** Swap the whole configuration; coerced to an available one and clamped to its ranges. */
  setConfig: (config: FrameConfig) => void;
  setUHeadExtension: (v: number) => void;
  setBaseExtension: (v: number) => void;
  /** Set the live assembled height directly (allocates the jacks), clamped to the range. */
  setHeight: (h: number) => void;
  /** Inputs only: dial the jacks so the assembly meets the target slab height. */
  dialToTarget: () => void;
  /** Re-pick the Optimal config for the current inputs (no-op if none fits). */
  autoAssemble: () => void;
  /** Switch the viewport presentation (assembled / exploded / packed). */
  setViewMode: (mode: ViewMode) => void;
  /** Switch the Left-Rail panel (Inputs / Custom), swapping the whole workspace. */
  setPanelMode: (mode: PanelMode) => void;
  /** Set a custom frame slot (bottom=0), cascading away now-illegal slots above. */
  setCustomSlot: (index: number, size: string | null) => void;
  /** Set the custom extension choice ('none' | '300mm' | '500mm'). */
  setCustomRocket: (rocket: string) => void;
  /** Set the custom base choice ('flatJack' | 'propInner'). */
  setCustomBaseType: (baseType: BaseType) => void;
  /** Reframe the camera to the default pose for the current view. */
  resetView: () => void;
  /** Restore the active workspace from a decoded shareable-link state. */
  hydrateFromShare: (share: ShareState) => void;
}

// Sensible defaults: 2800mm soffit, 200mm (thin) slab, hollow jacks -> Optimal = 5ft Flat Jack
// (hollow-thin jacks reach 600/600, so the 5ft single services 2800; smaller frames rank first).
const DEFAULT_HEIGHT = 2800;
const DEFAULT_THICKNESS = 200;
const DEFAULT_JACK: JackType = 'hollow';
const initialConfig = simplestValidConfig(DEFAULT_HEIGHT, DEFAULT_THICKNESS, DEFAULT_JACK) ?? CONFIG_BY_ID['s-6ft-fj'];
const initialAlloc = allocateExtensionsToTarget(initialConfig, DEFAULT_THICKNESS, DEFAULT_JACK, DEFAULT_HEIGHT);

/** Inputs default workspace — the optimal single dialled to 2800mm on a thin slab, Build view. */
const INPUTS_DEFAULT: PanelSnapshot = {
  slabHeight: DEFAULT_HEIGHT,
  slabThickness: DEFAULT_THICKNESS,
  slabThicknessRaw: DEFAULT_THICKNESS,
  jackType: DEFAULT_JACK,
  config: initialConfig,
  uHeadExtension: initialAlloc.uHeadExtension,
  baseExtension: initialAlloc.baseExtension,
  viewMode: 'assembled',
  towerVisible: true,
  ...derive(initialConfig, DEFAULT_THICKNESS, DEFAULT_JACK, DEFAULT_HEIGHT, initialAlloc.uHeadExtension, initialAlloc.baseExtension),
};

/** Custom default workspace — a blank build (nothing rendered) on a thin slab, Build view. */
const CUSTOM_DEFAULT: PanelSnapshot = {
  slabHeight: DEFAULT_HEIGHT,
  slabThickness: DEFAULT_THICKNESS,
  slabThicknessRaw: DEFAULT_THICKNESS,
  jackType: DEFAULT_JACK,
  config: initialConfig, // placeholder; hidden while towerVisible is false
  uHeadExtension: 0,
  baseExtension: 0,
  viewMode: 'assembled',
  towerVisible: false,
  range: EMPTY_RANGE,
  currentHeight: 0,
  available: true,
  hasValidOption: false,
  isValid: false,
  meetsTarget: false,
};

/** Capture the active flat fields as this panel's saved workspace. */
const snapshot = (s: FormworkState): PanelSnapshot => ({
  slabHeight: s.slabHeight,
  slabThickness: s.slabThickness,
  slabThicknessRaw: s.slabThicknessRaw,
  jackType: s.jackType,
  config: s.config,
  uHeadExtension: s.uHeadExtension,
  baseExtension: s.baseExtension,
  viewMode: s.viewMode,
  towerVisible: s.towerVisible,
  range: s.range,
  currentHeight: s.currentHeight,
  available: s.available,
  hasValidOption: s.hasValidOption,
  isValid: s.isValid,
  meetsTarget: s.meetsTarget,
});

export const useFormworkStore = create<FormworkState>((set, get) => ({
  ...INPUTS_DEFAULT,
  panelMode: 'inputs',
  viewResetNonce: 0,
  customFrames: EMPTY_SLOTS,
  customRocket: 'none',
  customBaseType: 'flatJack',
  savedInputs: null,
  savedCustom: null,

  setSlabHeight: (h) => {
    if (!Number.isFinite(h)) return; // reject NaN / Infinity
    const s = get();
    if (s.panelMode !== 'inputs') return; // slab height is an Inputs-only control
    const slabHeight = clamp(Math.round(h), 0, INPUT_LIMITS.slabHeightMax);
    set(resolveInputs(slabHeight, s.slabThickness, s.jackType, s.config));
  },

  // Each panel owns its own slab thickness; re-resolve only the active one.
  // Values above the design maximum clamp to it; `slabThicknessRaw` keeps the value the
  // user actually typed so the TWE warning can compare against THAT, not the clamped
  // result (which can never itself exceed the maximum).
  setSlabThickness: (t) => {
    if (!Number.isFinite(t)) return;
    const s = get();
    const slabThicknessRaw = Math.round(t);
    const slabThickness = clamp(slabThicknessRaw, 0, INPUT_LIMITS.slabThicknessMax);
    if (s.panelMode === 'custom') {
      // Preserve the current jack positions (clamped to the new range). A thick slab also
      // downgrades a raw Prop Inner selection, same rationale as the rocket coercions below.
      const customBaseType = effectiveCustomBaseType(s.customFrames, slabThickness, s.customBaseType);
      set({
        slabThickness,
        slabThicknessRaw,
        customBaseType,
        ...resolveCustom(s.customFrames, s.customRocket, customBaseType, slabThickness, s.jackType, s.uHeadExtension, s.baseExtension, s.config),
      });
    } else {
      set({ ...resolveInputs(s.slabHeight, slabThickness, s.jackType, s.config), slabThicknessRaw });
    }
  },

  // Each panel owns its own jack type too; rockets coerce off when switching to solid —
  // the raw customRocket selection is downgraded too, so it can't silently reappear (or
  // leak into the share link) when switching back to hollow.
  setJackType: (t) => {
    const s = get();
    if (t === s.jackType) return;
    if (s.panelMode === 'custom') {
      const customRocket = effectiveCustomRocket(s.customFrames, t, s.customRocket);
      set({
        jackType: t,
        customRocket,
        ...resolveCustom(s.customFrames, customRocket, s.customBaseType, s.slabThickness, t, s.uHeadExtension, s.baseExtension, s.config),
      });
    } else {
      set(resolveInputs(s.slabHeight, s.slabThickness, t, s.config));
    }
  },

  setConfig: (configArg) => {
    const s = get();
    if (s.panelMode !== 'inputs') return; // Custom builds via the frame slots, not whole-config swaps
    // Never activate a config that's prohibited for the current slab + jack type.
    const config = isAvailable(configArg, s.slabThickness, s.jackType)
      ? configArg
      : simplestAvailableConfig(s.slabThickness, s.jackType);
    // Render the newly-selected config adjusted to the target soffit.
    const { uHeadExtension, baseExtension } = allocateExtensionsToTarget(config, s.slabThickness, s.jackType, s.slabHeight);
    set({
      config,
      uHeadExtension,
      baseExtension,
      towerVisible: true,
      ...derive(config, s.slabThickness, s.jackType, s.slabHeight, uHeadExtension, baseExtension),
    });
  },

  setUHeadExtension: (v) => {
    if (!Number.isFinite(v)) return;
    const s = get();
    const uHeadExtension = clamp(Math.round(v), s.range.uHeadMin, s.range.uHeadMax);
    if (s.panelMode === 'custom') {
      // No target height in Custom — just update the live height; range/config are unchanged.
      set({ uHeadExtension, currentHeight: calcCurrentHeight(s.config, uHeadExtension, s.baseExtension) });
    } else {
      set({
        uHeadExtension,
        ...derive(s.config, s.slabThickness, s.jackType, s.slabHeight, uHeadExtension, s.baseExtension),
      });
    }
  },

  setBaseExtension: (v) => {
    if (!Number.isFinite(v)) return;
    const s = get();
    const baseExtension = clamp(Math.round(v), s.range.baseMin, s.range.baseMax);
    if (s.panelMode === 'custom') {
      set({ baseExtension, currentHeight: calcCurrentHeight(s.config, s.uHeadExtension, baseExtension) });
    } else {
      set({
        baseExtension,
        ...derive(s.config, s.slabThickness, s.jackType, s.slabHeight, s.uHeadExtension, baseExtension),
      });
    }
  },

  // Set the live height by allocating the jacks to reach it (base first, then U-head),
  // clamped to the config's range. Drives the draggable height track in both panels.
  setHeight: (h) => {
    if (!Number.isFinite(h)) return;
    const s = get();
    const target = clamp(Math.round(h), s.range.min, s.range.max);
    const { uHeadExtension, baseExtension } = allocateExtensionsToTarget(s.config, s.slabThickness, s.jackType, target);
    if (s.panelMode === 'custom') {
      set({ uHeadExtension, baseExtension, currentHeight: calcCurrentHeight(s.config, uHeadExtension, baseExtension) });
    } else {
      set({ uHeadExtension, baseExtension, ...derive(s.config, s.slabThickness, s.jackType, s.slabHeight, uHeadExtension, baseExtension) });
    }
  },

  dialToTarget: () => {
    const s = get();
    if (s.panelMode !== 'inputs') return;
    get().setHeight(s.slabHeight);
  },

  autoAssemble: () => {
    const s = get();
    const next = simplestValidConfig(s.slabHeight, s.slabThickness, s.jackType);
    if (next) get().setConfig(next);
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setPanelMode: (mode) => {
    const s = get();
    if (mode === s.panelMode) return;
    // Save the outgoing panel's workspace, restore the incoming one (default if unvisited).
    const snap = snapshot(s);
    const savedInputs = s.panelMode === 'inputs' ? snap : s.savedInputs;
    const savedCustom = s.panelMode === 'custom' ? snap : s.savedCustom;
    const restored = mode === 'custom' ? savedCustom ?? CUSTOM_DEFAULT : savedInputs ?? INPUTS_DEFAULT;
    set({ panelMode: mode, savedInputs, savedCustom, ...restored });
  },

  // Each custom build change reseats the jacks at minimum (Current = Min); the user then
  // drags/steppers up. customConfigFrom coerces any now-illegal extension/base; the raw
  // customRocket/customBaseType selections are downgraded too (see effectiveCustomRocket /
  // effectiveCustomBaseType) so neither silently reappears if the build later drops back
  // to a single frame (or, for the rocket, hollow jacks).
  setCustomSlot: (index, size) => {
    const s = get();
    if (s.panelMode !== 'custom') return;
    const customFrames = applySlot(s.customFrames, index, size);
    const customRocket = effectiveCustomRocket(customFrames, s.jackType, s.customRocket);
    const customBaseType = effectiveCustomBaseType(customFrames, s.slabThickness, s.customBaseType);
    set({
      customFrames,
      customRocket,
      customBaseType,
      ...resolveCustom(customFrames, customRocket, customBaseType, s.slabThickness, s.jackType, 0, 0, s.config),
    });
  },

  setCustomRocket: (rocket) => {
    const s = get();
    if (s.panelMode !== 'custom') return;
    set({ customRocket: rocket, ...resolveCustom(s.customFrames, rocket, s.customBaseType, s.slabThickness, s.jackType, 0, 0, s.config) });
  },

  setCustomBaseType: (baseType) => {
    const s = get();
    if (s.panelMode !== 'custom') return;
    set({ customBaseType: baseType, ...resolveCustom(s.customFrames, s.customRocket, baseType, s.slabThickness, s.jackType, 0, 0, s.config) });
  },

  resetView: () => set((s) => ({ viewResetNonce: s.viewResetNonce + 1 })),

  // Restore the ACTIVE workspace from a shared link. The other panel is reset to its
  // default (a link captures one view). All values are validated / clamped defensively.
  hydrateFromShare: (share) => {
    const viewMode: ViewMode = share.viewMode;
    const slabThickness = clamp(Math.round(share.slabThickness), 0, INPUT_LIMITS.slabThicknessMax);
    const jackType: JackType = share.jackType;
    if (share.panelMode === 'custom') {
      // Normalize the decoded frames through the real slot rules (a hand-edited hash could
      // otherwise carry an illegal stack, which the picker would show as active-yet-disabled).
      let customFrames: Slots = EMPTY_SLOTS;
      for (let i = 0; i < 3; i++) {
        const size = share.frames?.[i];
        if (!size || !sizeAllowed(customFrames, i, size)) break;
        customFrames = applySlot(customFrames, i, size);
      }
      // A hand-edited link could carry a rocket that's illegal for its own frames/jackType
      // (e.g. rk=500mm with a double, or with jt=solid) — downgrade it the same way any
      // other build-time change does, so state never starts out inconsistent.
      const customRocket = effectiveCustomRocket(customFrames, jackType, share.rocket ?? 'none');
      // Same rationale — a hand-edited link could carry a Prop Inner base illegal for its
      // own frames/slab thickness.
      const customBaseType = effectiveCustomBaseType(customFrames, slabThickness, share.baseType ?? 'flatJack');
      set({
        panelMode: 'custom',
        viewMode,
        viewResetNonce: get().viewResetNonce + 1,
        slabThickness,
        slabThicknessRaw: slabThickness,
        jackType,
        slabHeight: DEFAULT_HEIGHT,
        customFrames,
        customRocket,
        customBaseType,
        savedInputs: null,
        savedCustom: null,
        ...resolveCustom(customFrames, customRocket, customBaseType, slabThickness, jackType, share.uHead, share.base, initialConfig),
      });
    } else {
      const wanted = share.configId ? CONFIG_BY_ID[share.configId] : undefined;
      const config = wanted && isAvailable(wanted, slabThickness, jackType) ? wanted : simplestAvailableConfig(slabThickness, jackType);
      const slabHeight = clamp(Math.round(share.slabHeight ?? DEFAULT_HEIGHT), 0, INPUT_LIMITS.slabHeightMax);
      const range = calcHeightRange(config, slabThickness, jackType);
      const uHeadExtension = clamp(Math.round(share.uHead), range.uHeadMin, range.uHeadMax);
      const baseExtension = clamp(Math.round(share.base), range.baseMin, range.baseMax);
      set({
        panelMode: 'inputs',
        viewMode,
        viewResetNonce: get().viewResetNonce + 1,
        slabThickness,
        slabThicknessRaw: slabThickness,
        jackType,
        slabHeight,
        config,
        uHeadExtension,
        baseExtension,
        towerVisible: true,
        customFrames: EMPTY_SLOTS,
        customRocket: 'none',
        customBaseType: 'flatJack',
        savedInputs: null,
        savedCustom: null,
        ...derive(config, slabThickness, jackType, slabHeight, uHeadExtension, baseExtension),
      });
    }
  },
}));

// Dev-only hook for previewing arbitrary configs (e.g. short-frame triples that
// auto-assemble never selects). Tree-shaken out of production builds.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __fw: unknown; __cfg: unknown }).__fw = useFormworkStore;
  (window as unknown as { __fw: unknown; __cfg: unknown }).__cfg = CONFIG_BY_ID;
}
