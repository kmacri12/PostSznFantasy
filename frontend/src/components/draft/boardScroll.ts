/**
 * Scroll offset that centres a cell in the part of the viewport not covered by pinned
 * headers, clamped to what the container can actually scroll.
 */
export function centeredScroll(
  cellStart: number,
  cellSize: number,
  viewportSize: number,
  pinnedSize: number,
  contentSize: number,
): number {
  const visible = viewportSize - pinnedSize;
  const target = cellStart - pinnedSize - (visible - cellSize) / 2;
  return Math.min(Math.max(0, target), Math.max(0, contentSize - viewportSize));
}
