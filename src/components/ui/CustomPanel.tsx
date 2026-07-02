/**
 * The "Custom" Left-Rail panel: hand-build a frame set (bottom → top) and read back
 * the serviceable height range. The inverse of the Inputs panel — no target height.
 *
 * Layout mirrors the Inputs view as closely as possible: a slab-thickness card, a
 * components card (frame slots + extension + head + base + timber), and a height-range
 * card. The tower renders as soon as a bottom frame is chosen (Base defaults to Flat
 * Jack, Extension to None); before that the components read as a blank build and the
 * height card invites the user to pick a frame.
 */
import { useFormworkStore } from '../../store/formworkStore';
import type { BaseType } from '../../logic/configurations';
import { SLAB_THICKNESS_MAX, type JackType } from '../../logic/frameData';
import {
  FRAME_SIZES,
  slotEnabled,
  sizeAllowed,
  extensionAllowed,
  propInnerAllowed,
  framesFromSlots,
} from '../../logic/customBuild';
import { NumberInput } from './NumberInput';
import { ExtensionStepper } from './ExtensionStepper';
import { HeightTrack } from './HeightTrack';
import { FrameGlyph } from './FrameGlyph';
import type { HeightRange } from '../../logic/heightCalc';

const mm = (v: number) => `${Math.round(v)} mm`;
const sizeLabel = (s: string) => s.replace('ft', 'Ft');
/** Bracketed, italicised amount Min/Max sits below/above Current (rendered via .variance). */
const varLabel = (delta: number, sign: '−' | '+') => (delta <= 0 ? '(0 mm)' : `(${sign}${delta} mm)`);

const SLOT_LABELS = ['Bottom frame', 'Middle frame', 'Top frame'];
const ROCKET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'None' },
  { value: '300mm', label: '300 mm' },
  { value: '500mm', label: '500 mm' },
];
const BASE_OPTIONS: Array<{ value: BaseType; label: string }> = [
  { value: 'flatJack', label: 'Flat Jack' },
  { value: 'propInner', label: 'Prop Inner' },
];
const JACK_OPTIONS: Array<{ value: JackType; label: string }> = [
  { value: 'hollow', label: 'Hollow' },
  { value: 'solid', label: 'Solid' },
];

/** Three frame slots, non-increasing bottom → top; top slot can't be 7ft. */
function FramesPicker() {
  const customFrames = useFormworkStore((s) => s.customFrames);
  const setCustomSlot = useFormworkStore((s) => s.setCustomSlot);

  return (
    <div className="bom-section">
      <div className="bom-section-title">Frames</div>
      {[0, 1, 2].map((i) => {
        const enabled = slotEnabled(customFrames, i);
        const current = customFrames[i];
        const optional = i > 0; // middle/top can be cleared (None, or re-clicking the active one)

        const frameButton = (size: string) => {
          const active = current === size;
          const allowed = enabled && sizeAllowed(customFrames, i, size);
          return (
            <button
              key={size}
              type="button"
              className={`frame-opt${active ? ' active' : ''}`}
              disabled={!allowed && !active}
              aria-pressed={active}
              onClick={() => setCustomSlot(i, optional && active ? null : size)}
            >
              <FrameGlyph size={size} tone={active ? 'active' : allowed ? 'enabled' : 'disabled'} />
              <span className="frame-opt-label">{sizeLabel(size)}</span>
            </button>
          );
        };

        return (
          <div key={i} className="slot">
            <span className="slot-label">
              {SLOT_LABELS[i]}
              {optional ? ' · optional' : ''}
            </span>
            <div className="frame-opts">
              {optional ? (
                // "None" sits above the 3ft box (in the headroom the taller frames leave).
                <div className="frame-col">
                  <button
                    type="button"
                    className={`frame-opt frame-none${current == null ? ' active' : ''}`}
                    disabled={!enabled}
                    aria-pressed={current == null}
                    onClick={() => setCustomSlot(i, null)}
                  >
                    None
                  </button>
                  {frameButton('3ft')}
                </div>
              ) : (
                frameButton('3ft')
              )}
              {FRAME_SIZES.filter((s) => s !== '3ft').map(frameButton)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Extension: none / 300 / 500 — single frames + hollow jacks only. */
function ExtensionPicker() {
  const customFrames = useFormworkStore((s) => s.customFrames);
  const customRocket = useFormworkStore((s) => s.customRocket);
  const jackType = useFormworkStore((s) => s.jackType);
  const setCustomRocket = useFormworkStore((s) => s.setCustomRocket);

  const allowed = extensionAllowed(customFrames, jackType);
  const active = allowed ? customRocket : 'none';
  const singleFrame = framesFromSlots(customFrames).length <= 1;

  return (
    <div className="bom-section">
      <div className="bom-section-title">Extensions</div>
      <div className="chips">
        {ROCKET_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip${active === o.value ? ' active' : ''}`}
            disabled={!allowed && o.value !== 'none'}
            onClick={() => setCustomRocket(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {!allowed && (
        <span className="bom-hint">
          {singleFrame ? 'Extensions require hollow jacks' : 'No extension on double or triple frames'}
        </span>
      )}
    </div>
  );
}

/** U-Head — one option, always present, adjustable once the build is complete. */
function HeadSection({ complete, range }: { complete: boolean; range: HeightRange }) {
  return (
    <div className="bom-section">
      <div className="bom-section-title">Head</div>
      <div className={`bom-item${complete ? ' live' : ''}`}>
        <div className="bom-item-main">
          <span className="bom-name">U-Head Screwjack</span>
        </div>
        <div className="bom-detail">
          {complete ? `range ${mm(range.uHeadMin)}–${mm(range.uHeadMax)}` : 'one option · adjustable'}
        </div>
        {complete && <ExtensionStepper which="uHead" />}
      </div>
    </div>
  );
}

/** Base — Flat Jack / Prop Inner, adjustable once complete. */
function BaseSection({ complete, range }: { complete: boolean; range: HeightRange }) {
  const customFrames = useFormworkStore((s) => s.customFrames);
  const customBaseType = useFormworkStore((s) => s.customBaseType);
  const setCustomBaseType = useFormworkStore((s) => s.setCustomBaseType);
  const slabThickness = useFormworkStore((s) => s.slabThickness);
  const config = useFormworkStore((s) => s.config);

  const propAllowed = propInnerAllowed(customFrames, slabThickness);
  const hasFrame = framesFromSlots(customFrames).length > 0;
  // Effective base = the built config's base when complete, else the (coerced) selection.
  const active: BaseType = complete
    ? config.baseType
    : customBaseType === 'propInner' && !propAllowed
      ? 'flatJack'
      : customBaseType;

  return (
    <div className="bom-section">
      <div className="bom-section-title">Base</div>
      <div className="chips">
        {BASE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip${active === o.value ? ' active' : ''}`}
            disabled={o.value === 'propInner' && !propAllowed}
            onClick={() => setCustomBaseType(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hasFrame && !propAllowed && <span className="bom-hint">Prop Inner: single frame, thin slab only</span>}
      {complete && (
        <div className="bom-item live">
          <div className="bom-item-main">
            <span className="bom-name">{active === 'propInner' ? 'Prop Inner No 1' : 'Flat Jack Screwjack'}</span>
          </div>
          <div className="bom-detail">
            {active === 'propInner' ? 'pinned · ' : ''}range {mm(range.baseMin)}–{mm(range.baseMax)}
          </div>
          <ExtensionStepper which="base" />
        </div>
      )}
    </div>
  );
}

/** Indicative timber deck — unchanged from the Inputs bill of materials. */
function TimberSection() {
  const items = [
    { name: 'LVL Bearer', detail: '150 × 77 mm' },
    { name: 'LVL Joist', detail: '95 × 65 mm · indicative spacing' },
    { name: 'Form-Ply deck', detail: '17 mm · indicative' },
  ];
  return (
    <div className="bom-section">
      <div className="bom-section-title">Timber deck (indicative)</div>
      {items.map((it) => (
        <div key={it.name} className="bom-item">
          <div className="bom-item-main">
            <span className="bom-name">{it.name}</span>
          </div>
          <div className="bom-detail">{it.detail}</div>
        </div>
      ))}
    </div>
  );
}

function CustomHeight({
  complete,
  range,
  currentHeight,
}: {
  complete: boolean;
  range: HeightRange;
  currentHeight: number;
}) {
  const belowMin = Math.round(currentHeight - range.min);
  const aboveMax = Math.round(range.max - currentHeight);

  return (
    <section className="card height">
      <h2>Height range</h2>
      {complete ? (
        <>
          <div className="metric">
            <span className="k">Min</span>
            <span className="v"><span className="variance">{varLabel(belowMin, '−')}</span>{mm(range.min)}</span>
          </div>
          <div className="metric">
            <span className="k">Max</span>
            <span className="v"><span className="variance">{varLabel(aboveMax, '+')}</span>{mm(range.max)}</span>
          </div>
          <HeightTrack showTarget={false} />
          <div className="range-row">
            <span>{mm(range.min)}</span>
            <span>{mm(range.max)}</span>
          </div>
          <div className="metric big">
            <span className="k">Current</span>
            <span className="v">{mm(currentHeight)}</span>
          </div>
        </>
      ) : (
        <div className="custom-note">
          Pick a bottom frame to build a set — the serviceable height range appears here.
        </div>
      )}
    </section>
  );
}

export function CustomPanel() {
  const slabThickness = useFormworkStore((s) => s.slabThickness);
  const slabThicknessRaw = useFormworkStore((s) => s.slabThicknessRaw);
  const setSlabThickness = useFormworkStore((s) => s.setSlabThickness);
  const jackType = useFormworkStore((s) => s.jackType);
  const setJackType = useFormworkStore((s) => s.setJackType);
  const towerVisible = useFormworkStore((s) => s.towerVisible);
  const config = useFormworkStore((s) => s.config);
  const range = useFormworkStore((s) => s.range);
  const currentHeight = useFormworkStore((s) => s.currentHeight);

  const complete = towerVisible; // in Custom, the tower shows exactly when the build is complete

  return (
    <>
      <section className="card">
        <h2>Inputs</h2>
        <label className="field">
          <span>Slab thickness (mm)</span>
          <NumberInput value={slabThickness} onCommit={setSlabThickness} ariaLabel="slab thickness in millimetres" />
        </label>
        {slabThicknessRaw > SLAB_THICKNESS_MAX && (
          <span className="hint warn-note">
            {slabThicknessRaw} mm exceeds the tool's {SLAB_THICKNESS_MAX} mm design maximum — showing{' '}
            {SLAB_THICKNESS_MAX} mm. Thicker slabs must be checked by a Temporary Works Engineer.
          </span>
        )}
        <div className="field">
          <span>Jack type</span>
          <div className="chips">
            {JACK_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`chip${jackType === o.value ? ' active' : ''}`}
                aria-pressed={jackType === o.value}
                onClick={() => setJackType(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card materials">
        {complete && (
          <div className="materials-head">
            <span className="materials-kind">{config.label}</span>
          </div>
        )}
        <FramesPicker />
        <ExtensionPicker />
        <HeadSection complete={complete} range={range} />
        <BaseSection complete={complete} range={range} />
        <TimberSection />
      </section>

      <CustomHeight complete={complete} range={range} currentHeight={currentHeight} />
    </>
  );
}
