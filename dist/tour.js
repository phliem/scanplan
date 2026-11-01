import { CATALOG } from './layout.js';
export const TOUR_DURATION = 28;
export const WALK_START = 9;
export const WALK_END = 22;
export const ENTRY_START = 7;
export const CHAPTERS = [
  { start: 0, title: 'Your event is already underway', subtitle: 'Fly down towards the warehouse entrance.' },
  { start: 2, title: 'The doors are opening', subtitle: 'Follow the flight through the double doors.' },
  { start: ENTRY_START, title: 'Step inside', subtitle: 'A view from 1.65 metres above the floor.' },
  { start: WALK_END, title: 'Take it all in', subtitle: 'Fifty people are already inside. Look around the gathering.' },
];
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
export function walkable(x, z, room, items, clearance = 0.42) {
  if (Math.abs(x) > room.width / 2 - clearance || Math.abs(z) > room.depth / 2 - clearance) return false;
  return items.every(item => {
    const dx = x - item.x, dz = z - item.z, c = Math.cos(item.rotation), s = Math.sin(item.rotation), d = CATALOG[item.type];
    return Math.abs(c * dx - s * dz) > d.width / 2 + clearance || Math.abs(s * dx + c * dz) > d.depth / 2 + clearance;
  });
}
// A bounded grid routes the eye-level section around the current furniture.
// A closed-off or packed room yields a stationary interior shot, never a path through objects.
export function walkingRoute(room, items) {
  const step = 0.4, nx = Math.floor((room.width - 1.2) / step) + 1, nz = Math.floor((room.depth - 1.2) / step) + 1;
  const cells = [], index = (x, z) => z * nx + x;
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) cells.push({ x: -room.width / 2 + 0.6 + x * step, z: -room.depth / 2 + 0.45 + z * step });
  const free = cells.map(p => walkable(p.x, p.z, room, items, 0.45));
  const closest = (x, z, candidates) => candidates.reduce((best, i) => Math.hypot(cells[i].x - x, cells[i].z - z) < Math.hypot(cells[best].x - x, cells[best].z - z) ? i : best, candidates[0]);
  const available = free.flatMap((ok, i) => ok ? [i] : []);
  if (!available.length) return [];
  const front = -room.depth / 2 + 0.45;
  // Require an entry point at the double doors instead of teleporting past a barrier.
  const entrances = available.filter(i => cells[i].z <= front + 0.05
    && Math.abs(cells[i].x) < Math.min(3.2, room.width * 0.3) / 2 - 0.42
    && [0.1, 0.2, 0.3, 0.4, 0.5].every(d => walkable(cells[i].x, -room.depth / 2 + d, room, items, Math.min(d, 0.42))));
  if (!entrances.length) return [];
  const start = closest(0, front, entrances), queue = [start], parent = new Map([[start, null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor], x = id % nx, z = Math.floor(id / nx);
    for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const xx = x + dx, zz = z + dz, next = index(xx, zz);
      if (xx < 0 || xx >= nx || zz < 0 || zz >= nz || !free[next] || parent.has(next) || ![0.25, 0.5, 0.75].every(t => walkable(cells[id].x + dx * step * t, cells[id].z + dz * step * t, room, items, 0.45))) continue;
      parent.set(next, id); queue.push(next);
    }
  }
  const end = closest(0, room.depth * 0.3, queue), route = [];
  for (let i = end; i !== null; i = parent.get(i)) route.push([cells[i].x, 1.65, cells[i].z]);
  return route.reverse();
}
function along(points, progress) {
  if (points.length === 1) return points[0];
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(scaled));
  return blend(points[i], points[i + 1], scaled - i);
}
export function createTour(room, items, aspect = 1) {
  const route = walkingRoute(room, items), inside = route.length > 0;
  const entry = inside ? route[0] : [0, 1.65, -room.depth / 2 - 1.8];
  const last = inside ? route.at(-1) : entry;
  const exterior = [0, Math.min(room.eaves + 1, 7), -room.depth / 2 - 10];
  const threshold = [entry[0], 1.65, -room.depth / 2 - 2.5];
  const forward = [entry[0], 1.65, room.depth / 3];
  function walk(t) {
    // Round grid corners within the extra clearance reserved by the route planner.
    const rounded = blend(along(route, Math.max(0, t - 0.008)), along(route, Math.min(1, t + 0.008)), 0.5);
    // Preserve exact endpoints so the entrance and final pan have no position jump.
    const endpoint = t < 0.5 ? route[0] : route.at(-1);
    return blend(endpoint, rounded, smooth(Math.min(t, 1 - t) / 0.025));
  }
  function sampleRaw(seconds) {
      const t = Math.max(0, Math.min(TOUR_DURATION, seconds));
      let position, target, fov = 43;
      if (t < ENTRY_START) {
        const p = smooth(t / ENTRY_START);
        position = blend(exterior, threshold, p); target = forward; fov = mix(48, 62, p);
      } else if (t < WALK_START) {
        const p = smooth((t - ENTRY_START) / 2); position = blend(threshold, entry, p); target = forward; fov = 62;
      } else if (t < WALK_END && inside && route.length > 1) {
        const p = smooth((t - WALK_START) / (WALK_END - WALK_START)); position = walk(p); fov = 62;
        const ahead = walk(Math.min(1, p + 0.08));
        target = blend(forward, [ahead[0], 1.65, Math.max(position[2] + 0.7, ahead[2])], smooth((t - WALK_START) / 2));
      } else {
        position = last; fov = 62;
        // Pan across the roof structure and turn gently back towards the gathering space.
        const p = smooth((t - WALK_END) / (TOUR_DURATION - WALK_END)), angle = p * Math.PI;
        target = [last[0] + Math.sin(angle) * room.width * 0.35, mix(1.65, room.eaves * 0.65, Math.sin(p * Math.PI)), last[2] + Math.cos(angle) * room.depth * 0.25];
      }
      const chapter = [...CHAPTERS].reverse().find(c => t >= c.start);
      return { position, target, fov, roofOpacity: 1, structureVisible: true, doorOpen: smooth((t - 2) / 4), chapter };
  }
  return {
    route, inside,
    sample(seconds) {
      const t = Math.max(0, Math.min(TOUR_DURATION, seconds));
      // Blend across chapter boundaries, including the walking path's corners.
      // Smooth both position and viewing direction: averaging raw look-at points
      // would give distant targets disproportionate influence and cause a head snap.
      const position = [0, 0, 0], direction = [0, 0, 0];
      let weightSum = 0, fov = 0, roofOpacity = 0;
      for (let i = -20; i <= 20; i++) {
        const offset = i / 20, weight = (1 + Math.cos(Math.PI * offset)) / 2;
        const shot = sampleRaw(t + offset * 0.55);
        const delta = shot.target.map((v, axis) => v - shot.position[axis]);
        const length = Math.hypot(...delta) || 1;
        for (let axis = 0; axis < 3; axis++) { position[axis] += shot.position[axis] * weight; direction[axis] += delta[axis] / length * weight; }
        fov += shot.fov * weight; roofOpacity += shot.roofOpacity * weight; weightSum += weight;
      }
      for (let axis = 0; axis < 3; axis++) position[axis] /= weightSum;
      const length = Math.hypot(...direction) || 1;
      return { ...sampleRaw(t), up: [0, 1, 0], position, target: position.map((v, axis) => v + direction[axis] / length * 10), fov: fov / weightSum, roofOpacity: roofOpacity / weightSum };
    },
  };
}
