import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectGLB, modelName, MAX_MODEL_BYTES } from './dist/model-file.js';
import { CATALOG, bounds, constrain, overlaps, validLayout } from './dist/layout.js';
function glb(patch = {}) {
  const doc = { asset: { version: '2.0' }, meshes: [{ primitives: [] }], scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], ...patch };
  let text = JSON.stringify(doc); text += ' '.repeat((4 - text.length % 4) % 4);
  const bytes = new TextEncoder().encode(text), buffer = new ArrayBuffer(28 + bytes.length), view = new DataView(buffer);
  [0x46546c67, 2, buffer.byteLength, bytes.length, 0x4e4f534a].forEach((v, i) => view.setUint32(i * 4, v, true));
  new Uint8Array(buffer, 20, bytes.length).set(bytes);
  view.setUint32(20 + bytes.length, 0, true); view.setUint32(24 + bytes.length, 0x004e4942, true);
  return buffer;
}
test('GLB inspection accepts static embedded models and rejects bad containers', () => {
  assert.equal(inspectGLB(glb()).asset.version, '2.0');
  for (const value of [null, new ArrayBuffer(0), glb().slice(0, -1), new ArrayBuffer(MAX_MODEL_BYTES + 1)]) assert.throws(() => inspectGLB(value));
  const bad = glb(); new DataView(bad).setUint32(4, 1, true); assert.throws(() => inspectGLB(bad));
  const badChunk = glb(); new DataView(badChunk).setUint32(12, 0xffffffff, true); assert.throws(() => inspectGLB(badChunk));
});
test('imports cannot fetch external resources or require unsupported scene features', () => {
  for (const patch of [
    { buffers: [{ uri: 'https://example.com/model.bin' }] },
    { images: [{ uri: 'texture.png' }] }, { images: [{ uri: 'data:image/png;base64,AAAA' }] },
    { extensionsRequired: ['VENDOR_unknown'] }, { animations: [{}] }, { skins: [{}] }, { cameras: [{}] }, { nodes: [{ camera: 0 }] },
    { extensionsUsed: ['KHR_draco_mesh_compression'] }, { extensionsUsed: ['KHR_texture_basisu'] },
    { extensionsUsed: ['EXT_mesh_gpu_instancing'] }, { extensionsUsed: ['KHR_lights_punctual'] },
  ]) assert.throws(() => inspectGLB(glb(patch)));
  assert.ok(inspectGLB(glb({ images: [{ bufferView: 0, mimeType: 'image/png' }] })));
});
test('invalid/cyclic node graphs and oversized accessors are rejected before loading', () => {
  for (const patch of [
    { nodes: [{ children: [0] }] }, { nodes: [{ children: [1] }, { children: [0] }] },
    { nodes: {} }, { nodes: [{ children: {} }] }, { nodes: [null] }, { nodes: [{ children: [3] }] }, { nodes: [{ children: [-1] }] },
    { accessors: [{ count: 2e9 }] }, { accessors: [{ count: -1 }] }, { accessors: [{ count: 1.5 }] },
  ]) assert.throws(() => inspectGLB(glb(patch)));
});
test('custom model dimensions drive validation, collision checks and rotated bounds', () => {
  CATALOG.model_test = { name: 'Chesterfield', width: 2.4, depth: .95, height: .85 };
  try {
    const item = { type: 'model_test', x: 0, z: 0, rotation: Math.PI / 2 };
    assert.equal(validLayout([item]), true);
    const extent = bounds(item); assert.ok(Math.abs(extent.x - .475) < 1e-10); assert.ok(Math.abs(extent.z - 1.2) < 1e-10);
    assert.equal(overlaps(item, { type: 'chair', x: 0, z: .9, rotation: 0 }), true);
    assert.equal(overlaps(item, { type: 'chair', x: 2, z: .9, rotation: 0 }), false);
    assert.ok(constrain({ ...item, x: 100 }).x < 6);
  } finally { delete CATALOG.model_test; }
});
test('filenames become concise editable model labels', () => {
  assert.equal(modelName('red-chesterfield_couch.GLB'), 'red chesterfield couch');
  assert.equal(modelName('.glb'), 'Imported model');
  assert.equal(modelName('x'.repeat(100) + '.glb').length, 80);
});
