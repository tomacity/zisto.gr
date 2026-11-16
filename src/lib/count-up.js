export function countUpValue(from, to, elapsed, duration = 800) {
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(1, duration)));
  return from + (to - from) * (1 - Math.pow(1 - progress, 3));
}
