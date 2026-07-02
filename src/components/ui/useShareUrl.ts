/**
 * Two-way sync between the store and the URL hash (see logic/shareState.ts):
 *   - on mount, hydrate the store from an incoming shared link (once), then
 *   - reflect subsequent state changes back into the hash via replaceState (coalesced
 *     per animation frame, so dragging the height doesn't spam history).
 * This makes the current view linkable/bookmarkable without any local/session storage.
 */
import { useEffect } from 'react';
import { useFormworkStore, type FormworkState } from '../../store/formworkStore';
import { encodeShare, decodeShare, type ShareState } from '../../logic/shareState';
import { framesFromSlots } from '../../logic/customBuild';

function toShareState(s: FormworkState): ShareState {
  const base = {
    panelMode: s.panelMode,
    viewMode: s.viewMode,
    slabThickness: s.slabThickness,
    jackType: s.jackType,
    uHead: s.uHeadExtension,
    base: s.baseExtension,
  };
  return s.panelMode === 'inputs'
    ? { ...base, slabHeight: s.slabHeight, configId: s.config.id }
    : { ...base, frames: framesFromSlots(s.customFrames), rocket: s.customRocket, baseType: s.customBaseType };
}

export function useShareUrl() {
  useEffect(() => {
    // 1) Restore from an incoming link, once.
    const decoded = decodeShare(window.location.hash);
    if (decoded) useFormworkStore.getState().hydrateFromShare(decoded);

    // 2) Reflect state -> hash, coalesced per frame.
    let raf = 0;
    const write = () => {
      raf = 0;
      const hash = '#' + encodeShare(toShareState(useFormworkStore.getState()));
      if (hash !== window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
      }
    };
    const unsub = useFormworkStore.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(write);
    });
    write(); // seed the hash from the current state immediately

    return () => {
      unsub();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
