export type ChartPoint = {
  x: number;
  y: number;
};

export function getBoundedTooltipPosition({
  anchorX,
  anchorY,
  containerWidth,
  containerHeight,
  tooltipWidth,
  tooltipHeight,
  gap = 10,
  padding = 8,
}: {
  anchorX: number;
  anchorY: number;
  containerWidth: number;
  containerHeight?: number;
  tooltipWidth: number;
  tooltipHeight: number;
  gap?: number;
  padding?: number;
}) {
  const left = Math.max(
    padding,
    Math.min(containerWidth - tooltipWidth - padding, anchorX - tooltipWidth / 2),
  );
  const preferredTop = anchorY - tooltipHeight - gap;
  const fallbackTop = anchorY + gap;
  const maxTop = containerHeight === undefined
    ? fallbackTop
    : Math.max(padding, containerHeight - tooltipHeight - padding);
  const top = preferredTop >= padding
    ? preferredTop
    : Math.min(maxTop, fallbackTop);

  return { left, top };
}

export function buildMonotoneCurvePath(points: ChartPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const slopes = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / Math.max(next.x - point.x, 1);
  });

  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];
    if (slopes[index - 1] * slopes[index] <= 0) return 0;
    return (2 * slopes[index - 1] * slopes[index]) / (slopes[index - 1] + slopes[index]);
  });

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];
    const segmentWidth = next.x - current.x;
    const controlWidth = segmentWidth / 3;
    path += ` C ${current.x + controlWidth} ${current.y + tangents[index] * controlWidth}, ${next.x - controlWidth} ${next.y - tangents[index + 1] * controlWidth}, ${next.x} ${next.y}`;
  }
  return path;
}
