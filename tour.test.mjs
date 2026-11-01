import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM, initialLayout, CATALOG } from './dist/layout.js';
import { createTour, walkingRoute, walkable, TOUR_DURATION, WALK_START, WALK_END, ENTRY_START } from './dist/tour.js';
test('eye-level route avoids furniture with room to turn', () => {
  const items = initialLayout(), route = walkingRoute(DEFAULT_ROOM, items);
  assert.ok(route.length > 10);
  for (const p of route) assert.equal(walkable(p[0], p[2], DEFAULT_ROOM, items, 0.42), true);
  const tour = createTour(DEFAULT_ROOM, items);
  for (let t = WALK_START + 1; t <= WALK_END; t += 0.025) {
    const p = tour.sample(t).position;
    assert.ok(Math.abs(p[1] - 1.65) < 1e-8);
    assert.ok(walkable(p[0], p[2], DEFAULT_ROOM, items, 0.3), `camera intersects furniture at ${t}`);
  }
});
test('tour flies from outside through the open doors and ends inside at eye level', () => {
  const tour = createTour(DEFAULT_ROOM, initialLayout());
  assert.equal(tour.sample(0).roofOpacity, 1);
  assert.equal(tour.sample(0).doorOpen, 0);
  assert.equal(tour.sample(7).doorOpen, 1);
  assert.equal(tour.sample(0).structureVisible, true);
  assert.ok(tour.sample(0).position[2] < -DEFAULT_ROOM.depth / 2);
  assert.equal(tour.sample(20).roofOpacity, 1);
  assert.ok(Math.abs(tour.sample(TOUR_DURATION).position[1] - 1.65) < 1e-8);
  for (let t = 0; t <= TOUR_DURATION; t += 0.05) {
    const shot = tour.sample(t);
    assert.ok([...shot.position, ...shot.target, shot.fov].every(Number.isFinite));
    const next = tour.sample(t + 0.01);
    assert.ok(Math.hypot(...shot.position.map((v, i) => v - next.position[i])) < 0.5, `position jumps at ${t}`);
  }
});
test('tour adapts to small and large room dimensions', () => {
  for (const room of [{ width: 6, depth: 6, eaves: 3, ridge: 3.5 }, { width: 60, depth: 60, eaves: 15, ridge: 20 }]) {
    const tour = createTour(room, [], 0.6);
    assert.ok(tour.inside);
    assert.ok(tour.sample(0).position[2] < -room.depth / 2);
    for (const point of tour.route) assert.ok(walkable(point[0], point[2], room, []));
    const shot = tour.sample(25);
    assert.ok(Math.abs(shot.position[0]) < room.width / 2 && Math.abs(shot.position[2]) < room.depth / 2);
  }
});
test('blocked entrance falls back to a doorway view', () => {
  const room = { width: 6, depth: 6, eaves: 3, ridge: 4 };
  const items = [-2, 0, 2].map(x => ({ type: 'couch', x, z: -2.2, rotation: 0 }));
  const tour = createTour(room, items);
  assert.equal(tour.inside, false);
  assert.equal(tour.route.length, 0);
  assert.ok(tour.sample(25).position[2] < -room.depth / 2);
});
test('faster fly-in reaches eye level by ten seconds', () => {
  const tour = createTour(DEFAULT_ROOM, initialLayout());
  assert.equal(TOUR_DURATION, 28);
  assert.ok(Math.abs(tour.sample(10).position[1] - 1.65) < 1e-8);
});
test('chapter handoffs blend movement and camera direction without a snap', () => {
  const tour = createTour(DEFAULT_ROOM, initialLayout()), dt = 0.005;
  const velocity = t => { const a = tour.sample(t - dt), b = tour.sample(t + dt); return a.position.map((v, i) => (b.position[i] - v) / (2 * dt)); };
  const direction = shot => { const v = shot.target.map((x, i) => x - shot.position[i]); const length = Math.hypot(...v); return v.map(x => x / length); };
  for (const t of [2, 4, ENTRY_START, WALK_START, WALK_END]) {
    const before = velocity(t - dt), after = velocity(t + dt);
    assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < 0.4, `velocity jumps at ${t}`);
    const a = direction(tour.sample(t - dt)), b = direction(tour.sample(t + dt));
    assert.ok(Math.hypot(...a.map((v, i) => v - b[i])) < 0.025, `view direction jumps at ${t}`);
  }
});
test('tour routes around the measured footprint of an imported model', () => {
  const type = 'model_tour_test';
  CATALOG[type] = { name: 'Imported partition', width: 4, depth: 1, height: 2 };
  try {
    const items = [{ type, x: 0, z: 0, rotation: Math.PI / 6 }], tour = createTour(DEFAULT_ROOM, items);
    assert.ok(tour.inside);
    for (let t = WALK_START + 1; t <= WALK_END; t += 0.05) {
      const p = tour.sample(t).position;
      assert.ok(walkable(p[0], p[2], DEFAULT_ROOM, items, 0.3));
    }
  } finally { delete CATALOG[type]; }
});
