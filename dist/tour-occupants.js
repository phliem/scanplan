import { createCrowd, advanceCrowd, clearPoint } from './crowd.js';
import { CATALOG } from './layout.js';
import { TOUR_DURATION } from './tour.js';

export const TOUR_PEOPLE = 50;
const FPS = 60;
// Precompute independent film poses so everyone is inside from the first frame,
// and pause/replay/seeking never depend on the live editor crowd's simulation.
export function createTourOccupants(room, items) {
  const crowd = createCrowd({ count: TOUR_PEOPLE, behavior: 'walking', paused: false }, room, items, CATALOG);
  // Tight, rotated furniture can occupy a small sliver between grid samples.
  const seen = new Set(), cells = crowd.people.map(person => person.cell).filter(Boolean);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (seen.has(cell)) continue;
    seen.add(cell);
    cell.neighbors = cell.neighbors.filter(next => Array.from({ length: 49 }, (_, n) => (n + 1) / 50)
      .every(t => clearPoint(cell.x + (next.x - cell.x) * t, cell.z + (next.z - cell.z) * t, room, items, CATALOG)));
    cells.push(...cell.neighbors.filter(next => !seen.has(next)));
  }
  for (const person of crowd.people) if (!person.cell.neighbors.length) person.state = 'standing';
  const pose = () => crowd.people.map(({ x, z, rotation, state, phase, wait }) => ({ x, z, rotation, state, phase, wait }));
  const frames = [pose()];
  for (let frame = 1; frame <= TOUR_DURATION * FPS; frame++) {
    advanceCrowd(crowd, 1 / FPS);
    frames.push(pose());
  }
  return {
    count: crowd.people.length,
    sample(seconds) {
      const index = Math.floor(Math.max(0, Math.min(TOUR_DURATION, seconds)) * FPS);
      return { people: frames[index].map(person => ({ ...person })) };
    },
  };
}
