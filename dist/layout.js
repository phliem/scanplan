export const ROOM = { width: 12, depth: 22, eaves: 5.2, ridge: 7.2 };
export const CATALOG = {
  stage: { name: 'Stage', width: 6, depth: 2.5, height: 0.6, color: '#404b50' },
  couch: { name: 'Couch', width: 2.3, depth: 0.95, height: 0.95, color: '#9b4541' },
  table: { name: 'Work table', width: 2.0, depth: 0.9, height: 0.75, color: '#bd8a4b' },
  chair: { name: 'Chair', width: 0.5, depth: 0.55, height: 0.85, color: '#3c5049' },
};
export function bounds(item) {
  const d = CATALOG[item.type], c = Math.abs(Math.cos(item.rotation)), s = Math.abs(Math.sin(item.rotation));
  return { x: (d.width * c + d.depth * s) / 2, z: (d.width * s + d.depth * c) / 2 };
}
export function constrain(item) {
  const b = bounds(item);
  return { ...item, x: Math.max(-ROOM.width / 2 + b.x + 0.15, Math.min(ROOM.width / 2 - b.x - 0.15, item.x)), z: Math.max(-ROOM.depth / 2 + b.z + 0.15, Math.min(ROOM.depth / 2 - b.z - 0.15, item.z)) };
}
export function overlaps(a, b) {
  // Separating-axis test for rotated rectangular furniture footprints.
  const axes = [-a.rotation, -a.rotation + Math.PI / 2, -b.rotation, -b.rotation + Math.PI / 2];
  return axes.every(angle => {
    const x = Math.cos(angle), z = Math.sin(angle);
    const radius = item => { const d = CATALOG[item.type]; return Math.abs(Math.cos(item.rotation) * x - Math.sin(item.rotation) * z) * d.width / 2 + Math.abs(Math.sin(item.rotation) * x + Math.cos(item.rotation) * z) * d.depth / 2; };
    return Math.abs((a.x - b.x) * x + (a.z - b.z) * z) < radius(a) + radius(b) - 0.01;
  });
}
export function validLayout(value) {
  return Array.isArray(value) && value.length <= 200 && value.every(v => v && Object.hasOwn(CATALOG, v.type) && ['x', 'z', 'rotation'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Math.abs(v[k]) < 10000));
}
export function initialLayout() {
  const items = [];
  for (const x of [-3.5, 3.5]) for (const z of [-6, -2, 2]) {
    items.push({ type: 'table', x, z, rotation: 0 });
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.85, 0.85]) items.push({ type: 'chair', x: x + dx, z: z + dz, rotation: dz < 0 ? 0 : Math.PI });
  }
  items.push({ type: 'couch', x: -2, z: 7, rotation: 0 }, { type: 'couch', x: 2, z: 7, rotation: 0 }, { type: 'table', x: 0, z: 4.8, rotation: 0 });
  return items;
}

export const ACTIVITIES = {
  hackathon: { name: 'Hackathon', description: 'Team worktables with four chairs each and a central aisle.' },
  theatre: { name: 'Theatre night', description: 'A stage with forward-facing seating and a central aisle.' },
};

// Deterministic arrangements in the existing estimated room, with furniture gaps.
// These are planning assumptions, not a fire, accessibility or occupancy assessment.
export function activityLayout(activity, requested) {
  if (!Object.hasOwn(ACTIVITIES, activity)) throw new RangeError('Choose an activity.');
  if (!Number.isInteger(requested) || requested < 1 || requested > 1000) throw new RangeError('Enter a whole number from 1 to 1,000.');
  const capacity = activity === 'hackathon' ? 112 : 180;
  const seated = Math.min(requested, capacity), items = [];
  const add = (type, x, z, rotation = 0) => items.push({ type, x, z, rotation });
  if (activity === 'hackathon') {
    let remaining = seated;
    for (let row = 0; row < 7 && remaining; row++) for (const x of [-4.1, -1.9, 1.9, 4.1]) {
      if (!remaining) break;
      const z = -8.7 + row * 2.9;
      add('table', x, z);
      for (const dz of [-0.85, 0.85]) for (const dx of [-0.6, 0.6]) {
        if (!remaining) break;
        add('chair', x + dx, z + dz, dz < 0 ? 0 : Math.PI);
        remaining--;
      }
    }
  } else {
    add('stage', 0, -8.8);
    for (let i = 0; i < seated; i++) {
      const column = i % 12, row = Math.floor(i / 12);
      const x = column < 6 ? -4.25 + column * 0.65 : 1 + (column - 6) * 0.65;
      add('chair', x, -5.7 + row * 0.95, Math.PI);
    }
  }
  return { activity, requested, seated, capacity, shortfall: requested - seated, items };
}
