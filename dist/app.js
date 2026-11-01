import { createGuestArrival } from './tour-guests.js';
import { DEFAULT_CROWD, validCrowd, createCrowd, advanceCrowd } from './crowd.js';
import { crowdView } from './crowd-view.js';
import * as THREE from 'three';
import { createTour, TOUR_DURATION, ENTRY_START } from './tour.js';
import { openLibrary, readModels, storeModel, loadModel, disposeModel } from './model-library.js';
import { MAX_MODEL_BYTES, modelName } from './model-file.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ROOM, DEFAULT_ROOM, validRoom, bounds, CATALOG, constrain, overlaps, validLayout, initialLayout, ACTIVITIES, activityLayout } from './layout.js';
const $ = id => document.getElementById(id);
const viewport = $('viewport');
const customModels = new Map();
let libraryDB = null, libraryReady = false, startupReady = false;
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
const venue = new THREE.Group(); scene.add(venue);
let leftWall, rightWall, backWall, structure, roof, entranceDoors = [];
const sharedMaterials = new Set([concrete, brick, steel, truss, plaster]);
function buildRoom() {
  const materials = new Set();
  venue.traverse(mesh => { if (mesh.isMesh || mesh.isLineSegments) { mesh.geometry.dispose(); if (!sharedMaterials.has(mesh.material)) materials.add(mesh.material); } });
  for (const material of materials) material.dispose();
  venue.clear();
  const { width: w, depth: d, eaves: h, ridge: peak } = ROOM;
  const half = w / 2, back = -d / 2, rise = peak - h;
  concreteTex.repeat.set(w / 3, d / 3);
  const base = new THREE.Group(); venue.add(base);
  box(base, w + 0.5, 0.3, d + 0.5, 0, -0.2, 0, mat('#a3aa9a'));
  box(base, w, 0.12, d, 0, -0.02, 0, concrete);
  const gridSize = Math.max(w, d), grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize * 2), '#7e8c73', '#9da98e');
  grid.position.y = 0.045; grid.material.transparent = true; grid.material.opacity = 0.12; venue.add(grid);
  leftWall = new THREE.Group(); rightWall = new THREE.Group(); backWall = new THREE.Group();
  venue.add(leftWall, rightWall, backWall);
  function sideWall(group, x) {
    const sill = Math.min(1.1, h * 0.22), windowTop = h * 0.67;
    box(group, 0.24, sill, d, x, sill / 2, 0, plaster);
    box(group, 0.24, h - windowTop, d, x, (h + windowTop) / 2, 0, brick);
    const count = Math.max(2, Math.round(d / 3.6)), bay = d / count, pier = Math.min(0.9, bay * 0.25);
    for (let i = 0; i <= count; i++) box(group, 0.25, windowTop - sill, pier, x, (windowTop + sill) / 2, back + i * bay, plaster);
    for (let i = 0; i < count; i++) {
      const z = back + (i + 0.5) * bay, wx = x + (x < 0 ? 0.14 : -0.14), span = bay - pier;
      box(group, 0.06, windowTop - sill, span, wx, (windowTop + sill) / 2, z, mat('#c4d8d0', 0.25));
      for (const zz of [z - span / 2, z, z + span / 2]) box(group, 0.1, windowTop - sill, 0.055, wx + (x < 0 ? 0.04 : -0.04), (windowTop + sill) / 2, zz, steel);
      box(group, 0.12, 0.07, span, wx, (windowTop + sill) / 2, z, steel);
    }
  }
  sideWall(leftWall, -half); sideWall(rightWall, half);
  const doorW = Math.min(3.2, w * 0.3), doorH = Math.min(3.5, h * 0.7), pierW = (w - doorW) / 2;
  for (const side of [-1, 1]) box(backWall, pierW, h, 0.25, side * (doorW / 2 + pierW / 2), h / 2, back, brick);
  box(backWall, doorW, h - doorH, 0.25, 0, (h + doorH) / 2, back, brick);
  entranceDoors = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(side * doorW / 2, 0, back - 0.15); backWall.add(hinge);
    box(hinge, doorW / 2 - 0.04, doorH, 0.1, -side * doorW / 4, doorH / 2, 0, mat('#35443d'));
    box(hinge, 0.06, 0.35, 0.12, -side * (doorW / 2 - 0.15), 1.1, 0.1, truss);
    entranceDoors.push({ hinge, side });
  }
  box(backWall, doorW + 0.3, 0.4, 0.35, 0, doorH + 0.1, back + 0.2, steel);
  structure = new THREE.Group(); venue.add(structure);
  const frames = Math.max(2, Math.round(d / 4.3));
  for (let i = 0; i <= frames; i++) {
    const z = back + 0.2 + (d - 0.4) * i / frames;
    for (const x of [-half + 0.12, half - 0.12]) {
      box(structure, 0.18, h, 0.22, x, h / 2, z, steel);
      box(structure, 0.42, 0.1, 0.42, x, 0.1, z, steel);
    }
    beam(structure, [-half, h, z], [half, h, z], 0.12, truss);
    beam(structure, [-half, h, z], [0, peak, z], 0.11, truss);
    beam(structure, [0, peak, z], [half, h, z], 0.11, truss);
    for (let j = 1; j < 6; j++) {
      const x = -half + w * j / 6, next = -half + w * (j + 1) / 6;
      beam(structure, [x, h, z], [x, peak - Math.abs(x) / half * rise, z], 0.065, truss);
      if (j < 5) beam(structure, [x, h, z], [next, peak - Math.abs(next) / half * rise, z], 0.065, truss);
    }
    box(structure, Math.min(4, w * 0.6), 0.055, 0.16, 0, h - 0.15, z, mat('#f6f4d7'));
  }
  for (const x of [-half + 0.15, half - 0.15]) box(structure, 0.16, 0.25, d, x, h, 0, steel);
  roof = new THREE.Group(); venue.add(roof);
  const sheetCount = Math.max(4, Math.round(d / 5.5)), sheetDepth = d / sheetCount;
  for (const side of [-1, 1]) for (let i = 0; i < sheetCount; i++) {
    const sheet = box(roof, Math.hypot(half, rise), 0.08, sheetDepth - 0.04, side * w / 4, (h + peak) / 2, back + (i + 0.5) * sheetDepth,
      i % 2 ? new THREE.MeshBasicMaterial({ color: '#eaf2ed', side: THREE.DoubleSide }) : mat('#929990'));
    sheet.rotation.z = -side * Math.atan2(rise, half);
  }
  roof.visible = $('roof').checked;
  const extent = Math.max(w, d, peak * 2);
  controls.maxDistance = extent * 3; camera.far = extent * 8; camera.updateProjectionMatrix();
  sun.position.set(-w / 2, Math.max(17, peak + 10), d / 3);
  sun.shadow.camera.left = -extent; sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent; sun.shadow.camera.bottom = -extent; sun.shadow.camera.far = extent * 5; sun.shadow.camera.updateProjectionMatrix();
  updateRoomFields();
}
function updateRoomFields() {
  for (const key of ['width', 'depth', 'eaves', 'ridge']) $('room-' + key).value = ROOM[key];
  $('venue-dimensions').textContent = `${ROOM.width} × ${ROOM.depth} m · approximate model`;
  $('area').textContent = `${Number((ROOM.width * ROOM.depth).toFixed(2))} m²`;
  $('room-error').textContent = '';
}
buildRoom();
const furniture = new THREE.Group(); scene.add(furniture);
let eventPlan = null;
let items = [], selected = null, nextId = 1, undoStack = [], redoStack = [], view = 'orbit';

let crowdConfig = { ...DEFAULT_CROWD }, crowd = { people: [] }, crowdFrame = null;
const paintPeople = crowdView(scene);
function rebuildPeople(preservePositions = false) {
  if (!preservePositions) crowd = createCrowd(crowdConfig, ROOM, items, CATALOG);
  paintPeople(crowd);
  $('people-count').value = crowdConfig.count || 100; $('people-behavior').value = crowdConfig.behavior;
  $('people-pause').disabled = !crowd.people.length; $('people-clear').disabled = !crowdConfig.count;
  $('people-pause').textContent = crowdConfig.paused ? 'Resume people' : 'Pause people';
  $('people-pause').setAttribute('aria-pressed', String(crowdConfig.paused));
  $('people-status').textContent = !crowdConfig.count ? 'No people added yet.' :
    `${crowd.people.length} people · ${crowd.seated} sitting · ${crowd.walking} walking · ${crowd.standing} standing${crowdConfig.paused ? ' · paused' : ''}.${crowd.people.length < crowdConfig.count ? ` Only ${crowd.people.length} of ${crowdConfig.count} could be placed; make more floor space.` : ''}${crowdConfig.behavior === 'seated' && crowd.standing ? ' Add chairs or couches for more seats.' : ''}`;
}
$('people-form').onsubmit = e => {
  e.preventDefault(); const next = { count: $('people-count').valueAsNumber, behavior: $('people-behavior').value, paused: crowdConfig.paused };
  if (!validCrowd(next)) return status('Choose a whole number from 0 to 500.');
  checkpoint(); crowdConfig = next; rebuildPeople(); updateInspector(); save();
};
$('people-clear').onclick = () => { checkpoint(); crowdConfig = { ...DEFAULT_CROWD }; rebuildPeople(); updateInspector(); save(); };
$('people-pause').onclick = () => { checkpoint(); crowdConfig.paused = !crowdConfig.paused; rebuildPeople(true); updateInspector(); save(); };
function status(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(status.timer); status.timer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
function save() { if (!libraryReady || !startupReady) { $('save-state').textContent = 'Saving paused — reload to restore your library'; return; } try { localStorage.setItem('warehouse-layout-v1', JSON.stringify({ version: 3, eventPlan, crowd: crowdConfig, room: { ...ROOM }, furniture: items.map(({ type, x, z, rotation }) => ({ type, x, z, rotation })) })); $('save-state').textContent = 'Saved on this device'; } catch { $('save-state').textContent = 'Saving unavailable — export to keep layout'; } }
function snapshot() { return structuredClone({ room: ROOM, items, eventPlan, crowdConfig }); }
function checkpoint() { undoStack.push(snapshot()); if (undoStack.length > 50) undoStack.shift(); redoStack = []; }
function meshFor(item) {
  const model = customModels.get(item.type);
  if (model) {
    const g = new THREE.Group(); g.userData.id = item.id; g.userData.customModel = true;
    g.add(model.template.clone(true)); g.position.set(item.x, 0, item.z); g.rotation.y = item.rotation; return g;
  }
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
  $('furniture-count').textContent = `${items.filter(i => i.type === 'table').length} tables · ${items.filter(i => i.type === 'couch').length} couches · ${items.filter(i => i.type === 'chair').length} chairs · ${items.filter(i => i.type === "stage").length} stages${items.some(i => customModels.has(i.type)) ? ` · ${items.filter(i => customModels.has(i.type)).length} imported` : ''}`;
}
function renderItems() {
  // Geometry/materials belong to individual furniture; shared wood and steel stay alive.
  for (const child of [...furniture.children]) { child.traverse(m => { if (!child.userData.customModel && m.isMesh) { m.geometry.dispose(); if (![wood, steel].includes(m.material)) m.material.dispose(); } }); furniture.remove(child); }
  for (const item of items) furniture.add(meshFor(item)); rebuildPeople(); updateInspector(); save();
}
function setItems(data, plan = null) { eventPlan = plan; items = data.map(i => ({ ...constrain(i), id: nextId++ })); selected = null; renderItems(); }
function fitsRoom(item, room = ROOM) {
  const b = bounds(item);
  return Math.abs(item.x) + b.x <= room.width / 2 - 0.15 + 1e-9 && Math.abs(item.z) + b.z <= room.depth / 2 - 0.15 + 1e-9;
}
function findSpot(type, preferred, rotation = 0) {
  const d = CATALOG[type], c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  if (d.width * c + d.depth * s > ROOM.width - 0.3 || d.width * s + d.depth * c > ROOM.depth - 0.3 || d.height > ROOM.eaves) return null;
  const candidates = preferred ? [preferred] : [];
  for (let z = 0; z <= ROOM.depth / 2 - 0.5; z += 1.5) for (let x = -ROOM.width / 2 + 1.5; x <= ROOM.width / 2 - 1.5; x += 1.5) for (const sign of z ? [1, -1] : [1]) candidates.push({ x, z: z * sign });
  return candidates.map(p => constrain({ type, ...p, rotation })).filter(p => fitsRoom(p)).find(p => items.every(i => !overlaps(p, i)));
}
function add(type) { if (items.length >= 200) return status('This prototype supports up to 200 objects.'); const item = findSpot(type); if (!item) return status('No free space found. Move or remove furniture first.'); checkpoint(); eventPlan = null; item.id = nextId++; items.push(item); selected = item.id; renderItems(); status(`${CATALOG[type].name} added`); }
function changeSelected(fn) { const i = items.findIndex(i => i.id === selected); if (i < 0) return; const next = constrain(fn({ ...items[i] })); if (!fitsRoom(next)) return status('This object does not fit at that rotation. Enlarge the room first.'); checkpoint(); eventPlan = null; items[i] = next; renderItems(); }
function remove() { if (selected === null) return; checkpoint(); eventPlan = null; items = items.filter(i => i.id !== selected); selected = null; renderItems(); }
function history(from, to) { if (!from.length) return; to.push(snapshot()); const previous = from.pop(); Object.assign(ROOM, previous.room); items = previous.items; crowdConfig = previous.crowdConfig; eventPlan = previous.eventPlan; selected = null; buildRoom(); renderItems(); previewActivity(); setView(view); }
for (const btn of document.querySelectorAll('[data-add]')) btn.onclick = () => add(btn.dataset.add);
$('rotate').onclick = () => changeSelected(i => ({ ...i, rotation: (i.rotation + Math.PI / 4) % (Math.PI * 2) }));
$('delete').onclick = remove;
$('duplicate').onclick = () => { const i = items.find(i => i.id === selected); if (!i) return; if (items.length >= 200) return status('This prototype supports up to 200 objects.'); const spot = findSpot(i.type, { x: i.x + 1, z: i.z + 1 }, i.rotation); if (!spot) return status('No free space for a duplicate'); checkpoint(); eventPlan = null; const copy = constrain({ ...spot, rotation: i.rotation, id: nextId++ }); items.push(copy); selected = copy.id; renderItems(); };
for (const axis of ['x', 'z']) $('pos-' + axis).onchange = e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) changeSelected(i => ({ ...i, [axis]: value })); else updateInspector(); };
$('undo').onclick = () => history(undoStack, redoStack); $('redo').onclick = () => history(redoStack, undoStack);
$('reset').onclick = () => { checkpoint(); crowdConfig = { ...DEFAULT_CROWD }; Object.assign(ROOM, DEFAULT_ROOM); buildRoom(); setItems(initialLayout()); previewActivity(); setView(view); status('Original layout restored. Undo to recover your changes.'); };
$('room-form').onsubmit = e => {
  e.preventDefault();
  const room = Object.fromEntries(['width', 'depth', 'eaves', 'ridge'].map(key => [key, $('room-' + key).valueAsNumber]));
  if (!validRoom(room)) { $('room-error').textContent = 'Use width/length 6–60 m, wall height 3–15 m, and a roof peak at least 0.5 m higher (up to 20 m).'; return; }
  if (Object.keys(room).every(key => room[key] === ROOM[key])) return;
  if (items.some(item => !fitsRoom({ ...item, x: 0, z: 0 }, room) || CATALOG[item.type].height > room.eaves)) { $('room-error').textContent = 'Some furniture is too large for these dimensions. Remove or rotate it before resizing.'; return; }
  checkpoint(); eventPlan = null; Object.assign(ROOM, room);
  let moved = 0;
  items = items.map(item => { const next = constrain(item); if (next.x !== item.x || next.z !== item.z) moved++; return next; });
  buildRoom(); renderItems(); previewActivity(); setView(view);
  const collision = items.some((item, i) => items.slice(i + 1).some(other => overlaps(item, other)));
  $('room-error').textContent = collision ? 'Some furniture overlaps. Rearrange it to make space, or undo the resize.' : '';
  status(moved ? `Room resized. ${moved} objects moved inside the boundary.` : 'Warehouse dimensions updated');
};
$('roof').onchange = e => roof.visible = e.target.checked;
function exportedModels() {
  return [...new Set(items.map(i => i.type))].filter(type => customModels.has(type)).map(type => {
    const { record } = customModels.get(type); let binary = '';
    const bytes = new Uint8Array(record.bytes);
    for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
    return { id: type, name: record.name, filename: record.filename, glbBase64: btoa(binary) };
  });
}
$('export').onclick = () => { const blob = new Blob([JSON.stringify({ version: 3, eventPlan, crowd: crowdConfig, units: 'metres', approximate: true, room: ROOM, models: exportedModels(), furniture: items.map(({ type, x, z, rotation }) => ({ type, x, z, rotation })) }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'warehouse-layout.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Layout exported'); };
const tourState = { plan: null, time: 0, playing: false, lastFrame: null, chapter: '', guests: null };
function tourPlan() {
  const plan = createTour(ROOM, items, camera.aspect);
  tourState.guests = createGuestArrival(ROOM, items, plan, 150);
  return plan;
}
function setPlaying(playing) {
  tourState.playing = playing; tourState.lastFrame = null;
  $('tour-play').textContent = playing ? 'Ⅱ' : '▶';
  $('tour-play').setAttribute('aria-label', playing ? 'Pause tour' : 'Play tour');
}
function paintTour() {
  if (!tourState.plan) return;
  const shot = tourState.plan.sample(tourState.time);
  for (const { hinge, side } of entranceDoors) hinge.rotation.y = side * shot.doorOpen * Math.PI * 0.53;
  const arrivals = tourState.guests.sample(tourState.time);
  // Keep the lens clear while guests follow the same aisles as the camera.
  paintPeople({ people: arrivals.people.filter(p => Math.hypot(p.x - shot.position[0], p.z - shot.position[2]) > 1) });
  camera.position.fromArray(shot.position); camera.up.fromArray(shot.up); camera.lookAt(new THREE.Vector3(...shot.target));
  camera.fov = shot.fov; camera.updateProjectionMatrix();
  controls.target.fromArray(shot.target);
  leftWall.visible = rightWall.visible = backWall.visible = true;
  structure.visible = shot.structureVisible;
  roof.visible = shot.roofOpacity > 0.001;
  roof.traverse(mesh => { if (mesh.isMesh) { mesh.material.transparent = shot.roofOpacity < 1; mesh.material.opacity = shot.roofOpacity; mesh.material.depthWrite = shot.roofOpacity > 0.95; } });
  $('viewport').classList.toggle('tour-interior', tourState.time >= ENTRY_START);
  if (tourState.chapter !== shot.chapter.title) {
    tourState.chapter = shot.chapter.title;
    $('tour-chapter').textContent = shot.chapter.title;
    $('tour-description').textContent = !tourState.plan.inside && tourState.time >= ENTRY_START ? 'The entrance is blocked by furniture. Enjoy a view from the doorway.' : shot.chapter.subtitle;
  }
  const clock = seconds => `0:${String(Math.floor(seconds)).padStart(2, '0')}`;
  $('tour-time').textContent = `${clock(tourState.time)} / ${clock(TOUR_DURATION)}`;
  $('tour-progress').value = tourState.time;
  $('tour-progress').setAttribute('aria-valuetext', `${Math.floor(tourState.time)} seconds of ${TOUR_DURATION}`);
}
function startTour() {
  $('tour-progress').max = TOUR_DURATION;
  selected = null; selectionOutline.visible = false;
  tourState.time = 0; tourState.chapter = ''; tourState.plan = tourPlan();
  controls.enabled = false;
  setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  paintTour();
}
function stopTour() {
  setPlaying(false); tourState.plan = null; tourState.guests = null;
  for (const { hinge } of entranceDoors) hinge.rotation.y = 0;
  paintPeople(crowd);
  roof.traverse(mesh => { if (mesh.isMesh) { mesh.material.transparent = false; mesh.material.opacity = 1; mesh.material.depthWrite = true; } });
  camera.up.set(0, 1, 0); camera.fov = 43; camera.updateProjectionMatrix();
  $('viewport').classList.remove('tour-interior'); controls.enabled = true;
}
$('tour-play').onclick = () => {
  if (tourState.time >= TOUR_DURATION) tourState.time = 0;
  setPlaying(!tourState.playing); paintTour();
};
$('tour-replay').onclick = () => { tourState.time = 0; setPlaying(true); paintTour(); };
$('tour-progress').oninput = e => { setPlaying(false); tourState.time = e.target.valueAsNumber; paintTour(); };
$('tour-explore').onclick = () => {
  const position = camera.position.clone(), target = controls.target.clone();
  setView('inside'); camera.position.copy(position); controls.target.copy(target); controls.update();
};
document.addEventListener('visibilitychange', () => { tourState.lastFrame = null; });

function setView(name) {
  if (view === 'video') stopTour();
  view = name;
  document.querySelector('main').classList.toggle('video-mode', name === 'video');
  $('tour-overlay').hidden = name !== 'video';
  for (const key of ['orbit', 'top', 'inside', 'video']) $('view-' + key).classList.toggle('active', name === key);
  document.querySelector('.canvas-label').style.display = name === 'inside' || name === 'video' ? 'none' : '';
  if (name === 'video') { startTour(); return; }
  controls.enableRotate = name !== 'top'; controls.maxPolarAngle = Math.PI / 2 - 0.015;
  fitCamera();
  roof.visible = name === 'inside'; $('roof').checked = roof.visible;
  controls.update();
}
function fitCamera() {
  if (view === 'video') { tourState.plan = tourPlan(); paintTour(); return; }
  const name = view;
  if (name === 'top') { camera.position.set(0, Math.max(ROOM.depth, ROOM.width / camera.aspect) * 1.7, 0.01); controls.target.set(0, 0, 0); }
  else if (name === 'inside') { camera.position.set(0, 1.7, ROOM.depth / 2 - 1.4); controls.target.set(0, 1.7, -ROOM.depth / 3); }
  else { const vertical = THREE.MathUtils.degToRad(camera.fov), horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect); const radius = Math.hypot(ROOM.width, ROOM.depth, ROOM.ridge) / 2; const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.03; controls.target.set(0, ROOM.ridge / 3, 0); camera.position.copy(new THREE.Vector3(0.55, 0.52, 0.74).normalize().multiplyScalar(distance).add(controls.target)); }
  controls.update();
}
for (const name of ['orbit', 'top', 'inside', 'video']) $('view-' + name).onclick = () => setView(name);
$('home').onclick = () => setView(view);
function zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); }
$('zoom-in').onclick = () => zoom(0.8); $('zoom-out').onclick = () => zoom(1.25);
// Furniture drags intersect the horizontal floor plane. Orbit remains available on empty space.
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
function point(event) { const r = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(pointer, camera); return ray.ray.intersectPlane(floor, new THREE.Vector3()); }
function hit() { const result = ray.intersectObjects(furniture.children, true)[0]; if (!result) return null; let g = result.object; while (g.parent !== furniture) g = g.parent; return g.userData.id; }
renderer.domElement.addEventListener('pointerdown', e => {
  if (view === 'video' || e.button !== 0) return;
  const p = point(e), id = hit();
  if (id === null) { selected = null; updateInspector(); return; }
  selected = id; updateInspector(); if (!p) return;
  const item = items.find(i => i.id === id);
  drag = { id, start: { x: e.clientX, y: e.clientY }, offset: { x: item.x - p.x, z: item.z - p.z }, moved: false };
  controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); e.stopImmediatePropagation();
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  if (view === 'video') return;
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
function endDrag() { if (!drag) return; drag = null; rebuildPeople(); controls.enabled = true; save(); renderer.domElement.style.cursor = 'grab'; }
renderer.domElement.addEventListener('pointerup', endDrag); renderer.domElement.addEventListener('pointercancel', endDrag); renderer.domElement.addEventListener('lostpointercapture', endDrag);
window.addEventListener('keydown', e => {
  if (!startupReady) return;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) return;
  if (view === 'video') {
    if (e.code === 'Space') { e.preventDefault(); $('tour-play').click(); }
    if (e.key === 'Escape') setView('inside');
    return;
  }
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
function registerModel(record, model) {
  customModels.set(record.id, { ...model, record });
  CATALOG[record.id] = { name: record.name, width: model.width, depth: model.depth, height: model.height };
  const button = document.createElement('button'); button.type = 'button';
  const name = document.createElement('strong'); name.textContent = record.name;
  const size = document.createElement('small'); size.textContent = `${model.width.toFixed(2)} × ${model.depth.toFixed(2)} × ${model.height.toFixed(2)} m`;
  const plus = document.createElement('b'); plus.textContent = '+'; plus.setAttribute('aria-hidden', 'true');
  button.append(name, size, plus); button.onclick = () => add(record.id); $('custom-models').append(button);
}
$('model-file').onchange = () => {
  const file = $('model-file').files[0]; if (file) $('model-name').value = modelName(file.name);
};
$('model-upload').onsubmit = async event => {
  event.preventDefault();
  if ($('upload-model').disabled) return;
  const file = $('model-file').files[0]; if (!file) return;
  if (!/\.glb$/i.test(file.name)) { $('library-status').textContent = 'Choose a .glb file.'; return; }
  if (file.size > MAX_MODEL_BYTES) { $('library-status').textContent = 'GLB files must be 16 MB or smaller.'; return; }
  $('upload-model').disabled = true; $('library-status').textContent = 'Checking and saving your model…';
  let model, registered = false;
  try {
    if (!libraryDB) libraryDB = await openLibrary();
    const bytes = await file.arrayBuffer(); model = await loadModel(bytes);
    const record = { id: 'model_' + crypto.randomUUID(), name: $('model-name').value.trim().slice(0, 80) || modelName(file.name), filename: file.name, bytes };
    await storeModel(libraryDB, record);
    registerModel(record, model); registered = true;
    $('model-upload').reset(); $('library-status').textContent = `${record.name} saved. Click it below to add it to the room.`;
    status('Model added to your library');
  } catch (error) {
    if (model && !registered) disposeModel(model.template);
    $('library-status').textContent = error.message?.startsWith('THREE.') ? 'This GLB could not be loaded. Export a static, uncompressed GLB with embedded textures.' : error.message || 'Could not import this GLB. Try exporting it again.';
  } finally { $('upload-model').disabled = false; }
};
// Do not overwrite a saved layout if its model library cannot be restored.
try {
  libraryDB = await openLibrary();
  const records = await readModels(libraryDB);
  for (const record of records) {
    if (!/^model_[a-f0-9-]+$/.test(record.id) || typeof record.name !== 'string') throw new Error('Invalid model record.');
    registerModel(record, await loadModel(record.bytes));
  }
  libraryReady = true;
  if (records.length) $('library-status').textContent = `${records.length} saved model${records.length === 1 ? '' : 's'}. Click one to add it.`;
} catch {
  libraryReady = false;
  $('library-status').textContent = 'Model storage could not be opened. Reload to retry; your saved layout will be preserved.';
}
let restored = false;
try {
  const raw = localStorage.getItem('warehouse-layout-v1') || localStorage.getItem('warehouse-layout-v2');
  if (raw) {
    const data = JSON.parse(raw);
    if (validCrowd(data?.crowd)) crowdConfig = { ...data.crowd };
    const savedItems = Array.isArray(data) ? data : data?.furniture;
    if (Array.isArray(savedItems) && savedItems.some(i => typeof i?.type === 'string' && i.type.startsWith('model_') && !customModels.has(i.type))) {
      libraryReady = false; $('library-status').textContent = 'A saved model is missing. Saving is paused to preserve your layout. Restore the browser library or reload after reopening storage.';
    }
    if (Array.isArray(data) && validLayout(data)) { setItems(data); restored = true; }
    else if (data && validLayout(data.furniture) && (!data.room || validRoom(data.room))) {
      Object.assign(ROOM, data.room || DEFAULT_ROOM); buildRoom();
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
if (!restored) setItems(initialLayout());
previewActivity();
startupReady = true; document.querySelector('main').inert = false; $('export').disabled = false; save();
setView('orbit'); $('loading').remove();
new ResizeObserver(() => { const { width, height } = viewport.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); if (view !== 'inside') fitCamera(); }).observe(viewport);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = crowdFrame === null || !Number.isFinite(now) ? 0 : (now - crowdFrame) / 1000;
  crowdFrame = Number.isFinite(now) ? now : null;
  if (view !== 'video' && !crowdConfig.paused && !document.hidden && crowd.people.length) { advanceCrowd(crowd, dt); paintPeople(crowd); }
  if (view === 'video') {
    if (tourState.playing && !document.hidden && Number.isFinite(now)) {
      if (tourState.lastFrame !== null) tourState.time = Math.min(TOUR_DURATION, tourState.time + 2 * Math.min(0.1, (now - tourState.lastFrame) / 1000));
      tourState.lastFrame = now;
      if (tourState.time >= TOUR_DURATION) setPlaying(false);
    }
    paintTour(); renderer.render(scene, camera); return;
  }
  controls.update();
  const inside = view === 'inside';
  leftWall.visible = inside || camera.position.x > -1;
  rightWall.visible = inside || camera.position.x < 1;
  backWall.visible = inside || camera.position.z > -1;
  structure.visible = view !== 'top'; roof.visible = $('roof').checked;
  renderer.render(scene, camera);
}
frame();
