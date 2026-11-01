import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import { activityLayout, DEFAULT_ROOM, CATALOG, COUCH_TYPES, isCouch, constrain, overlaps } from './dist/layout.js';
import { createTour } from './dist/tour.js';
import { createCrowd } from './dist/crowd.js';
import { couchModel, refreshmentModel } from './dist/furniture-models.js';

test('150-person hackathon includes 25 desks, 150 chairs, eight different couches and three stations', () => {
  const plan = activityLayout('hackathon', 150);
  assert.equal(plan.seated, 150); assert.equal(plan.shortfall, 0);
  assert.equal(plan.items.filter(i => i.type === 'table').length, 25);
  assert.equal(plan.items.filter(i => i.type === 'chair').length, 150);
  assert.deepEqual(plan.items.filter(i => isCouch(i.type)).map(i => i.type), COUCH_TYPES);
  for (const type of ['coffee', 'tea', 'snacks']) assert.equal(plan.items.filter(i => i.type === type).length, 1);
  const desks = plan.items.filter(i => i.type === 'table');
  const groups = [...new Set(desks.map(i => i.z))];
  assert.equal(groups.length, 5);
  for (const z of groups) assert.equal(desks.filter(i => i.z === z).length, 5);
  const couches = plan.items.filter(i => isCouch(i.type));
  for (const side of [-1, 1]) {
    const group = couches.filter(i => Math.sign(i.x) === side);
    assert.equal(group.length, 4);
    assert.equal(new Set(group.map(i => i.z)).size, 2);
    assert.equal(group.filter(i => i.rotation === 0).length, 2);
    assert.equal(group.filter(i => i.rotation === Math.PI).length, 2);
  }
  const roundTrip = JSON.parse(JSON.stringify(plan));
  assert.deepEqual(roundTrip, plan);
});

test('all 150 desk seats and 24 extra lounge seats are usable by the crowd', () => {
  for (const room of [DEFAULT_ROOM, { width: 16, depth: 28, eaves: 6, ridge: 9 }]) {
    const plan = activityLayout('hackathon', 150, room);
    for (const count of [150, 174]) {
      const crowd = createCrowd({ count, behavior: 'seated', paused: false }, room, plan.items, CATALOG);
      assert.equal(crowd.seated, count); assert.equal(crowd.standing, 0);
    }
    assert.ok(createTour(room, plan.items).inside, 'The tour can still enter the room');
  }
});

test('generated models stay inside declared selection and collision footprints', () => {
  const silhouettes = new Set();
  for (const type of [...COUCH_TYPES, 'coffee', 'tea', 'snacks']) {
    const d = CATALOG[type], model = isCouch(type) ? couchModel(d) : refreshmentModel(type, d);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(bounds.min.x >= -d.width / 2 - 0.001 && bounds.max.x <= d.width / 2 + 0.001, `${type}: width`);
    assert.ok(bounds.min.z >= -d.depth / 2 - 0.001 && bounds.max.z <= d.depth / 2 + 0.001, `${type}: depth`);
    assert.ok(bounds.min.y >= -0.001 && bounds.max.y <= d.height + 0.001, `${type}: height`);
    if (isCouch(type)) silhouettes.add(JSON.stringify(model.children.map(m => [m.geometry.type, m.geometry.parameters, m.position.toArray(), m.scale.toArray(), m.rotation.toArray()])));
    model.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
  }
  assert.equal(silhouettes.size, 8);
  assert.equal(new Set(COUCH_TYPES.map(t => CATALOG[t].color)).size, 8);
});

test('smaller hackathons distribute desks between up to five groups', () => {
  for (const requested of [6, 24, 60, 100]) {
    const plan = activityLayout('hackathon', requested);
    const desks = plan.items.filter(i => i.type === 'table');
    assert.equal(new Set(desks.map(i => i.z)).size, Math.min(5, desks.length));
    assert.equal(plan.items.filter(i => i.type === 'chair').length, requested);
  }
});

// Identify spatially connected banks instead of relying on generation order.
function groupSizes(items, distance) {
  const pending = new Set(items), sizes = [];
  while (pending.size) {
    const queue = [pending.values().next().value]; pending.delete(queue[0]);
    for (let i = 0; i < queue.length; i++) for (const other of pending)
      if (Math.hypot(other.x - queue[i].x, other.z - queue[i].z) < distance) { queue.push(other); pending.delete(other); }
    sizes.push(queue.length);
  }
  return sizes.sort((a, b) => a - b);
}

test('photo-inspired rooms retain five desk groups, two central lounges and right-wall refreshments without overlaps', () => {
  for (const [width, depth] of [[14, 28], [16, 28], [20, 36]]) {
    const room = { ...DEFAULT_ROOM, width, depth }, plan = activityLayout('hackathon', 150, room);
    const desks = plan.items.filter(i => i.type === 'table');
    assert.deepEqual(groupSizes(desks, 2.05), [5, 5, 5, 5, 5]);
    assert.equal(desks.filter(i => i.x < -2.5).length, 10 + 1);
    assert.equal(desks.filter(i => i.x > 2.5).length, 10 + 1);
    const couches = plan.items.filter(i => isCouch(i.type));
    assert.deepEqual(groupSizes(couches, 2.35), [4, 4]);
    assert.ok(couches.every(i => Math.abs(i.x) < 2));
    assert.ok(plan.items.filter(i => CATALOG[i.type].kind === 'refreshment').every(i => i.x > width / 2 - 1));
    for (let a = 0; a < plan.items.length; a++) {
      assert.deepEqual(constrain(plan.items[a], room), plan.items[a]);
      for (let b = a + 1; b < plan.items.length; b++) assert.equal(overlaps(plan.items[a], plan.items[b]), false);
    }
  }
});
