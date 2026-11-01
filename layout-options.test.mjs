import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLayout, CATALOG, DEFAULT_ROOM, validLayout, constrain, overlaps } from './dist/layout.js';
import { createCrowd } from './dist/crowd.js';
import { createTour } from './dist/tour.js';
const styles = ['pockets', 'commons', 'ramble'];

test('relaxed variants keep 150 usable desk seats, eight couches, clear furniture and an entry route', () => {
  for (const [width, depth] of [[14, 28], [16, 28], [20, 36], [60, 60]]) for (const style of styles) {
    const room = { ...DEFAULT_ROOM, width, depth }, plan = activityLayout('hackathon', 150, room, style);
    assert.equal(plan.seated, 150); assert.equal(plan.capacity, 150);
    assert.equal(plan.items.filter(i => i.type === 'table').length, 25);
    assert.equal(plan.items.filter(i => i.type === 'chair').length, 150);
    assert.equal(plan.items.filter(i => CATALOG[i.type].kind === 'couch').length, 8);
    assert.equal(plan.items.filter(i => CATALOG[i.type].kind === 'refreshment').length, 3);
    assert.ok(validLayout(plan.items));
    for (let a = 0; a < plan.items.length; a++) {
      assert.deepEqual(constrain(plan.items[a], room), plan.items[a], `${style}: outside room`);
      for (let b = a + 1; b < plan.items.length; b++) assert.equal(overlaps(plan.items[a], plan.items[b]), false, `${width} × ${depth}: ${style} overlap ${a}, ${b}`);
    }
    assert.equal(createCrowd({ count: 174, behavior: 'seated', paused: false }, room, plan.items, CATALOG).seated, 174);
    assert.ok(createTour(room, plan.items).inside);
    assert.deepEqual(activityLayout('hackathon', 150, room, style), plan);
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  }
});

test('relaxed layouts validate styles and room sizes and retain honest shortfalls', () => {
  for (const style of styles) {
    assert.throws(() => activityLayout('hackathon', 150, DEFAULT_ROOM, style), /14 × 28/);
    for (const requested of [1, 6, 40, 100, 150, 1000]) {
      const plan = activityLayout('hackathon', requested, { ...DEFAULT_ROOM, width: 16, depth: 28 }, style);
      assert.equal(plan.items.filter(i => i.type === 'chair').length, plan.seated);
      assert.equal(plan.seated + plan.shortfall, requested);
      assert.ok(validLayout(plan.items));
    }
  }
  assert.throws(() => activityLayout('hackathon', 150, DEFAULT_ROOM, '__proto__'), /layout style/);
});

test('Creative pockets has six pairs and thirteen single worktables at full attendance', () => {
  const room = { ...DEFAULT_ROOM, width: 16, depth: 28 };
  const desks = activityLayout('hackathon', 150, room, 'pockets').items.filter(i => i.type === 'table');
  const connected = desks.map(a => desks.filter(b => a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 2.05).length);
  assert.equal(connected.filter(n => n === 1).length, 12);
  assert.equal(connected.filter(n => n === 0).length, 13);
  assert.ok(connected.every(n => n <= 1));
});
