import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ROOM, CATALOG, constrain, overlaps, validLayout, initialLayout, ACTIVITIES, activityLayout } from './layout.js';
const $ = id => document.getElementById(id);
const viewport = $('viewport');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
catch { $('loading').textContent = '3D needs WebGL. Please open this page in a browser with hardware acceleration enabled.'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor('#e9ece3');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
viewport.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 160);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.09;
controls.maxDistance = 55; controls.minDistance = 1; controls.maxPolarAngle = Math.PI / 2 - 0.015;
controls.target.set(0, 1, 0);
scene.add(new THREE.HemisphereLight('#fff8e8', '#8c9885', 2.5));
const sun = new THREE.DirectionalLight('#fff2d6', 4);
sun.position.set(-6, 17, 6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight('#dbe9ff', 1.2); fill.position.set(10, 8, -8); scene.add(fill);
function mat(color, roughness = 0.8) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function box(parent, w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function beam(parent, a, b, width, material) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mesh = box(parent, width, start.distanceTo(end), width, 0, 0, 0, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh;
}
// Deterministic procedural materials: no external textures or image uploads.
let seed = 91;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function texture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
  if (kind === 'brick') {
    ctx.fillStyle = '#938477'; ctx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 16; r++) for (let col = -1; col < 9; col++) {
      const n = rand(); ctx.fillStyle = `rgb(${140 + n * 48},${78 + n * 35},${55 + n * 27})`;
      ctx.fillRect(col * 68 + (r % 2) * 34 + 2, r * 32 + 2, 64, 28);
    }
  } else {
    ctx.fillStyle = kind === 'wood' ? '#b99160' : '#bdbdb0'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18000; i++) { ctx.fillStyle = rand() > 0.5 ? '#ffffff12' : '#0000000c'; const x = rand() * 512, y = rand() * 512; ctx.fillRect(x, y, kind === 'wood' ? 25 : 2, 1); }
    ctx.strokeStyle = kind === 'wood' ? '#6d50252a' : '#777c7025'; ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += kind === 'wood' ? 128 : 256) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    if (kind !== 'wood') { ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke(); }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); return tex;
}
const brickTex = texture('brick'); brickTex.repeat.set(3, 1);
const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.93 });
const concreteTex = texture('concrete'); concreteTex.repeat.set(4, 7);
const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.96 });
const woodTex = texture('wood');
const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.63 });
const steel = mat('#343e3b', 0.5), truss = mat('#a0aaa1', 0.5), plaster = mat('#c1bbaa');
const base = new THREE.Group(); scene.add(base);
box(base, 12.5, 0.3, 22.5, 0, -0.2, 0, mat('#a3aa9a'));
box(base, 12, 0.12, 22, 0, -0.02, 0, concrete);
const grid = new THREE.GridHelper(22, 44, '#7e8c73', '#9da98e'); grid.position.y = 0.045; grid.material.transparent = true; grid.material.opacity = 0.12; scene.add(grid);
const leftWall = new THREE.Group(), rightWall = new THREE.Group(), backWall = new THREE.Group();
scene.add(leftWall, rightWall, backWall);
function sideWall(group, x) {
  box(group, 0.24, 1.1, 22, x, 0.55, 0, plaster);
  box(group, 0.24, 1.7, 22, x, 4.35, 0, brick);
  for (let z = -10; z < 11; z += 3.6) {
    box(group, 0.25, 2.4, 0.9, x, 2.3, z, plaster);
    const wx = x + (x < 0 ? 0.14 : -0.14);
    box(group, 0.06, 2.2, 2.55, wx, 2.28, z + 1.75, mat('#c4d8d0', 0.25));
    for (const zz of [z + 0.48, z + 1.75, z + 3.02]) box(group, 0.1, 2.25, 0.055, wx + (x < 0 ? 0.04 : -0.04), 2.28, zz, steel);
    box(group, 0.12, 0.07, 2.6, wx, 2.25, z + 1.75, steel);
  }
}
sideWall(leftWall, -6); sideWall(rightWall, 6);
// Rear opening and brick piers, inspired by the venue photograph.
box(backWall, 4.4, 5.2, 0.25, -3.8, 2.6, -11, brick);
box(backWall, 4.4, 5.2, 0.25, 3.8, 2.6, -11, brick);
box(backWall, 3.2, 1.7, 0.25, 0, 4.35, -11, brick);
box(backWall, 3.1, 3.5, 0.1, 0, 1.75, -11.1, mat('#35443d'));
box(backWall, 3.5, 0.6, 0.35, 0, 3.55, -10.8, steel);
box(backWall, 0.035, 3.1, 0.1, 0, 1.55, -11, truss);
const structure = new THREE.Group(); scene.add(structure);
for (const z of [-10.8, -6.5, -2.2, 2.2, 6.5, 10.8]) {
  for (const x of [-5.88, 5.88]) {
    box(structure, 0.18, 5.2, 0.22, x, 2.6, z, steel);
    box(structure, 0.42, 0.1, 0.42, x, 0.1, z, steel);
  }
  beam(structure, [-6, 5.2, z], [6, 5.2, z], 0.12, truss);
  beam(structure, [-6, 5.2, z], [0, 7.2, z], 0.11, truss);
  beam(structure, [0, 7.2, z], [6, 5.2, z], 0.11, truss);
  for (let x = -4; x <= 4; x += 2) { const y = 7.2 - Math.abs(x) / 3; beam(structure, [x, 5.2, z], [x, y, z], 0.065, truss); if (x < 4) beam(structure, [x, 5.2, z], [x + 2, 7.2 - Math.abs(x + 2) / 3, z], 0.065, truss); }
  box(structure, 4, 0.055, 0.16, 0, 5.05, z, mat('#f6f4d7'));
}
for (const x of [-5.85, 5.85]) box(structure, 0.16, 0.25, 22, x, 5.2, 0, steel);
const roof = new THREE.Group(); scene.add(roof); roof.visible = false;
for (const side of [-1, 1]) for (const z of [-8.25, -2.75, 2.75, 8.25]) {
  const sheet = box(roof, 6.32, 0.08, 5.45, side * 3, 6.2, z, z === -2.75 || z === 8.25 ? new THREE.MeshBasicMaterial({ color: '#eaf2ed', side: THREE.DoubleSide }) : mat('#929990'));
  sheet.rotation.z = -side * Math.atan(1 / 3);
}
const furniture = new THREE.Group(); scene.add(furniture);
let eventPlan = null;
let items = [], selected = null, nextId = 1, undoStack = [], redoStack = [], view = 'orbit';

function status(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(status.timer); status.timer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
function save() { try { localStorage.setItem('warehouse-layout-v2', JSON.stringify({ furniture: items.map(({ type, x, z, rotation }) => ({ type, x, z, rotation })), eventPlan })); $('save-state').textContent = 'Saved on this device'; } catch { $('save-state').textContent = 'Saving unavailable — export to keep layout'; } }
function snapshot() { return structuredClone({ items, eventPlan }); }
function checkpoint() { undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack = []; }
function meshFor(item) {
  const g = new THREE.Group(); g.userData.id = item.id;
  const d = CATALOG[item.type], fabric = mat(d.color), legs = steel;
  if (item.type === 'stage') {
    box(g, d.width, d.height, d.depth, 0, d.height / 2, 0, fabric);
    box(g, d.width, 0.04, d.depth, 0, d.height, 0, wood);
  } else if (item.type === 'table') {
    box(g, d.width, 0.08, d.depth, 0, 0.75, 0, wood);
    for (const x of [-0.84, 0.84]) for (const z of [-0.31, 0.31]) box(g, 0.055, 0.7, 0.055, x, 0.37, z, legs);
    box(g, 1.7, 0.04, 0.04, 0, 0.2, 0, legs);
  } else if (item.type === 'couch') {
    box(g, 2.3, 0.35, 0.87, 0, 0.35, 0, fabric);
    box(g, 2.3, 0.64, 0.19, 0, 0.63, -0.38, fabric);
    for (const x of [-1.03, 1.03]) box(g, 0.24, 0.43, 0.95, x, 0.58, 0, fabric);
    for (const x of [-0.64, 0, 0.64]) box(g, 0.61, 0.16, 0.66, x, 0.57, 0.08, mat('#ad5b51'));
    for (const x of [-0.93, 0.93]) for (const z of [-0.3, 0.3]) box(g, 0.07, 0.17, 0.07, x, 0.1, z, legs);
  } else {
    box(g, 0.5, 0.08, 0.5, 0, 0.46, 0, fabric);
    box(g, 0.5, 0.38, 0.06, 0, 0.69, -0.24, fabric);
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) box(g, 0.035, 0.44, 0.035, x, 0.23, z, legs);
  }
  g.position.set(item.x, 0, item.z); g.rotation.y = item.rotation; return g;
}
const selectionOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#b0db70', depthTest: false }));
selectionOutline.renderOrder = 10; selectionOutline.visible = false; scene.add(selectionOutline);
function updateInspector() {
  const item = items.find(i => i.id === selected);
  $('empty').hidden = !!item; $('selection').hidden = !item; selectionOutline.visible = !!item;
  if (item) {
    const d = CATALOG[item.type]; $('object-name').textContent = d.name;
    $('pos-x').value = item.x.toFixed(2); $('pos-z').value = item.z.toFixed(2);
    selectionOutline.position.set(item.x, d.height / 2 + 0.03, item.z); selectionOutline.rotation.y = item.rotation;
    selectionOutline.scale.set(d.width + 0.12, d.height + 0.08, d.depth + 0.12);
    const collision = items.some(other => other.id !== item.id && overlaps(item, other));
    selectionOutline.material.color.set(collision ? '#d88a40' : '#709942');
    $('collision').textContent = collision ? 'Overlaps another object. Move it to make space.' : `${(item.rotation * 180 / Math.PI % 360 + 360) % 360}° rotation · dimensions in metres`;
  }
  $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length;
  $('layout-name').textContent = eventPlan ? `${ACTIVITIES[eventPlan.activity].name} · ${eventPlan.seated} seats for ${eventPlan.requested} people` : 'Your custom layout';
  $('object-count').textContent = `${items.length} objects`;
  $('furniture-count').textContent = `${items.filter(i => i.type === 'table').length} tables · ${items.filter(i => i.type === 'couch').length} couches · ${items.filter(i => i.type === 'chair').length} chairs · ${items.filter(i => i.type === 'stage').length} stages`;
}
function renderItems() {
  // Geometry/materials belong to individual furniture; shared wood and steel stay alive.
  for (const child of [...furniture.children]) { child.traverse(m => { if (m.isMesh) { m.geometry.dispose(); if (![wood, steel].includes(m.material)) m.material.dispose(); } }); furniture.remove(child); }
  for (const item of items) furniture.add(meshFor(item)); updateInspector(); save();
}
function setItems(data, plan = null) { eventPlan = plan; items = data.map(i => ({ ...constrain(i), id: nextId++ })); selected = null; renderItems(); }
function findSpot(type, preferred, rotation = 0) {
  const candidates = preferred ? [preferred] : [];
  for (let z = 0; z <= 9; z += 1.5) for (let x = -4.5; x <= 4.5; x += 1.5) for (const sign of z ? [1, -1] : [1]) candidates.push({ x, z: z * sign });
  return candidates.map(p => constrain({ type, ...p, rotation })).find(p => items.every(i => !overlaps(p, i)));
}
function add(type) { if (items.length >= 200) return status('This prototype supports up to 200 objects.'); const item = findSpot(type); if (!item) return status('No free space found. Move or remove furniture first.'); checkpoint(); eventPlan = null; item.id = nextId++; items.push(item); selected = item.id; renderItems(); status(`${CATALOG[type].name} added`); }
function changeSelected(fn) { const i = items.findIndex(i => i.id === selected); if (i < 0) return; checkpoint(); eventPlan = null; items[i] = constrain(fn({ ...items[i] })); renderItems(); }
function remove() { if (selected === null) return; checkpoint(); eventPlan = null; items = items.filter(i => i.id !== selected); selected = null; renderItems(); }
function history(from, to) { if (!from.length) return; to.push(snapshot()); const previous = from.pop(); items = previous.items; eventPlan = previous.eventPlan; selected = null; renderItems(); }
for (const btn of document.querySelectorAll('[data-add]')) btn.onclick = () => add(btn.dataset.add);
$('rotate').onclick = () => changeSelected(i => ({ ...i, rotation: (i.rotation + Math.PI / 4) % (Math.PI * 2) }));
$('delete').onclick = remove;
$('duplicate').onclick = () => { const i = items.find(i => i.id === selected); if (!i) return; if (items.length >= 200) return status('This prototype supports up to 200 objects.'); const spot = findSpot(i.type, { x: i.x + 1, z: i.z + 1 }, i.rotation); if (!spot) return status('No free space for a duplicate'); checkpoint(); eventPlan = null; const copy = constrain({ ...spot, rotation: i.rotation, id: nextId++ }); items.push(copy); selected = copy.id; renderItems(); };
for (const axis of ['x', 'z']) $('pos-' + axis).onchange = e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) changeSelected(i => ({ ...i, [axis]: value })); else updateInspector(); };
$('undo').onclick = () => history(undoStack, redoStack); $('redo').onclick = () => history(redoStack, undoStack);
$('reset').onclick = () => { checkpoint(); setItems(initialLayout()); status('Original layout restored. Undo to recover your changes.'); };
$('roof').onchange = e => roof.visible = e.target.checked;
$('export').onclick = () => { const blob = new Blob([JSON.stringify({ version: 2, eventPlan, units: 'metres', approximate: true, room: ROOM, furniture: items.map(({ type, x, z, rotation }) => ({ type, x, z, rotation })) }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'warehouse-layout.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Layout exported'); };
function setView(name) {
  view = name;
  for (const key of ['orbit', 'top', 'inside']) $('view-' + key).classList.toggle('active', name === key);
  document.querySelector('.canvas-label').style.display = name === 'inside' ? 'none' : '';
  controls.enableRotate = name !== 'top'; controls.maxPolarAngle = Math.PI / 2 - 0.015;
  if (name === 'top') { camera.position.set(0, 34, 0.01); controls.target.set(0, 0, 0); }
  else if (name === 'inside') { camera.position.set(0, 1.7, 9.6); controls.target.set(0, 1.7, -6); }
  else { camera.position.set(17, 16, 23); controls.target.set(0, 1.3, 0); }
  roof.visible = name === 'inside'; $('roof').checked = roof.visible;
  controls.update();
}
for (const name of ['orbit', 'top', 'inside']) $('view-' + name).onclick = () => setView(name);
$('home').onclick = () => setView(view);
function zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); }
$('zoom-in').onclick = () => zoom(0.8); $('zoom-out').onclick = () => zoom(1.25);
// Furniture drags intersect the horizontal floor plane. Orbit remains available on empty space.
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
function point(event) { const r = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(pointer, camera); return ray.ray.intersectPlane(floor, new THREE.Vector3()); }
function hit() { const result = ray.intersectObjects(furniture.children, true)[0]; if (!result) return null; let g = result.object; while (g.parent !== furniture) g = g.parent; return g.userData.id; }
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const p = point(e), id = hit();
  if (id === null) { selected = null; updateInspector(); return; }
  selected = id; updateInspector(); if (!p) return;
  const item = items.find(i => i.id === id);
  drag = { id, start: { x: e.clientX, y: e.clientY }, offset: { x: item.x - p.x, z: item.z - p.z }, moved: false };
  controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); e.stopImmediatePropagation();
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  const p = point(e);
  if (!drag) { renderer.domElement.style.cursor = hit() !== null ? 'grab' : 'default'; return; }
  if (!p) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) < 4) return;
  if (!drag.moved) { checkpoint(); eventPlan = null; drag.moved = true; }
  let x = p.x + drag.offset.x, z = p.z + drag.offset.z;
  if ($('snap').checked) { x = Math.round(x * 4) / 4; z = Math.round(z * 4) / 4; }
  const i = items.findIndex(i => i.id === drag.id); items[i] = constrain({ ...items[i], x, z });
  furniture.children.find(g => g.userData.id === drag.id).position.set(items[i].x, 0, items[i].z);
  renderer.domElement.style.cursor = 'grabbing'; updateInspector();
});
function endDrag() { if (!drag) return; drag = null; controls.enabled = true; save(); renderer.domElement.style.cursor = 'grab'; }
renderer.domElement.addEventListener('pointerup', endDrag); renderer.domElement.addEventListener('pointercancel', endDrag); renderer.domElement.addEventListener('lostpointercapture', endDrag);
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? history(redoStack, undoStack) : history(undoStack, redoStack); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
  if (e.key.toLowerCase() === 'r') $('rotate').click();
  if (e.key === 'Escape') { selected = null; updateInspector(); }
});
function previewActivity() {
  const activity = $('activity').value;
  $('activity-description').textContent = ACTIVITIES[activity].description;
  try {
    const plan = activityLayout(activity, $('attendees').valueAsNumber);
    $('activity-preview').textContent = `${plan.seated} / ${plan.requested} people seated · ${plan.capacity} seats in this template.` + (plan.shortfall ? ` Short by ${plan.shortfall} seats. Try fewer people or another activity.` : ' Fits this illustrative arrangement.');
    $('activity-preview').dataset.shortfall = String(plan.shortfall > 0);
    $('apply-activity').disabled = false;
    return plan;
  } catch (error) {
    $('activity-preview').textContent = error.message;
    $('apply-activity').disabled = true;
    return null;
  }
}
$('activity').onchange = previewActivity;
$('attendees').oninput = previewActivity;
$('activity-form').onsubmit = e => {
  e.preventDefault();
  const plan = previewActivity();
  if (!plan) return;
  checkpoint();
  const { items: arranged, ...summary } = plan;
  setItems(arranged, summary);
  setView('top');
  status(`${ACTIVITIES[plan.activity].name} layout applied. Undo to recover your changes.`);
};
let restored = false;
try {
  const raw = localStorage.getItem('warehouse-layout-v2');
  if (raw) {
    const data = JSON.parse(raw);
    if (validLayout(data.furniture)) {
      let plan = null;
      if (data.eventPlan) {
        try {
          const expected = activityLayout(data.eventPlan.activity, data.eventPlan.requested);
          // Only retain a capacity claim for exactly the generated furniture.
          if (JSON.stringify(expected.items) === JSON.stringify(data.furniture)) {
            const { items: arranged, ...summary } = expected;
            plan = summary;
          }
        } catch { /* Invalid activity metadata must not discard valid furniture. */ }
      }
      setItems(data.furniture, plan); restored = true;
      if (plan) { $('activity').value = plan.activity; $('attendees').value = plan.requested; }
    }
  }
} catch { }
if (!restored) {
  try { const raw = localStorage.getItem('warehouse-layout-v1'); if (raw) { const data = JSON.parse(raw); if (validLayout(data)) { setItems(data); restored = true; } } } catch { }
}
if (!restored) setItems(initialLayout());
previewActivity();
setView('orbit'); $('loading').remove();
new ResizeObserver(() => { const { width, height } = viewport.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }).observe(viewport);
function frame() {
  requestAnimationFrame(frame); controls.update();
  const inside = view === 'inside';
  leftWall.visible = inside || camera.position.x > -1;
  rightWall.visible = inside || camera.position.x < 1;
  backWall.visible = inside || camera.position.z > -1;
  structure.visible = view !== 'top'; roof.visible = $('roof').checked;
  renderer.render(scene, camera);
}
frame();
