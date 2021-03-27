export function getClipRectProps(start: number, end: number, height: number) {
  return {
    x: Math.min(start, end),
    y: 0,
    width: Math.abs(start - end),
    height,
  };
}
