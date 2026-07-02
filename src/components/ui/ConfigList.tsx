/**
 * The "Other" / "Select" tab: every configuration whose serviceable range contains the
 * entered slab height, simplest-first. Picking one sets it active and returns to the
 * Components view. Prop Inner and triple configurations carry an engineering badge —
 * they are never the Optimal recommendation but remain selectable here.
 */
import { useFormworkStore } from '../../store/formworkStore';
import { validConfigsRanked, isOptimalEligible, engineeringBadgeLabel } from '../../logic/catalogue';
import { calcHeightRange } from '../../logic/heightCalc';
import type { FrameConfig } from '../../logic/configurations';

const kindOf = (n: number) => (n === 1 ? 'Single' : n === 2 ? 'Double' : 'Triple');

/** Badge for a row: Optimal (the recommendation) or the engineering flag, if any. */
function badgeFor(c: FrameConfig, optimalId: string | undefined) {
  if (c.id === optimalId) return <span className="config-badge">Optimal</span>;
  const label = engineeringBadgeLabel(c);
  return label ? <span className="config-badge warn">{label}</span> : null;
}

export function ConfigList({ onPick }: { onPick: (c: FrameConfig) => void }) {
  const slabHeight = useFormworkStore((s) => s.slabHeight);
  const slabThickness = useFormworkStore((s) => s.slabThickness);
  const jackType = useFormworkStore((s) => s.jackType);
  const activeId = useFormworkStore((s) => s.config.id);

  const list = validConfigsRanked(slabHeight, slabThickness, jackType);
  const optimalId = list.find(isOptimalEligible)?.id;

  if (list.length === 0) {
    return (
      <div className="config-empty">
        No configuration services {Math.round(slabHeight)} mm at this slab thickness. Adjust the
        slab height.
      </div>
    );
  }

  return (
    <div className="config-list">
      <div className="config-list-head">
        {list.length} option{list.length === 1 ? '' : 's'} service {Math.round(slabHeight)} mm
      </div>
      {list.map((c) => {
        const r = calcHeightRange(c, slabThickness, jackType);
        return (
          <button
            key={c.id}
            type="button"
            className={`config-row${c.id === activeId ? ' active' : ''}`}
            onClick={() => onPick(c)}
          >
            <div className="config-row-main">
              <span className="config-row-label">{c.label}</span>
              {badgeFor(c, optimalId)}
            </div>
            <div className="config-row-meta">
              {kindOf(c.frames.length)} · services {Math.round(r.min)}–{Math.round(r.max)} mm
            </div>
          </button>
        );
      })}
    </div>
  );
}
