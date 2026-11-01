import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import { activityLayout, DEFAULT_ROOM, CATALOG, COUCH_TYPES, isCouch } from './dist/layout.js';
import { createCrowd } from './dist/crowd.js';
import { couchModel, refreshmentModel } from './dist/furniture-models.js';

test('100-person hackathon includes 25 desks, 100 chairs, eight different couches and three stations', () => {
  const plan = activityLayout('hackathon', 100);
  assert.equal(plan.seated, 100); assert.equal(plan.shortfall, 0);
  assert.equal(plan.items.filter(i => i.type === 'table').length, 25);
  assert.equal(plan.items.filter(i => i.type === 'chair').length, 100);
  assert.deepEqual(plan.items.filter(i => isCouch(i.type)).map(i => i.type), COUCH_TYPES);
  for (const type of ['coffee', 'tea', 'snacks']) assert.equal(plan.items.filter(i => i.type === type).length, 1);
  // The whole centre strip stays free, including the lounge and entrance.
  for (const item of plan.items) assert.ok(Math.abs(item.x) - CATALOG[item.type].width / 2 >= 0.64);
  const roundTrip = JSON.parse(JSON.stringify(plan));
  assert.deepEqual(roundTrip, plan);
});

test('all 100 desk seats and 24 extra lounge seats are usable by the crowd', () => {
  const plan = activityLayout('hackathon', 100);
  for (const count of [100, 124]) {
    const crowd = createCrowd({ count, behavior: 'seated', paused: false }, DEFAULT_ROOM, plan.items, CATALOG);
    assert.equal(crowd.seated, count); assert.equal(crowd.standing, 0);
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
