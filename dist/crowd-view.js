import * as THREE from 'three';
import { MAX_PEOPLE } from './crowd.js';

// Shared geometry and instanced body parts keep a crowd to nine draw calls.
export function crowdView(scene) {
  const group = new THREE.Group(); group.name = 'event-people'; scene.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1), headGeometry = new THREE.SphereGeometry(1, 8, 6);
  const fabric = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const parts = Array.from({ length: 9 }, (_, i) => {
    const mesh = new THREE.InstancedMesh(i === 1 ? headGeometry : geometry, i === 1 ? skin : fabric, MAX_PEOPLE);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; group.add(mesh); return mesh;
  });
  const dummy = new THREE.Object3D(), root = new THREE.Object3D(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const shirts = ['#658d91', '#b96651', '#d1a84f', '#607c59', '#8c7098', '#ddd3ba'];
  const skins = ['#e4b78f', '#a5704e', '#774b35', '#f0c9ab'];
  return function paint(crowd) {
    for (const mesh of parts) mesh.count = crowd.people.length;
    crowd.people.forEach((p, i) => {
      const seated = p.state === 'seated', hip = seated ? p.seatHeight + 0.08 : 0.88;
      root.position.set(p.x, 0, p.z); root.rotation.y = p.rotation; root.updateMatrix();
      const swing = p.state === 'walking' && p.wait <= 0 ? Math.sin(p.phase) * 0.38 : 0;
      const specs = [
        [0, hip + 0.28, 0, 0.36, 0.55, 0.23, 0],
        [0, hip + 0.72, 0, 0.15, 0.18, 0.15, 0],
        [-0.24, hip + 0.25, 0, 0.11, 0.5, 0.12, seated ? -0.5 : -swing],
        [0.24, hip + 0.25, 0, 0.11, 0.5, 0.12, seated ? -0.5 : swing],
        [-0.11, hip - (seated ? 0.02 : 0.2), seated ? 0.2 : 0, 0.14, 0.42, 0.15, seated ? -Math.PI / 2 : swing],
        [0.11, hip - (seated ? 0.02 : 0.2), seated ? 0.2 : 0, 0.14, 0.42, 0.15, seated ? -Math.PI / 2 : -swing],
        [-0.11, seated ? hip - 0.26 : 0.25, seated ? 0.4 : -Math.sin(swing) * 0.2, 0.13, 0.42, 0.14, seated ? 0 : swing],
        [0.11, seated ? hip - 0.26 : 0.25, seated ? 0.4 : Math.sin(swing) * 0.2, 0.13, 0.42, 0.14, seated ? 0 : -swing],
        [0, hip - 0.02, 0, 0.34, 0.16, 0.24, 0],
      ];
      specs.forEach(([x, y, z, w, h, d, rx], part) => {
        dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(rx, 0, 0); dummy.updateMatrix();
        parts[part].setMatrixAt(i, matrix.multiplyMatrices(root.matrix, dummy.matrix));
        color.set(part === 1 ? skins[i % skins.length] : part >= 4 ? '#34434b' : shirts[i % shirts.length]);
        parts[part].setColorAt(i, color);
      });
    });
    for (const mesh of parts) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  };
}
