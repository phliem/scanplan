import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM, initialLayout, activityLayout, CATALOG } from './dist/layout.js';
import { createTour, walkable, TOUR_DURATION } from './dist/tour.js';
import { createGuestArrival, GUEST_START } from './dist/tour-guests.js';

test('guests follow the camera through the actual doors and seeking reproduces their poses', () => {
  const tour = createTour(DEFAULT_ROOM, []), arrivals = createGuestArrival(DEFAULT_ROOM, [], tour);
  assert.equal(arrivals.sample(GUEST_START - 0.01).people.length, 0);
  const first = arrivals.sample(GUEST_START).people;
  assert.equal(first.length, 1);
  assert.ok(first[0].z < -DEFAULT_ROOM.depth / 2);
  assert.ok(tour.sample(GUEST_START).position[2] > -DEFAULT_ROOM.depth / 2);
  const pose = arrivals.sample(18);
  arrivals.sample(27); arrivals.sample(0);
  assert.deepEqual(arrivals.sample(18), pose);
  const final = arrivals.sample(TOUR_DURATION).people;
  assert.equal(final.length, 60);
  assert.ok(final.filter(p => p.z > -DEFAULT_ROOM.depth / 2 + 2).length > 40);
  assert.ok(final.some(p => p.state === 'standing'));
});

test('arrival paths clear furniture, including activity layouts and rotated imported models', () => {
  CATALOG.model_guest_test = { width: 2.3, depth: 0.15, height: 2 };
  try {
    const room = { width: 16, depth: 28, eaves: 6, ridge: 9 };
    for (const items of [initialLayout(), activityLayout('hackathon', 100, room).items, activityLayout('theatre', 100, room).items,
      [{ type: 'model_guest_test', x: 0, z: -5, rotation: Math.PI / 4 }]]) {
      const tour = createTour(room, items), arrivals = createGuestArrival(room, items, tour, 100);
      assert.ok(tour.inside);
      for (let t = GUEST_START; t < 40; t += 0.13) for (const p of arrivals.sample(t).people) {
        if (p.z >= -room.depth / 2 + 0.31) assert.ok(walkable(p.x, p.z, room, items, 0.29), `guest crosses furniture at ${t}`);
      }
    }
  } finally { delete CATALOG.model_guest_test; }
});

test('blocked doorway prevents arrival and empty counts stay empty', () => {
  const room = { width: 6, depth: 6, eaves: 3, ridge: 4 };
  const items = [{ type: 'couch', x: 0, z: -2.2, rotation: 0 }];
  const tour = createTour(room, items);
  assert.equal(tour.inside, false);
  assert.deepEqual(createGuestArrival(room, items, tour).sample(28).people, []);
  assert.equal(createGuestArrival(room, [], createTour(room, []), 0).count, 0);
});
