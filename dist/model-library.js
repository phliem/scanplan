import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { inspectGLB, MAX_LIBRARY_BYTES, MAX_MODELS } from './model-file.js';

export function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scanplan-model-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('models', { keyPath: 'id' });
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Scanplan tabs and reload to open the library.'));
  });
}
export function readModels(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('models', 'readonly'), request = tx.objectStore('models').getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Could not read the model library.'));
  });
}
export function storeModel(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('models', 'readwrite'), store = tx.objectStore('models');
    let reason;
    const request = store.getAll();
    request.onsuccess = () => {
      const others = request.result.filter(r => r.id !== record.id);
      if (others.length >= MAX_MODELS || others.reduce((n, r) => n + r.bytes.byteLength, record.bytes.byteLength) > MAX_LIBRARY_BYTES) {
        reason = new Error('Library full (32 models / 128 MB).'); tx.abort(); return;
      }
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(reason || new Error('Could not save the model. Browser storage may be full or unavailable.'));
  });
}
export function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) { t.dispose(); t.source?.data?.close?.(); }
}
export async function loadModel(bytes) {
  inspectGLB(bytes);
  const manager = new THREE.LoadingManager();
  // Embedded images become blob URLs. Any other resource request is disallowed.
  manager.setURLModifier(url => { if (!url.startsWith('blob:')) throw new Error('External model resources are not supported.'); return url; });
  let gltf;
  try { gltf = await new GLTFLoader(manager).parseAsync(bytes, ''); }
  catch { throw new Error('This GLB could not be loaded. Export a static, uncompressed GLB with embedded textures.'); }
  const source = gltf.scene, root = new THREE.Group(); root.add(source);
  try {
    let triangles = 0, meshes = 0;
    root.traverse(o => {
      if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3; o.castShadow = true; o.receiveShadow = true; }
    });
    if (!meshes || triangles > 500000) throw new Error('Use a model with 1–500,000 triangles.');
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true), size = bounds.getSize(new THREE.Vector3());
    if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n >= 0.01) || size.x > 60 || size.z > 60 || size.y > 20) throw new Error('Model dimensions must be at least 1 cm, at most 60 m wide/deep and 20 m high. Export in metres.');
    // Keep original scale; centre the footprint and place its lowest point on the floor.
    root.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    const template = new THREE.Group(); template.add(root);
    return { template, width: size.x, depth: size.z, height: size.y };
  } catch (error) { disposeModel(root); throw error; }
}
