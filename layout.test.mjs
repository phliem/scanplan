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
