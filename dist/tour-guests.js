import { walkable, WALK_START } from './tour.js';

export const GUEST_START = WALK_START + 0.5;
// Paths and poses depend only on film time, so seeking never accumulates simulation drift.
export function createGuestArrival(room, items, tour, count = 60) {
  if (!tour.inside) return { sample: () => ({ people: [] }), count: 0 };
  const entry = tour.route[0], step = 0.4, cells = [{ x: entry[0], z: entry[2], parent: null }];
  const seen = new Set(['0,0']);
  cells[0].ix = cells[0].iz = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    for (const [dx, dz] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const ix = cell.ix + dx, iz = cell.iz + dz, key = `${ix},${iz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const x = entry[0] + ix * step, z = entry[2] + iz * step;
      if (![0.25, 0.5, 0.75, 1].every(t => walkable(cell.x + (x - cell.x) * t, cell.z + (z - cell.z) * t, room, items, 0.3))) continue;
      cells.push({ x, z, ix, iz, parent: cell });
    }
  }
  // Unique reachable destinations, with a reproducible mix across the room.
  const destinations = cells.filter(c => c.z > -room.depth / 2 + 2);
  let seed = 139;
  for (let i = destinations.length - 1; i > 0; i--) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const j = Math.floor(seed / 4294967296 * (i + 1));
    [destinations[i], destinations[j]] = [destinations[j], destinations[i]];
  }
  const paths = destinations.slice(0, Math.min(500, count)).map(destination => {
    const path = [];
    for (let cell = destination; cell; cell = cell.parent) path.push({ x: cell.x, z: cell.z });
    path.reverse(); path.unshift({ x: entry[0], z: -room.depth / 2 - 1.1 });
    return path;
  });
  return {
    count: paths.length,
    sample(time) {
      const people = [];
      paths.forEach((path, i) => {
        const elapsed = time - GUEST_START - i * 0.16;
        if (elapsed < 0) return;
        let distance = elapsed * (1.1 + (i % 5) * 0.06), point = path[0], rotation = 0;
        let walking = false;
        for (let j = 1; j < path.length; j++) {
          const next = path[j], length = Math.hypot(next.x - point.x, next.z - point.z);
          rotation = Math.atan2(next.x - point.x, next.z - point.z);
          if (distance < length) {
            point = { x: point.x + (next.x - point.x) * distance / length, z: point.z + (next.z - point.z) * distance / length };
            walking = true; break;
          }
          distance -= length; point = next;
        }
        people.push({ ...point, rotation: walking ? rotation : (i * 2.4), state: walking ? 'walking' : 'standing', phase: elapsed * 8, wait: 0 });
      });
      return { people };
    },
  };
}
