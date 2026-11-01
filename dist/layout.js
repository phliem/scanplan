export const DEFAULT_ROOM = Object.freeze({ width: 12, depth: 22, eaves: 5.2, ridge: 7.2 });
export const ROOM = { ...DEFAULT_ROOM };
export function validRoom(room) {
  return !!room && ['width', 'depth', 'eaves', 'ridge'].every(k => typeof room[k] === 'number' && Number.isFinite(room[k]))
    && room.width >= 6 && room.width <= 60 && room.depth >= 6 && room.depth <= 60
    && room.eaves >= 3 && room.eaves <= 15 && room.ridge >= room.eaves + 0.5 && room.ridge <= 20;
}
export const CATALOG = {
  stage: { name: 'Stage', width: 6, depth: 2.5, height: 0.6, color: '#404b50' },
  couch: { name: 'Couch', width: 2.3, depth: 0.95, height: 0.95, color: '#9b4541' },
  table: { name: 'Work table', width: 2.0, depth: 0.9, height: 0.75, color: '#bd8a4b' },
  chair: { name: 'Chair', width: 0.5, depth: 0.55, height: 0.85, color: '#3c5049' },
};
// Built-in procedural models: stable type IDs also survive save/export/undo.
export const COUCH_TYPES = [
  ['couch-chesterfield', 'Oxblood Chesterfield', '#793e43', 'chesterfield'],
  ['couch-scandi', 'Sage Scandinavian', '#849982', 'scandi'],
  ['couch-channel', 'Mustard channel couch', '#cf9f43', 'channel'],
  ['couch-tuxedo', 'Navy tuxedo couch', '#344d70', 'tuxedo'],
  ['couch-cloud', 'Cream cloud couch', '#e8ddc9', 'cloud'],
  ['couch-midcentury', 'Terracotta mid-century', '#b9674c', 'midcentury'],
  ['couch-modular', 'Lavender modular couch', '#9988af', 'modular'],
  ['couch-bench', 'Teal timber couch', '#387e7d', 'bench'],
].map(([type, name, color, style]) => {
  CATALOG[type] = { name, color, style, kind: 'couch', width: 2.1, depth: 0.95, height: 0.95, seatHeight: 0.57 };
  return type;
});
for (const [type, name, color] of [
  ['coffee', 'Coffee station', '#74503a'], ['tea', 'Tea station', '#67846d'], ['snacks', 'Snack table', '#c08b47'],
]) CATALOG[type] = { name, color, kind: 'refreshment', width: 1.6, depth: 0.65, height: 1.15 };
export const isCouch = type => type === 'couch' || CATALOG[type]?.kind === 'couch';
export function bounds(item) {
  const d = CATALOG[item.type], c = Math.abs(Math.cos(item.rotation)), s = Math.abs(Math.sin(item.rotation));
  return { x: (d.width * c + d.depth * s) / 2, z: (d.width * s + d.depth * c) / 2 };
}
export function constrain(item, room = ROOM) {
  const b = bounds(item);
  return { ...item, x: Math.max(-room.width / 2 + b.x + 0.15, Math.min(room.width / 2 - b.x - 0.15, item.x)), z: Math.max(-room.depth / 2 + b.z + 0.15, Math.min(room.depth / 2 - b.z - 0.15, item.z)) };
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
  hackathon: { name: 'Hackathon', description: '100 desk seats, eight colourful couch designs, plus coffee, tea and snacks in the default venue. Central aisle between team tables.' },
  theatre: { name: 'Theatre night', description: 'A stage with forward-facing seating and a central aisle.' },
};

// Deterministic arrangements in the existing estimated room, with furniture gaps.
// These are planning assumptions, not a fire, accessibility or occupancy assessment.
export function activityLayout(activity, requested, room = ROOM) {
  if (!Object.hasOwn(ACTIVITIES, activity)) throw new RangeError('Choose an activity.');
  if (!Number.isInteger(requested) || requested < 1 || requested > 1000) throw new RangeError('Enter a whole number from 1 to 1,000.');
  if (!validRoom(room)) throw new RangeError('Use valid room dimensions.');
  const items = [], slots = [];
  const add = (type, x, z, rotation = 0) => items.push(constrain({ type, x, z, rotation }, room));
  let capacity;
  if (activity === 'hackathon') {
    // Reserve the entrance end for a lounge and refreshments when the room
    // can fit the full amenity area. Smaller rooms keep honest desk shortfalls.
    const lounge = room.width >= 11 && room.depth >= 18;
    if (lounge) {
      const end = room.depth / 2;
      const xs = [-4.3, -1.7, 1.7, 4.3];
      COUCH_TYPES.forEach((type, i) => add(type, xs[i % 4], end - (i < 4 ? 3.35 : 1.2), i < 4 ? 0 : Math.PI));
      ['coffee', 'tea', 'snacks'].forEach((type, i) => add(type, [-4.3, -2.4, 4.3][i], end - 4.9));
    }
    const columns = [];
    for (let x = 1.9; x <= room.width / 2 - 1.15 + 1e-9; x += 2.2) columns.push(-x, x);
    columns.sort((a, b) => a - b);
    const maxTables = Math.floor((200 - items.length) / 5);
    const lastZ = room.depth / 2 - (lounge ? 6.7 : 2.3);
    for (let z = -room.depth / 2 + 1.4; z <= lastZ + 1e-9; z += lounge ? 2.3 : 2.9)
      for (const x of columns) if (slots.length < maxTables) slots.push({ x, z });
    capacity = slots.length * 4; // Desk seats only; lounge seats are additional.
    let remaining = Math.min(requested, capacity);
    for (const { x, z } of slots) {
      if (!remaining) break;
      add('table', x, z);
      for (const dz of [-0.85, 0.85]) for (const dx of [-0.6, 0.6]) {
        if (!remaining) break;
        add('chair', x + dx, z + dz, dz < 0 ? 0 : Math.PI);
        remaining--;
      }
    }
  } else {
    const columns = [];
    for (let x = 1; x <= room.width / 2 - 1.75 + 1e-9; x += 0.65) columns.push(-x, x);
    columns.sort((a, b) => a - b);
    const stageFits = room.width >= CATALOG.stage.width + 0.3;
    if (stageFits) for (let z = -room.depth / 2 + 5.3; z <= room.depth / 2 - 3.4 + 1e-9; z += 0.95)
      for (const x of columns) if (slots.length < 199) slots.push({ x, z });
    capacity = slots.length;
    if (capacity) add('stage', 0, -room.depth / 2 + 2.2);
    for (const { x, z } of slots.slice(0, requested)) add('chair', x, z, Math.PI);
  }
  if (activity === 'hackathon') items.sort((a, b) => Number(isCouch(a.type) || CATALOG[a.type].kind === 'refreshment') - Number(isCouch(b.type) || CATALOG[b.type].kind === 'refreshment'));
  const seated = Math.min(requested, capacity);
  return { activity, requested, seated, capacity, shortfall: requested - seated, items };
}
