export type Side = "left" | "right";

export type Slot = { id: string; top: number; height: number };
export type Placed = { id: string; top: number; side: Side };

/**
 * Puts each comment on whichever side lets it sit closest to its passage, so a
 * run of comments splits into two short stacks. Slots must be in page order.
 */
export function placeNotes(slots: Slot[], sides: Side[], gap: number): Placed[] {
  const floor: Record<Side, number> = { left: 0, right: 0 };
  return slots.map(({ id, top, height }) => {
    const side = sides.reduce((best, s) => (floor[s] < floor[best] ? s : best));
    const placed = Math.max(top, floor[side]);
    floor[side] = placed + height + gap;
    return { id, top: placed, side };
  });
}
