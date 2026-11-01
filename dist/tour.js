import { CATALOG } from './layout.js';
export const TOUR_DURATION = 38;
export const CHAPTERS = [
  { start: 0, title: 'The floor plan', subtitle: 'Every gathering starts with a little perspective.' },
  { start: 5, title: 'From plan to place', subtitle: 'Brick walls. Steel trusses. Room for possibilities.' },
  { start: 13, title: 'Step inside', subtitle: 'A view from 1.65 metres above the floor.' },
  { start: 30, title: 'Take it all in', subtitle: 'Imagine the conversations that could happen here.' },
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
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) cells.push({ x: -room.width / 2 + 0.6 + x * step, z: -room.depth / 2 + 0.6 + z * step });
  const free = cells.map(p => walkable(p.x, p.z, room, items, 0.55));
  const closest = (x, z, candidates) => candidates.reduce((best, i) => Math.hypot(cells[i].x - x, cells[i].z - z) < Math.hypot(cells[best].x - x, cells[best].z - z) ? i : best, candidates[0]);
  const available = free.flatMap((ok, i) => ok ? [i] : []);
  if (!available.length) return [];
  const front = room.depth / 2 - 0.6;
  // Require an entry point near the open front instead of teleporting past a barrier.
  const entrances = available.filter(i => cells[i].z >= front - 0.5);
  if (!entrances.length) return [];
  const start = closest(0, front, entrances), queue = [start], parent = new Map([[start, null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor], x = id % nx, z = Math.floor(id / nx);
    for (const [dx, dz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const xx = x + dx, zz = z + dz, next = index(xx, zz);
      if (xx < 0 || xx >= nx || zz < 0 || zz >= nz || !free[next] || parent.has(next)) continue;
      parent.set(next, id); queue.push(next);
    }
  }
  const end = closest(0, -room.depth * 0.3, queue), route = [];
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
  const entry = inside ? route[0] : [0, 2.3, room.depth / 2 + 1.8];
  const last = inside ? route.at(-1) : entry;
  const floorHeight = Math.max(room.depth, room.width / aspect) * 1.6;
  const overview = [room.width * 0.7, Math.max(room.ridge + 4, room.depth * 0.7), room.depth * 0.9];
  const threshold = [entry[0], 2.1, room.depth / 2 + 2.5];
  const forward = [entry[0], 1.65, -room.depth / 3];
  function walk(t) {
    // Round grid corners within the extra clearance reserved by the route planner.
    return blend(along(route, Math.max(0, t - 0.008)), along(route, Math.min(1, t + 0.008)), 0.5);
  }
  return {
    route, inside,
    sample(seconds) {
      const t = Math.max(0, Math.min(TOUR_DURATION, seconds));
      let position, target, fov = 43;
      if (t < 5) {
        position = [0, floorHeight * mix(1.04, 1, smooth(t / 5)), 0.01]; target = [0, 0, 0];
      } else if (t < 10) {
        const p = smooth((t - 5) / 5); position = blend([0, floorHeight, 0.01], overview, p); target = blend([0, 0, 0], [0, room.eaves / 2, 0], p);
      } else if (t < 13) {
        const p = smooth((t - 10) / 3); position = blend(overview, threshold, p); target = blend([0, room.eaves / 2, 0], forward, p); fov = mix(43, 62, p);
      } else if (t < 16) {
        const p = smooth((t - 13) / 3); position = blend(threshold, entry, p); target = forward; fov = 62;
      } else if (t < 30 && inside && route.length > 1) {
        const p = smooth((t - 16) / 14); position = walk(p); fov = 62;
        const ahead = walk(Math.min(1, p + 0.08));
        target = [ahead[0], 1.65, Math.min(position[2] - 0.7, ahead[2])];
      } else {
        position = last; fov = 62;
        // Pan across the roof structure and turn gently back towards the gathering space.
        const p = smooth((t - 30) / 8), angle = p * Math.PI * 0.72;
        target = [last[0] + Math.sin(angle) * room.width * 0.35, mix(1.65, room.eaves * 0.65, Math.sin(p * Math.PI)), last[2] - Math.cos(angle) * room.depth * 0.25];
      }
      const chapter = [...CHAPTERS].reverse().find(c => t >= c.start);
      return { position, target, fov, roofOpacity: smooth((t - 10) / 5), structureVisible: t >= 5, chapter };
    },
  };
}
