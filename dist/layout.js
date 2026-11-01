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
  hackathon: { name: 'Hackathon', description: 'Five table groups and two couch groups for 150 people. Larger rooms follow the photo: side worktables, central lounges and refreshments against the right wall.' },
  theatre: { name: 'Theatre night', description: 'A stage with forward-facing seating and a central aisle.' },
};

export const LAYOUT_STYLES = {
  photo: { name: 'Photo reference', description: 'Long worktables along the sides, with central lounges.' },
  pockets: { name: 'Creative pockets', description: 'Paired and single tables, gentle angles and tucked-away sofa corners.' },
  commons: { name: 'Warehouse commons', description: 'Mixed table directions, generous gaps and social lounge pockets.' },
  ramble: { name: 'Loose & lively', description: 'Staggered tables, playful angles and a winding route through the room.' },
};

// Deterministic arrangements in the existing estimated room, with furniture gaps.
// These are planning assumptions, not a fire, accessibility or occupancy assessment.
export function activityLayout(activity, requested, room = ROOM, layoutStyle = 'photo') {
  if (!Object.hasOwn(ACTIVITIES, activity)) throw new RangeError('Choose an activity.');
  if (!Number.isInteger(requested) || requested < 1 || requested > 1000) throw new RangeError('Enter a whole number from 1 to 1,000.');
  if (!validRoom(room)) throw new RangeError('Use valid room dimensions.');
  if (!Object.hasOwn(LAYOUT_STYLES, layoutStyle)) throw new RangeError('Choose a layout style.');
  if (activity === 'hackathon' && layoutStyle !== 'photo') return relaxedLayout(requested, room, layoutStyle);
  const items = [], slots = [];
  const add = (type, x, z, rotation = 0) => items.push(constrain({ type, x, z, rotation }, room));
  let capacity;
  if (activity === 'hackathon') {
    const lounge = room.width >= 11 && room.depth >= 18;
    const grouped = room.width >= 11 && room.depth >= 22;
    const photoLayout = room.width >= 14 && room.depth >= 28;
    const seatsPerTable = 6;
    if (lounge) {
      COUCH_TYPES.forEach((type, i) => {
        const side = i < 4 ? -1 : 1;
        if (photoLayout) {
          const row = Math.floor(i % 4 / 2);
          const centreZ = room.depth * (i < 4 ? -0.23 : 0.13);
          add(type, i % 2 ? 1.15 : -1.15, centreZ + (row ? 1.1 : -1.1), row ? Math.PI : 0);
        } else if (grouped) {
          // Two facing pairs in each of two separate four-couch lounges.
          const row = Math.floor(i % 4 / 2);
          add(type, side * room.width / 4 + (i % 2 ? 1.15 : -1.15), room.depth / 2 - (row ? 1.4 : 3.6), row ? Math.PI : 0);
        } else {
          const z = (i % 4 / 3 - 0.5) * (room.depth - 7.6);
          add(type, side * (room.width / 2 - 0.7), z, -side * Math.PI / 2);
        }
      });
    }
    // Leave a clear entry apron before the first chairs.
    const firstZ = -room.depth / 2 + 2.1, lastZ = room.depth / 2 - (grouped ? 6.6 : 1.4);
    const rows = Math.max(1, Math.floor((lastZ - firstZ) / 2.3) + 1);
    const columns = [];
    const outerX = room.width / 2 - (lounge ? 2.4 : 1.15);
    const columnCount = Math.max(1, Math.floor(outerX * 2 / 3.1) + 1);
    for (let col = 0; col < columnCount; col++) columns.push(columnCount === 1 ? 0 : -outerX + col * 2 * outerX / (columnCount - 1));
    if (photoLayout) {
      // Photo-inspired plan: two long worktable banks on each side, a fifth
      // bank across the foreground, and two central conversation areas.
      const sideX = room.width / 2 - 3;
      const foregroundZ = room.depth / 2 - 2.1;
      const groups = [
        { x: -sideX, z: firstZ + 4, rotation: Math.PI / 2 },
        { x: sideX, z: firstZ + 4, rotation: Math.PI / 2 },
        { x: -sideX, z: foregroundZ - 8.2, rotation: Math.PI / 2 },
        { x: sideX, z: foregroundZ - 8.2, rotation: Math.PI / 2 },
        { x: 0, z: foregroundZ, rotation: 0 },
      ];
      for (const offset of [0, -2, 2, -4, 4]) for (const group of groups)
        slots.push({ x: group.x + Math.cos(group.rotation) * offset, z: group.z - Math.sin(group.rotation) * offset, rotation: group.rotation });
      ['coffee', 'tea', 'snacks'].forEach((type, i) => add(type, room.width / 2 - 0.65, -room.depth * 0.28 + i * 2.5, -Math.PI / 2));
    } else if (grouped) {
      // Five joined worktables per group, six chairs per table: 30 people.
      // Assign one table to each group in turn so smaller requests stay spread.
      for (const x of [0, -2, 2, -4, 4]) for (let group = 0; group < 5; group++)
        slots.push({ x, z: firstZ + group * (lastZ - firstZ) / 4 });
      const end = room.depth / 2;
      add('coffee', -room.width / 4 - 1.15, end - 4.9);
      add('tea', -room.width / 4 + 1.15, end - 4.9);
      add('snacks', room.width / 4, end - 4.9);
    } else {
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns.length; col++) {
        if (lounge && row === rows - 1 && (col === 0 || col === columns.length - 1)) continue;
        slots.push({ x: columns[col], z: rows === 1 ? 0 : firstZ + row * (lastZ - firstZ) / (rows - 1) });
      }
      if (lounge) {
        add('coffee', columns[0], lastZ - 0.5);
        add('tea', columns[0], lastZ + 0.5);
        add('snacks', columns.at(-1), lastZ);
      }
    }
    const maxTables = Math.min(slots.length, Math.floor((200 - items.length) / (seatsPerTable + 1)));
    capacity = maxTables * seatsPerTable; // Lounge seats are additional.
    let remaining = Math.min(requested, capacity);
    const tableCount = Math.ceil(remaining / seatsPerTable);
    // Sample across the whole grid, even for smaller groups, instead of filling
    // from the entrance and leaving the far half empty.
    for (let i = 0; i < tableCount; i++) {
      const index = grouped ? i : tableCount === 1 ? Math.floor((slots.length - 1) / 2) : Math.round(i * (slots.length - 1) / (tableCount - 1));
      const { x, z, rotation = 0 } = slots[index];
      add('table', x, z, rotation);
      for (const dz of [-0.85, 0.85]) for (const dx of [-0.67, 0, 0.67]) {
        if (!remaining) break;
        add('chair', x + Math.cos(rotation) * dx + Math.sin(rotation) * dz, z - Math.sin(rotation) * dx + Math.cos(rotation) * dz, rotation + (dz < 0 ? 0 : Math.PI));
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

function relaxedLayout(requested, room, layoutStyle) {
  if (room.width < 14 || room.depth < 28) throw new RangeError('Relaxed layouts need a room at least 14 × 28 m.');
  const schemes = {
    pockets: { lounges: [[2, 0], [5, 2]], refreshments: [7, 0], gaps: [[0, 3], [4, 1]], seed: 17 },
    commons: { lounges: [[4, 0], [1, 2]], refreshments: [7, 3], gaps: [[0, 0], [5, 2]], seed: 43 },
    ramble: { lounges: [[1, 0], [6, 2]], refreshments: [0, 3], gaps: [[3, 1], [4, 2]], seed: 79 },
  };
  const scheme = schemes[layoutStyle], items = [], slots = [];
  const outerX = room.width / 2 - 1.95;
  const xs = Array.from({ length: 4 }, (_, i) => -outerX + i * outerX * 2 / 3);
  const zs = Array.from({ length: 8 }, (_, i) => -room.depth / 2 + 2 + i * (room.depth - 4.1) / 7);
  let seed = scheme.seed;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const transform = (type, x, z, rotation, dx = 0, dz = 0, turn = 0) => ({ type,
    x: x + Math.cos(rotation) * dx + Math.sin(rotation) * dz,
    z: z - Math.sin(rotation) * dx + Math.cos(rotation) * dz, rotation: rotation + turn });
  scheme.lounges.forEach(([row, col], group) => {
    const x = (xs[col] + xs[col + 1]) / 2, z = zs[row];
    const angle = group ? -0.06 : 0.06;
    for (let seat = 0; seat < 4; seat++) items.push(transform(COUCH_TYPES[group * 4 + seat], x, z, angle,
      seat % 2 ? 1.15 : -1.15, seat < 2 ? -1.1 : 1.1, seat < 2 ? 0 : Math.PI));
  });
  const [refreshRow, refreshCol] = scheme.refreshments;
  const rx = xs[refreshCol], rz = zs[refreshRow];
  items.push(transform('coffee', rx, rz, 0, -0.85, -0.3), transform('tea', rx, rz, 0, 0.85, -0.3), transform('snacks', rx, rz, 0, 0, 0.65));
  const reserved = (row, col) => scheme.lounges.some(([r, c]) => row === r && (col === c || col === c + 1))
    || (row === refreshRow && col === refreshCol) || scheme.gaps.some(([r, c]) => row === r && col === c);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    if (reserved(row, col)) continue;
    const stagger = layoutStyle === 'ramble' ? (row % 2 ? 0.24 : -0.24) : 0;
    const x = xs[col] + stagger + (random() - 0.5) * 0.22;
    const z = zs[row] + (random() - 0.5) * 0.38;
    const angle = (random() - 0.5) * (layoutStyle === 'ramble' ? 0.32 : 0.2);
    const rotation = angle + (layoutStyle === 'commons' && (row + col) % 3 === 0 ? Math.PI / 2 : 0);
    slots.push({ x, z, rotation, row, col });
  }
  if (layoutStyle === 'pockets') {
    // Twelve of the 25 tables make six end-to-end pairs; the rest stay loose.
    for (const [row, col] of [[0, 0], [1, 2], [3, 0], [4, 2], [5, 0], [6, 2]]) {
      const a = slots.find(s => s.row === row && s.col === col);
      const b = slots.find(s => s.row === row && s.col === col + 1);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, angle = (a.rotation + b.rotation) / 2;
      for (const [slot, offset] of [[a, -1], [b, 1]]) {
        slot.x = cx + Math.cos(angle) * offset; slot.z = cz - Math.sin(angle) * offset; slot.rotation = angle;
      }
    }
  }
  const capacity = slots.length * 6, seated = Math.min(requested, capacity);
  const tableCount = Math.ceil(seated / 6);
  let remaining = seated;
  for (let i = 0; i < tableCount; i++) {
    const index = tableCount === 1 ? Math.floor(slots.length / 2) : Math.round(i * (slots.length - 1) / (tableCount - 1));
    const { x, z, rotation } = slots[index];
    items.unshift(transform('table', x, z, rotation));
    for (const dz of [-0.85, 0.85]) for (const dx of [-0.67, 0, 0.67]) {
      if (!remaining) break;
      items.unshift(transform('chair', x, z, rotation, dx, dz, dz < 0 ? 0 : Math.PI)); remaining--;
    }
  }
  return { activity: 'hackathon', layoutStyle, requested, seated, capacity, shortfall: requested - seated, items };
}
