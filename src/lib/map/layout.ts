/**
 * Callout layout: places too close together to label are gathered into a stack of chips beside them, joined by
 * leader lines; regions get one chip each. Pure functions of screen positions, so they can be tested on their own.
 */
import { CHIP_GAP, CHIP_H, CHIP_OFFSET } from './constants';

export interface Rect { x: number; y: number; w: number; h: number }

export interface ChipItem<T = unknown> {
  key: string;
  text: string;
  /** chip width, px */
  w: number;
  /** anchor (the dot or route midpoint the chip names), screen px */
  ax: number;
  ay: number;
  ref: T;
}

export interface Block<T = unknown> {
  /** +1: chips to the right of their anchors, -1: to the left */
  side: 1 | -1;
  x: number;
  y: number;
  w: number;
  h: number;
  items: ChipItem<T>[];
}

export interface Chip<T = unknown> extends ChipItem<T> {
  side: 1 | -1;
  x: number;
  y: number;
  h: number;
}

/** Group points closer than `px` to each other (transitively), with union-find. */
export function groupCrowded<T extends { x: number; y: number }>(points: T[], px: number): T[][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < px) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, T[]>();
  points.forEach((p, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  });
  return [...groups.values()];
}

/**
 * One callout stack: chips in a column beside the things they name. It goes on the side facing the nearer edge of
 * the view, either clear of everything in `xs` (the whole group, or the region's route) or right beside the anchors,
 * whichever fits; `preferBeside` tries beside first.
 */
export function placeBlock<T>(items: ChipItem<T>[], xs: number[], r: Rect, preferBeside = false): Block<T> {
  const widest = Math.max(...items.map((it) => it.w));
  const anchorX = items.reduce((s, it) => s + it.ax, 0) / items.length;
  const pref: 1 | -1 = anchorX >= r.x + r.w / 2 ? 1 : -1;
  const ax0 = Math.min(...items.map((it) => it.ax));
  const ax1 = Math.max(...items.map((it) => it.ax));
  const outside = (s: 1 | -1) => (s > 0 ? Math.max(...xs) + CHIP_OFFSET : Math.min(...xs) - CHIP_OFFSET - widest);
  const beside = (s: 1 | -1) => (s > 0 ? ax1 + CHIP_OFFSET : ax0 - CHIP_OFFSET - widest);
  const flip = (s: 1 | -1): 1 | -1 => (s > 0 ? -1 : 1);
  const options: [1 | -1, number][] = preferBeside
    ? [[pref, beside(pref)], [flip(pref), beside(flip(pref))], [pref, outside(pref)], [flip(pref), outside(flip(pref))]]
    : [[pref, outside(pref)], [pref, beside(pref)], [flip(pref), beside(flip(pref))], [flip(pref), outside(flip(pref))]];
  const [side, x] = options.find(([, ox]) => ox >= r.x + 8 && ox + widest <= r.x + r.w - 8) ?? options[1];
  const h = items.length * CHIP_H + (items.length - 1) * CHIP_GAP;
  const cy = items.reduce((s, it) => s + it.ay, 0) / items.length;
  return { side, x, w: widest, y: cy - h / 2, h, items };
}

/**
 * Move whole stacks (never single chips) apart vertically, so leader lines from one stack never cross another's,
 * and keep them clear of the map controls at the top and bottom of the view.
 */
export function relax(blocks: Block[], r: Rect): void {
  const top = r.y + 60;
  const bottom = r.y + r.h - 44;
  const overlapX = (a: Block, b: Block) => a.x < b.x + b.w + 8 && b.x < a.x + a.w + 8;
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    blocks.sort((a, b) => a.y - b.y);
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        if (overlapX(a, b) && b.y < a.y + a.h + CHIP_GAP * 2) {
          const gap = a.y + a.h + CHIP_GAP * 2 - b.y; // split the correction between the two stacks
          a.y -= gap / 2;
          b.y += gap / 2;
          moved = true;
        }
      }
    }
    for (const b of blocks) {
      if (b.y + b.h > bottom) { b.y = bottom - b.h; moved = true; }
      if (b.y < top) { b.y = top; moved = true; }
    }
    if (!moved) break;
  }
}

/** Lay out the chips of each stack: right-aligned stacks on the left side, left-aligned on the right. */
export function chipsOf<T>(blocks: Block<T>[]): Chip<T>[] {
  return blocks.flatMap((b) =>
    b.items.map((it, i) => ({
      ...it,
      side: b.side,
      h: CHIP_H,
      x: b.side > 0 ? b.x : b.x + b.w - it.w,
      y: b.y + i * (CHIP_H + CHIP_GAP),
    })),
  );
}
