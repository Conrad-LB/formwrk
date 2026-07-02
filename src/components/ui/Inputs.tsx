/** Slab height + thickness + jack type inputs. */
import { useFormworkStore } from '../../store/formworkStore';
import { SLAB_THICKNESS_MAX, type JackType } from '../../logic/frameData';
import { NumberInput } from './NumberInput';

const JACK_OPTIONS: Array<{ value: JackType; label: string; hint: string }> = [
  { value: 'hollow', label: 'Hollow', hint: 'tubular stem' },
  { value: 'solid', label: 'Solid', hint: 'solid stem' },
];

export function Inputs() {
  const slabHeight = useFormworkStore((s) => s.slabHeight);
  const slabThickness = useFormworkStore((s) => s.slabThickness);
  const slabThicknessRaw = useFormworkStore((s) => s.slabThicknessRaw);
  const jackType = useFormworkStore((s) => s.jackType);
  const setSlabHeight = useFormworkStore((s) => s.setSlabHeight);
  const setSlabThickness = useFormworkStore((s) => s.setSlabThickness);
  const setJackType = useFormworkStore((s) => s.setJackType);

  return (
    <section className="card">
      <h2>Inputs</h2>
      <label className="field">
        <span>Slab height (mm)</span>
        <NumberInput value={slabHeight} onCommit={setSlabHeight} ariaLabel="slab height in millimetres" />
      </label>
      <span className="hint">floor to soffit</span>
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
      <span className="hint">
        {jackType === 'hollow' ? 'tubular stem · extends to 600 mm · takes rockets' : 'solid stem · extends to 450 mm · no rockets'}
      </span>
    </section>
  );
}
