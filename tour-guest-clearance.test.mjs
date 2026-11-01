import test from 'node:test';
import assert from 'node:assert/strict';
import { clearCameraView, CAMERA_CLEARANCE } from './dist/tour-guest-clearance.js';
import { DEFAULT_ROOM, initialLayout, activityLayout } from './dist/layout.js';
import { createTour, walkable, TOUR_DURATION } from './dist/tour.js';
import { createGuestArrival, GUEST_START } from './dist/tour-guests.js';

const shot = { position: [0, 1.65, 0], target: [0, 1.65, 10] };
test('overtaking guests pass beside the camera with room for their bodies', () => {
  for (let z = -3.5; z <= 3.5; z += 0.025) {
    const people = clearCameraView([{ x: 0, z, state: 'walking' }], shot, DEFAULT_ROOM, []);
    assert.equal(people.length, 1);
    assert.ok(Math.hypot(people[0].x, people[0].z) >= CAMERA_CLEARANCE);
    if (Math.abs(z) < 0.5) assert.ok(people[0].x > 1.3);
  }
  const sideGuest = { x: 2, z: 0, state: 'walking' };
  assert.deepEqual(clearCameraView([sideGuest], shot, DEFAULT_ROOM, []), [sideGuest]);
});

test('clearance follows camera direction and uses the free shoulder', () => {
  const turned = { position: [0, 1.65, 0], target: [10, 1.65, 0] };
  assert.ok(clearCameraView([{ x: 0, z: 0 }], turned, DEFAULT_ROOM, [])[0].z < -1.3);
  const furniture = [{ type: 'table', x: 1.6, z: 0, rotation: 0 }];
  const result = clearCameraView([{ x: 0, z: 0 }], shot, DEFAULT_ROOM, furniture);
  assert.equal(result.length, 1);
  assert.ok(result[0].x < -1.3);
  // A blocked pass cannot push a guest through a table or through the lens.
  assert.deepEqual(clearCameraView([{ x: 0, z: 0 }], shot, DEFAULT_ROOM,
    [...furniture, { type: 'table', x: -1.6, z: 0, rotation: 0 }]), []);
});

test('entire films keep the lens clear across layouts and seeking', () => {
  const room = { width: 16, depth: 28, eaves: 6, ridge: 9 };
  for (const items of [[], initialLayout(), ...['photo', 'pockets', 'commons', 'ramble'].map(style => activityLayout('hackathon', 150, room, style).items), activityLayout('theatre', 100, room).items]) {
    const tour = createTour(room, items), guests = createGuestArrival(room, items, tour, 150);
    const sample = time => clearCameraView(guests.sample(time).people, tour.sample(time), room, items);
    for (let t = GUEST_START; t <= TOUR_DURATION; t += 1 / 30) {
      const camera = tour.sample(t).position;
      for (const person of sample(t)) {
        assert.ok(Math.hypot(person.x - camera[0], person.z - camera[2]) >= CAMERA_CLEARANCE - 1e-9, `lens blocked at ${t}`);
        if (person.z >= -room.depth / 2 + 0.31) assert.ok(walkable(person.x, person.z, room, items, 0.29));
      }
    }
    const expected = sample(13);
    sample(27); sample(9);
    assert.deepEqual(sample(13), expected);
  }
});
