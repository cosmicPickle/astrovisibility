import type { Vector3 } from '../../sky/planetariumProjection';

/** Independent measured wall oracle. Indoors, visibility must exit through this
 * opening. Outdoors, only forward wall hits obstruct; a clear return through the
 * hole still needs the background mask. All bounds are metres in wall coordinates. */
export function wallRayIsClear(
  ray: Vector3,
  lens: Vector3,
  depth: number,
  left: number,
  right: number,
  bottom: number,
  top: number,
) {
  const distance = depth - lens.z;
  if (distance >= -1e-7 && ray.z <= 1e-12) return false;
  if (distance < -1e-7 && ray.z >= -1e-12) return true;
  const travel = (Math.abs(distance) < 1e-7 ? 0 : distance) / ray.z;
  const x = lens.x + travel * ray.x;
  const y = lens.y + travel * ray.y;
  return (
    x > left + 1e-7 && x < right - 1e-7 && y > bottom + 1e-7 && y < top - 1e-7
  );
}

export function sampledIntervals(
  start: number,
  seconds: number,
  visibleAt: (second: number) => boolean,
) {
  const intervals: { startTimestampUtc: string; endTimestampUtc: string }[] =
    [];
  let visibleStart: number | null = null;
  for (let second = 0; second <= seconds; second++) {
    const visible = second < seconds && visibleAt(second);
    if (visible && visibleStart === null) visibleStart = second;
    if (!visible && visibleStart !== null) {
      intervals.push({
        startTimestampUtc: new Date(start + visibleStart * 1000).toISOString(),
        endTimestampUtc: new Date(start + second * 1000).toISOString(),
      });
      visibleStart = null;
    }
  }
  return intervals;
}
