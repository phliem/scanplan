import * as THREE from './vendor/three.module.js';

// Local, editable 3D models, generated from geometry rather than remote assets.
export function couchModel(d) {
  const g = new THREE.Group(); g.name = d.name;
  const fabric = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.91 });
  const accent = fabric.clone(); accent.color.offsetHSL(0, -0.04, 0.08);
  const timber = new THREE.MeshStandardMaterial({ color: '#73513a', roughness: 0.65 });
  const metal = new THREE.MeshStandardMaterial({ color: '#b6a17e', metalness: 0.65, roughness: 0.38 });
  function soft(w, h, depth, x, y, z, material = fabric, radius = 0.055) {
    const r = Math.min(radius, w / 3, h / 3, depth / 3);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: 0, bevelSegments: 3, curveSegments: 5, steps: 1 });
    geo.translate(0, 0, -depth / 2 + r);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
  }
  function ball(x, y, z, radius, material = fabric) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
  }
  const cloud = d.style === 'cloud', modular = d.style === 'modular', bench = d.style === 'bench';
  const chester = d.style === 'chesterfield', tuxedo = d.style === 'tuxedo';
  soft(2.04, 0.21, 0.87, 0, 0.35, 0, bench ? timber : fabric);
  const count = modular ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * (1.7 / count);
    soft(1.7 / count - 0.025, cloud ? 0.22 : 0.15, 0.67, x, 0.495, 0.075, accent, cloud ? 0.09 : 0.045);
    if (!chester && !tuxedo && d.style !== 'channel') soft(1.7 / count - 0.025, cloud ? 0.4 : 0.38, 0.2, x, 0.73, -0.34, fabric, cloud ? 0.09 : 0.055);
  }
  if (chester || tuxedo || d.style === 'channel') soft(1.78, 0.48, 0.2, 0, 0.69, -0.34);
  for (const x of [-0.95, 0.95]) {
    if (chester) {
      const arm = ball(x, 0.73, 0, 0.1, accent); arm.scale.set(1, 1.1, 4.65);
      soft(0.19, 0.32, 0.87, x, 0.55, 0);
    } else soft(0.19, cloud ? 0.35 : (tuxedo ? 0.48 : 0.25), 0.95, x, tuxedo ? 0.69 : 0.61, 0, bench ? timber : fabric, cloud ? 0.09 : 0.04);
  }
  if (chester) for (const x of [-0.68, -0.34, 0, 0.34, 0.68]) for (const y of [0.59, 0.78]) ball(x, y, -0.227, 0.024, timber);
  if (d.style === 'channel') for (let x = -0.72; x <= 0.73; x += 0.18) soft(0.15, 0.4, 0.06, x, 0.7, -0.21, accent, 0.025);
  if (bench) for (const x of [-0.98, 0.98]) for (const z of [-0.31, 0.31]) soft(0.09, 0.6, 0.09, x, 0.3, z, timber, 0.01);
  else for (const x of [-0.86, 0.86]) for (const z of [-0.31, 0.31]) {
    const leg = soft(0.065, 0.24, 0.065, x, 0.13, z, tuxedo || d.style === 'channel' ? metal : timber, 0.01);
    if (d.style === 'scandi' || d.style === 'midcentury') leg.rotation.z = -Math.sign(x) * 0.15;
  }
  if (d.style === 'scandi' || d.style === 'midcentury' || cloud) {
    const pillow = soft(0.32, 0.29, 0.13, -0.64, 0.69, -0.13, accent, 0.045); pillow.rotation.z = 0.17;
  }
  return g;
}

export function refreshmentModel(type, d) {
  const g = new THREE.Group(); g.name = d.name;
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const top = material(d.color), frame = material('#343e3b'), ceramic = material('#f3eddf'), silver = material('#b5beb8');
  function block(w, h, depth, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  }
  function cylinder(radius, h, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 16), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  }
  block(1.6, 0.07, 0.65, 0, 0.79, 0, top);
  for (const x of [-0.68, 0.68]) for (const z of [-0.23, 0.23]) block(0.045, 0.76, 0.045, x, 0.38, z, frame);
  if (type === 'coffee') {
    block(0.4, 0.3, 0.29, -0.42, 0.975, 0, frame);
    cylinder(0.1, 0.18, -0.42, 0.94, 0.08, silver);
    block(0.26, 0.035, 0.13, -0.42, 1.04, 0.11, silver);
  } else if (type === 'tea') {
    cylinder(0.13, 0.19, -0.38, 0.93, 0, ceramic);
    cylinder(0.085, 0.035, -0.38, 1.04, 0, top);
    const spout = cylinder(0.033, 0.18, -0.22, 0.98, 0, ceramic); spout.rotation.z = -0.8;
    block(0.22, 0.08, 0.2, 0.24, 0.87, -0.12, top);
  } else {
    for (const x of [-0.43, 0, 0.43]) {
      cylinder(0.18, 0.025, x, 0.84, 0, ceramic);
      for (const dx of [-0.07, 0.07]) for (const dz of [-0.07, 0.07]) cylinder(0.045, 0.045, x + dx, 0.875, dz, top);
    }
  }
  if (type !== 'snacks') for (const x of [0.12, 0.3, 0.48, 0.66]) cylinder(0.043, 0.09, x, 0.87, 0.17, ceramic);
  return g;
}
