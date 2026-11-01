import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CROWD, validCrowd, createCrowd, advanceCrowd, clearPoint } from './dist/crowd.js';
import { DEFAULT_ROOM, CATALOG, initialLayout, activityLayout } from './dist/layout.js';
const config = (count, behavior = 'mixed') => ({ count, behavior, paused: false });

test('crowd settings reject invalid persisted counts and behaviors', () => {
  assert.ok(validCrowd(DEFAULT_CROWD));
  for (const count of [-1, 501, 1.5, NaN, Infinity, '100']) assert.equal(validCrowd(config(count)), false);
  assert.equal(validCrowd({ count: 10, behavior: 'mixed' }), false);
  assert.equal(validCrowd(config(10, 'other')), false);
  assert.equal(validCrowd(null), false);
});

test('100 mixed attendees use all 30 available seats, with everyone else walking', () => {
  const crowd = createCrowd(config(100), DEFAULT_ROOM, initialLayout(), CATALOG);
  assert.equal(crowd.people.length, 100);
  assert.equal(crowd.seated, 30);
  assert.equal(crowd.walking, 70);
  assert.equal(crowd.standing, 0);
  const seats = crowd.people.filter(p => p.state === 'seated');
  assert.equal(new Set(seats.map(p => `${p.x},${p.z}`)).size, 30);
});

test('seated mode never invents seats and reports standing overflow', () => {
  const crowd = createCrowd(config(100, 'seated'), DEFAULT_ROOM, initialLayout(), CATALOG);
  assert.equal(crowd.seated, 30); assert.equal(crowd.standing, 70); assert.equal(crowd.walking, 0);
  const positions = () => crowd.people.map(({ x, z, rotation }) => ({ x, z, rotation }));
  const before = positions(); advanceCrowd(crowd, 0.05);
  assert.deepEqual(positions(), before);
});

test('walking attendees stay in the room and clear rotated furniture and imported footprints', () => {
  const items = [...initialLayout(), { type: 'custom', x: 0, z: -8, rotation: 0.72 }];
  const catalog = { ...CATALOG, custom: { width: 3.5, depth: 1.2, height: 1.5 } };
  const crowd = createCrowd(config(100, 'walking'), DEFAULT_ROOM, items, catalog);
  assert.equal(crowd.people.length, 100); assert.equal(crowd.seated, 0);
  const before = crowd.people.map(p => [p.x, p.z]);
  for (let frame = 0; frame < 1200; frame++) {
    advanceCrowd(crowd, frame === 200 ? 60 : 0.05);
    for (const p of crowd.people) assert.ok(clearPoint(p.x, p.z, DEFAULT_ROOM, items, catalog), `Blocked at ${p.x},${p.z}`);
  }
  assert.ok(crowd.people.some((p, i) => Math.hypot(p.x - before[i][0], p.z - before[i][1]) > 0.5));
});

test('empty, crowded and blocked rooms return honest placement counts', () => {
  assert.equal(createCrowd(config(0), DEFAULT_ROOM, [], CATALOG).people.length, 0);
  assert.equal(createCrowd(config(500, 'walking'), DEFAULT_ROOM, [], CATALOG).people.length, 500);
  const room = { ...DEFAULT_ROOM, width: 6, depth: 6 };
  const crowd = createCrowd(config(500), room, [], CATALOG);
  assert.ok(crowd.people.length < crowd.requested);
  const blocked = createCrowd(config(100), room, [{ type: 'block', x: 0, z: 0, rotation: 0 }], { block: { width: 6, depth: 6 } });
  assert.equal(blocked.people.length, 0);
});

test('seats blocked by solid furniture are left empty', () => {
  const items = [{ type: 'chair', x: 0, z: 0, rotation: Math.PI / 4 }, { type: 'solid', x: 0, z: 0, rotation: Math.PI / 4 }];
  assert.equal(createCrowd(config(1, 'seated'), DEFAULT_ROOM, items, { ...CATALOG, solid: { width: 2, depth: 2 } }).seated, 0);
});


test('event templates provide usable seats for the animated crowd', () => {
  for (const activity of ['hackathon', 'theatre']) {
    const layout = activityLayout(activity, 100);
    const crowd = createCrowd(config(100, 'seated'), DEFAULT_ROOM, layout.items, CATALOG);
    assert.equal(crowd.seated, 100, activity);
    assert.equal(crowd.standing, 0, activity);
  }
});
