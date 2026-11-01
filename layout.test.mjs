import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, CATALOG, bounds, constrain, overlaps, validLayout, initialLayout } from './dist/layout.js';
test('all furniture stays inside room at cardinal and diagonal rotations', () => {
  for (const type of Object.keys(CATALOG)) for (const rotation of [0, Math.PI / 4, Math.PI / 2, Math.PI * 1.7]) for (const sign of [-1, 1]) {
    const item = constrain({ type, rotation, x: 100 * sign, z: 100 * sign });
    const b = bounds(item);
    assert.ok(Math.abs(item.x) + b.x <= ROOM.width / 2 - 0.149);
    assert.ok(Math.abs(item.z) + b.z <= ROOM.depth / 2 - 0.149);
  }
});
test('rotated collision detection is symmetric and permits separated objects', () => {
  const a = { type: 'table', x: 0, z: 0, rotation: Math.PI / 4 };
  const b = { type: 'couch', x: 0.5, z: 0, rotation: -Math.PI / 4 };
  assert.equal(overlaps(a, b), true); assert.equal(overlaps(b, a), true);
  assert.equal(overlaps(a, { ...b, x: 5 }), false);
  assert.equal(overlaps({ ...a, rotation: 0 }, { ...a, x: 2, rotation: 0 }), false);
});
test('starting layout fits without furniture overlaps', () => {
  const items = initialLayout(); assert.ok(validLayout(items));
  for (let a = 0; a < items.length; a++) {
    assert.deepEqual(constrain(items[a]), items[a]);
    for (let b = a + 1; b < items.length; b++) assert.equal(overlaps(items[a], items[b]), false, `overlap ${a} ${b}`);
  }
});
test('saved layout rejects malformed, nonfinite and excessive input', () => {
  const item = initialLayout()[0];
  for (const data of [null, {}, [null], [{ ...item, type: '__proto__' }], [{ ...item, x: NaN }], [{ ...item, rotation: Infinity }], Array(201).fill(item)]) assert.equal(validLayout(data), false);
  assert.equal(validLayout([]), true);
});
test('collision axes match Three.js rotations beyond 45 degree steps', () => {
  const a = { type: 'table', x: 0, z: 0, rotation: Math.PI / 6 };
  assert.equal(overlaps(a, { ...a, z: 1.1 }), false);
  assert.equal(overlaps(a, { ...a, z: 0.5 }), true);
});

test('activity layouts seat requested guests within bounds without overlaps', async () => {
  const { activityLayout } = await import('./dist/layout.js');
  for (const activity of ['hackathon', 'theatre']) for (const requested of [1, 3, 4, 5, 80, 100, 112, 150, 180, 1000]) {
    const plan = activityLayout(activity, requested);
    assert.ok(validLayout(plan.items));
    assert.equal(plan.seated, Math.min(requested, plan.capacity));
    assert.equal(plan.shortfall, requested - plan.seated);
    assert.equal(plan.items.filter(i => i.type === 'chair').length, plan.seated);
    assert.equal(plan.items.filter(i => i.type === 'stage').length, activity === 'theatre' ? 1 : 0);
    for (let a = 0; a < plan.items.length; a++) {
      assert.deepEqual(constrain(plan.items[a]), plan.items[a]);
      for (let b = a + 1; b < plan.items.length; b++) assert.equal(overlaps(plan.items[a], plan.items[b]), false, `${activity} ${requested}: overlap ${a} ${b}`);
    }
    assert.deepEqual(activityLayout(activity, requested), plan);
  }
});
test('activity layouts reject invalid requests', async () => {
  const { activityLayout } = await import('./dist/layout.js');
  for (const requested of [0, -1, NaN, Infinity, 1.5, '100', 1001]) assert.throws(() => activityLayout('hackathon', requested), RangeError);
  for (const activity of ['wedding', '__proto__', null]) assert.throws(() => activityLayout(activity, 100), RangeError);
});
test('resized rooms constrain furniture without changing its dimensions', () => {
  const small = { width: 6, depth: 8, eaves: 3, ridge: 4 };
  for (const type of Object.keys(CATALOG)) for (const rotation of [0, Math.PI / 6, Math.PI / 4, Math.PI / 2]) {
    const target = type === 'stage' ? { ...small, width: 8 } : small;
    const item = constrain({ type, rotation, x: 50, z: -50 }, target), b = bounds(item);
    assert.ok(Math.abs(item.x) + b.x <= target.width / 2 - 0.149);
    assert.ok(Math.abs(item.z) + b.z <= target.depth / 2 - 0.149);
    assert.equal(item.rotation, rotation);
  }
});
test('room dimensions reject invalid ranges and roofs below the walls', async () => {
  const { validRoom, DEFAULT_ROOM } = await import('./dist/layout.js');
  assert.equal(validRoom(DEFAULT_ROOM), true);
  assert.equal(validRoom({ width: 60, depth: 60, eaves: 15, ridge: 20 }), true);
  for (const room of [null, {}, { ...DEFAULT_ROOM, width: NaN }, { ...DEFAULT_ROOM, depth: Infinity }, { ...DEFAULT_ROOM, width: 5.9 }, { ...DEFAULT_ROOM, depth: 61 }, { ...DEFAULT_ROOM, eaves: 2.9 }, { ...DEFAULT_ROOM, ridge: 5.3 }, { ...DEFAULT_ROOM, ridge: 21 }]) assert.equal(validRoom(room), false);
});

test('activity templates adapt to resized rooms without clamping or exceeding object limits', async () => {
  const { activityLayout, DEFAULT_ROOM } = await import('./dist/layout.js');
  for (const activity of ['hackathon', 'theatre']) {
    for (const width of [6, 6.3, 8, 12, 20, 60]) for (const depth of [6, 8, 12, 22, 60]) {
      const room = { ...DEFAULT_ROOM, width, depth }, plan = activityLayout(activity, 1000, room);
      assert.ok(validLayout(plan.items));
      assert.equal(plan.items.filter(i => i.type === 'chair').length, plan.seated);
      assert.equal(plan.seated + plan.shortfall, 1000);
      for (let a = 0; a < plan.items.length; a++) {
        assert.deepEqual(constrain(plan.items[a], room), plan.items[a]);
        for (let b = a + 1; b < plan.items.length; b++) assert.equal(overlaps(plan.items[a], plan.items[b]), false, `${activity} ${width} x ${depth}: ${a}, ${b}`);
      }
    }
  }
});
