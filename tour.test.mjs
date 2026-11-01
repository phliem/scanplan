import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM, initialLayout } from './dist/layout.js';
import { createTour, walkingRoute, walkable, TOUR_DURATION } from './dist/tour.js';
test('eye-level route avoids furniture with room to turn', () => {
  const items = initialLayout(), route = walkingRoute(DEFAULT_ROOM, items);
  assert.ok(route.length > 10);
  for (const p of route) assert.equal(walkable(p[0], p[2], DEFAULT_ROOM, items, 0.42), true);
  const tour = createTour(DEFAULT_ROOM, items);
  for (let t = 16; t <= 30; t += 0.025) {
    const p = tour.sample(t).position;
    assert.equal(p[1], 1.65);
    assert.ok(walkable(p[0], p[2], DEFAULT_ROOM, items, 0.3), `camera intersects furniture at ${t}`);
  }
});
test('tour starts overhead, reveals roof, and ends inside at eye level', () => {
  const tour = createTour(DEFAULT_ROOM, initialLayout());
  assert.equal(tour.sample(0).roofOpacity, 0);
  assert.equal(tour.sample(0).structureVisible, false);
  assert.ok(tour.sample(0).position[1] > DEFAULT_ROOM.ridge);
  assert.equal(tour.sample(20).roofOpacity, 1);
  assert.equal(tour.sample(TOUR_DURATION).position[1], 1.65);
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
    assert.ok(tour.sample(0).position[1] > room.ridge);
    for (const point of tour.route) assert.ok(walkable(point[0], point[2], room, []));
    const shot = tour.sample(25);
    assert.ok(Math.abs(shot.position[0]) < room.width / 2 && Math.abs(shot.position[2]) < room.depth / 2);
  }
});
test('blocked entrance falls back to a doorway view', () => {
  const room = { width: 6, depth: 6, eaves: 3, ridge: 4 };
  const items = [-2, 0, 2].map(x => ({ type: 'couch', x, z: 2.2, rotation: 0 }));
  const tour = createTour(room, items);
  assert.equal(tour.inside, false);
  assert.equal(tour.route.length, 0);
  assert.ok(tour.sample(25).position[2] > room.depth / 2);
});
