// Illustrative occupancy only: this is not a capacity or evacuation model.
export const MAX_PEOPLE = 500;
export const DEFAULT_CROWD = Object.freeze({ count: 0, behavior: 'mixed', paused: false });
export function validCrowd(value) {
  return !!value && Number.isInteger(value.count) && value.count >= 0 && value.count <= MAX_PEOPLE
    && ['mixed', 'walking', 'seated'].includes(value.behavior) && typeof value.paused === 'boolean';
}
const STEP = 0.5, RADIUS = 0.23;
function localPoint(x, z, item) {
  const c = Math.cos(item.rotation), s = Math.sin(item.rotation), dx = x - item.x, dz = z - item.z;
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}
export function clearPoint(x, z, room, items, catalog, ignore = null) {
  return Math.abs(x) <= room.width / 2 - 0.4 && Math.abs(z) <= room.depth / 2 - 0.4
    && items.every(item => {
      if (item === ignore) return true;
      const p = localPoint(x, z, item), d = catalog[item.type];
      return Math.hypot(Math.max(0, Math.abs(p.x) - d.width / 2), Math.max(0, Math.abs(p.z) - d.depth / 2)) >= RADIUS;
    });
}
export function createCrowd(config, room, items, catalog) {
  const people = [], cells = [], byKey = new Map();
  if (!validCrowd(config) || !config.count) return { people, requested: 0, seated: 0, walking: 0, standing: 0 };
  // Sample edges too: a clear destination alone can allow crossing a thin object.
  for (let iz = 0, z = -room.depth / 2 + 0.5; z <= room.depth / 2 - 0.5; iz++, z += STEP) {
    for (let ix = 0, x = -room.width / 2 + 0.5; x <= room.width / 2 - 0.5; ix++, x += STEP) {
      if (!clearPoint(x, z, room, items, catalog)) continue;
      const cell = { x, z, ix, iz, neighbors: [] }; cells.push(cell); byKey.set(`${ix},${iz}`, cell);
    }
  }
  for (const cell of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const next = byKey.get(`${cell.ix + dx},${cell.iz + dz}`);
    if (next && [0.25, 0.5, 0.75].every(t => clearPoint(cell.x + dx * STEP * t, cell.z + dz * STEP * t, room, items, catalog))) cell.neighbors.push(next);
  }
  const targetSeats = config.behavior === 'walking' ? 0 : config.behavior === 'seated' ? config.count : Math.round(config.count / 2);
  for (const item of items) {
    const offsets = item.type === 'chair' ? [0] : item.type === 'couch' ? [-0.64, 0, 0.64] : [];
    for (const offset of offsets) {
      if (people.length >= targetSeats) break;
      const c = Math.cos(item.rotation), s = Math.sin(item.rotation);
      const x = item.x + c * offset + s * 0.06, z = item.z - s * offset + c * 0.06;
      // Keep seated knees clear of other furniture and the room boundary.
      if (!clearPoint(x, z, room, items, catalog, item)) continue;
      // Knees can tuck under a work table, but never under another seat or solid model.
      const kneeObstacles = items.filter(other => other.type !== 'table');
      if (![0.35, 0.55].every(forward => clearPoint(x + s * forward, z + c * forward, room, kneeObstacles, catalog, item))) continue;
      people.push({ x, z, rotation: item.rotation, state: 'seated', seatHeight: item.type === 'couch' ? 0.65 : 0.5 });
    }
  }
  // Spread people across the floor reproducibly; one initial occupant per cell.
  let seed = 71;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (const cell of cells) {
    if (people.length >= config.count) break;
    if (people.some(p => p.state === 'seated' && Math.hypot(p.x - cell.x, p.z - cell.z) < 0.7)) continue;
    const walking = config.behavior !== 'seated' && cell.neighbors.length > 0;
    people.push({ x: cell.x, z: cell.z, rotation: random() * Math.PI * 2, state: walking ? 'walking' : 'standing', cell, target: null, phase: random() * Math.PI * 2, speed: 0.65 + random() * 0.35, wait: random() * 2 });
  }
  return { people, requested: config.count, seated: people.filter(p => p.state === 'seated').length, walking: people.filter(p => p.state === 'walking').length, standing: people.filter(p => p.state === 'standing').length };
}
export function advanceCrowd(crowd, delta) {
  const dt = Math.max(0, Math.min(0.05, delta));
  for (const p of crowd.people) {
    if (p.state !== 'walking') continue;
    if (p.wait > 0) { p.wait -= dt; continue; }
    if (!p.target) {
      // Rotating the choice gives walkers different routes without frame-rate randomness.
      p.turn = (p.turn || 0) + 1;
      p.target = p.cell.neighbors[(p.turn + Math.floor(p.phase * 10)) % p.cell.neighbors.length];
      p.rotation = Math.atan2(p.target.x - p.x, p.target.z - p.z);
    }
    const dx = p.target.x - p.x, dz = p.target.z - p.z, distance = Math.hypot(dx, dz), step = p.speed * dt;
    if (distance <= step) { p.x = p.target.x; p.z = p.target.z; p.cell = p.target; p.target = null; if (p.turn % 9 === 0) p.wait = 1.5; }
    else { p.x += dx / distance * step; p.z += dz / distance * step; }
    p.phase += dt * 8;
  }
}
