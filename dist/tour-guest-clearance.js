import { walkable } from './tour.js';

// Keep bodies and swinging arms away from the lens. The wider approach gives
// overtakers room to pass alongside it instead of filling the centre of frame.
export const CAMERA_CLEARANCE = 1.4;
const APPROACH = 3.2;
export function clearCameraView(people, shot, room, items) {
  const [cx, , cz] = shot.position;
  const dx = shot.target[0] - cx, dz = shot.target[2] - cz;
  const length = Math.hypot(dx, dz) || 1;
  const forward = { x: dx / length, z: dz / length };
  const right = { x: forward.z, z: -forward.x };
  return people.flatMap((person, index) => {
    const x = person.x - cx, z = person.z - cz;
    const ahead = x * forward.x + z * forward.z;
    const side = x * right.x + z * right.z;
    if (Math.abs(ahead) >= APPROACH || Math.abs(side) >= CAMERA_CLEARANCE) return [person];
    const approach = Math.max(0, 1 - Math.abs(ahead) / APPROACH);
    const blend = approach * approach * (3 - 2 * approach);
    // A stable preferred shoulder prevents a walker switching sides at the lens.
    const preferred = index % 2 ? -1 : 1;
    for (const sign of [preferred, -preferred]) {
      const eased = side + (sign * CAMERA_CLEARANCE - side) * blend;
      const required = Math.sqrt(Math.max(0, CAMERA_CLEARANCE ** 2 - ahead ** 2));
      const lateral = sign * Math.max(sign * eased, required + 0.001);
      const shift = lateral - side;
      const candidate = { ...person, x: person.x + right.x * shift, z: person.z + right.z * shift };
      // Never sidestep through furniture or a wall. If a narrow aisle cannot
      // accommodate a pass, keep this guest out of the shot until it clears.
      if ([0, 0.25, 0.5, 0.75, 1].every(t => walkable(person.x + right.x * shift * t, person.z + right.z * shift * t, room, items, 0.3))) return [candidate];
    }
    return [];
  });
}
