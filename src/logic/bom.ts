/**
 * Bill of materials for the current shoring bay.
 *
 * This app's primary job is to ILLUSTRATE THE COMPONENTS, so this turns the
 * active configuration into a readable component list with descriptive names and
 * per-bay quantities. All quantities come from the SAME `BAY_QUANTITIES` model
 * the 3D scene uses, so the list and the render can never disagree. Deck joist /
 * ply quantities are indicative for one illustrative bay (see bayLayout.ts).
 */

import type { FrameConfig } from './configurations';
import { FRAME_HEIGHTS, ROCKETS, type JackType } from './frameData';
import type { HeightRange } from './heightCalc';
import { BAY_QUANTITIES } from './bayLayout';

export interface BomItem {
  name: string;
  qty?: number; // "off" count for the bay, where well-defined
  detail?: string; // size / live extension text
  live?: boolean; // value changes as a screwjack is dragged
  control?: 'uHead' | 'base'; // renders an inline extension stepper
}

export interface BomSection {
  title: string;
  items: BomItem[];
}

const FT_LABEL: Record<string, string> = {
  '3ft': '3Ft',
  '4ft': '4Ft',
  '5ft': '5Ft',
  '6ft': '6Ft',
  '7ft': '7Ft',
};

const mm = (v: number) => `${Math.round(v)} mm`;

export function buildBom(config: FrameConfig, range: HeightRange, jackType: JackType): BomSection[] {
  const levels = config.frames.length;

  // Frames grouped by size — two ladder frames per level (front + back).
  const counts: Record<string, number> = {};
  for (const f of config.frames) counts[f] = (counts[f] ?? 0) + 1;
  const frameItems: BomItem[] = Object.entries(counts).map(([size, n]) => ({
    name: `${FT_LABEL[size] ?? size} Frame`,
    qty: n * BAY_QUANTITIES.framesPerLevel,
    detail: `${mm(FRAME_HEIGHTS[size] ?? 0)} high`,
  }));
  frameItems.push({ name: 'Diagonal cross-brace', qty: BAY_QUANTITIES.crossBracesPerLevel * levels });

  const rocketMm = ROCKETS[config.rocket] ?? 0;
  const extensionItems: BomItem[] = rocketMm > 0
    ? [{ name: `${rocketMm}mm Extension Tube`, qty: BAY_QUANTITIES.legs, detail: `slides over each leg` }]
    : [{ name: 'No extension' }];

  const isPropInner = config.baseType === 'propInner';
  const baseName = isPropInner ? 'Prop Inner No 1' : 'Flat Jack Screwjack';

  return [
    { title: 'Frames', items: frameItems },
    { title: 'Extensions', items: extensionItems },
    {
      title: 'Head',
      items: [
        {
          name: 'U-Head Screwjack',
          qty: BAY_QUANTITIES.legs,
          detail: `${jackType} · range ${mm(range.uHeadMin)}–${mm(range.uHeadMax)}`,
          live: true,
          control: 'uHead',
        },
      ],
    },
    {
      title: 'Base',
      items: [
        {
          name: baseName,
          qty: BAY_QUANTITIES.legs,
          detail: `${isPropInner ? 'pinned · ' : `${jackType} · `}range ${mm(range.baseMin)}–${mm(range.baseMax)}`,
          live: true,
          control: 'base',
        },
      ],
    },
    {
      title: 'Timber deck (indicative)',
      items: [
        { name: 'LVL Bearer', qty: BAY_QUANTITIES.bearers, detail: '150 × 77 mm' },
        { name: 'LVL Joist', qty: BAY_QUANTITIES.joists, detail: '95 × 65 mm · indicative spacing' },
        { name: 'Form-Ply deck', qty: BAY_QUANTITIES.plySheets, detail: '17 mm · indicative' },
      ],
    },
  ];
}
