/**
 * The component / materials breakdown — the primary panel of the app.
 *
 * Two tabs:
 *   Optimal — the components of the active configuration (a descriptive,
 *             per-bay bill of materials with live screwjack steppers).
 *   Other / Select — every other valid configuration for the entered height; picking
 *             one sets it active and returns to the Optimal view. The tab reads
 *             "Select" when no Optimal exists (only engineering-flagged options fit).
 */
import { useState } from 'react';
import { useFormworkStore } from '../../store/formworkStore';
import { buildBom } from '../../logic/bom';
import { simplestValidConfig, requiresEngineering } from '../../logic/catalogue';
import { ExtensionStepper } from './ExtensionStepper';
import { ConfigList } from './ConfigList';

export function Materials() {
  const [tab, setTab] = useState<'optimal' | 'other'>('optimal');

  const config = useFormworkStore((s) => s.config);
  const range = useFormworkStore((s) => s.range);
  const slabHeight = useFormworkStore((s) => s.slabHeight);
  const slabThickness = useFormworkStore((s) => s.slabThickness);
  const jackType = useFormworkStore((s) => s.jackType);
  const hasValidOption = useFormworkStore((s) => s.hasValidOption);
  const setConfig = useFormworkStore((s) => s.setConfig);

  const optimal = simplestValidConfig(slabHeight, slabThickness, jackType);
  const isOptimal = !optimal || optimal.id === config.id;
  // With no supplier-backed recommendation, the picker tab becomes "Select".
  const pickerLabel = optimal ? 'Other' : 'Select';

  const sections = buildBom(config, range, jackType);
  // Singles' labels are just "6ft" etc., so prefix them; doubles/triples already say so.
  const summary = config.frames.length === 1 ? `Single · ${config.label}` : config.label;

  return (
    <section className="card materials">
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'optimal' ? ' active' : ''}`}
          onClick={() => setTab('optimal')}
        >
          Optimal
        </button>
        <button
          type="button"
          className={`tab${tab === 'other' ? ' active' : ''}`}
          onClick={() => setTab('other')}
        >
          {pickerLabel}
        </button>
      </div>

      {tab === 'other' ? (
        <ConfigList
          onPick={(c) => {
            setConfig(c);
            setTab('optimal');
          }}
        />
      ) : (
        <>
          {!optimal && hasValidOption && (
            <div className="materials-banner">
              No standard configuration services this height — the options under {pickerLabel} require
              engineering sign-off.
            </div>
          )}
          <div className="materials-head">
            <span className="materials-kind">{summary}</span>
            {requiresEngineering(config) && <span className="config-badge warn">Engineering required</span>}
            {!isOptimal && optimal ? (
              <button type="button" className="revert" onClick={() => setConfig(optimal)}>
                ↩ optimal
              </button>
            ) : null}
          </div>

          {sections.map((section) => {
            // The timber deck is indicative — keep it (its depths feed the overall
            // height) but don't show the (meaningless) per-bay quantities.
            const hideQty = section.title === 'Timber deck (indicative)';
            return (
              <div key={section.title} className="bom-section">
                <div className="bom-section-title">{section.title}</div>
                {section.items.map((item, i) => (
                  <div key={i} className={`bom-item${item.live ? ' live' : ''}`}>
                    <div className="bom-item-main">
                      <span className="bom-name">{item.name}</span>
                      {!hideQty && item.qty ? <span className="bom-qty">×{item.qty}</span> : null}
                    </div>
                    {item.detail ? <div className="bom-detail">{item.detail}</div> : null}
                    {item.control ? <ExtensionStepper which={item.control} /> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
