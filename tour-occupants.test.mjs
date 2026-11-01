import test from 'node:test';
import assert from 'node:assert/strict';
import { createTourOccupants, TOUR_PEOPLE } from './dist/tour-occupants.js';
import { DEFAULT_ROOM, activityLayout, CATALOG } from './dist/layout.js';
import { clearPoint } from './dist/crowd.js';
import { createTour, TOUR_DURATION } from './dist/tour.js';
import { clearCameraView, CAMERA_CLEARANCE } from './dist/tour-guest-clearance.js';

test('50 people are already inside throughout the film, including before entry', () => {
  const room = { width: 16, depth: 28, eaves: 6, ridge: 9 };
  for (const style of ['photo', 'pockets', 'commons', 'ramble']) {
    const items = activityLayout('hackathon', 150, room, style).items;
    const occupants = createTourOccupants(room, items), tour = createTour(room, items);
    assert.equal(occupants.count, TOUR_PEOPLE);
    for (let t = 0; t <= TOUR_DURATION; t += 0.1) {
      const people = occupants.sample(t).people, shot = tour.sample(t);
      assert.equal(people.length, 50);
      for (const person of people) assert.ok(clearPoint(person.x, person.z, room, items, CATALOG, null, 0.23 - 1e-9), `guest outside or crossing furniture at ${t}`);
      for (const person of clearCameraView(people, shot, room, items)) assert.ok(Math.hypot(person.x - shot.position[0], person.z - shot.position[2]) >= CAMERA_CLEARANCE - 1e-9);
    }
    assert.notDeepEqual(occupants.sample(0), occupants.sample(12));
    const pose = occupants.sample(13.123);
    occupants.sample(27); occupants.sample(0);
    assert.deepEqual(occupants.sample(13.123), pose);
    assert.deepEqual(occupants.sample(-1), occupants.sample(0));
    assert.deepEqual(occupants.sample(99), occupants.sample(TOUR_DURATION));
  }
});

test('crowd stays inside even when the entrance is blocked, and packed rooms report actual placements', () => {
  const room = { width: 6, depth: 6, eaves: 3, ridge: 4 };
  const items = [{ type: 'couch', x: 0, z: -2.2, rotation: 0 }];
  assert.equal(createTour(room, items).inside, false);
  assert.equal(createTourOccupants(room, items).sample(0).people.length, 50);
  CATALOG.test_full_room = { width: DEFAULT_ROOM.width, depth: DEFAULT_ROOM.depth, height: 2 };
  try {
    const occupants = createTourOccupants(DEFAULT_ROOM, [{ type: 'test_full_room', x: 0, z: 0, rotation: 0 }]);
    assert.equal(occupants.count, 0);
    assert.deepEqual(occupants.sample(0).people, []);
  } finally { delete CATALOG.test_full_room; }
});
