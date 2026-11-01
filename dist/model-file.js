export const MAX_MODEL_BYTES = 16 * 1024 * 1024;
export const MAX_LIBRARY_BYTES = 128 * 1024 * 1024;
export const MAX_MODELS = 32;
// Inspect the binary before invoking a loader: model imports must be self-contained.
export function inspectGLB(buffer) {
  const fail = message => { throw new Error(message); };
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) fail('Choose a valid GLB 2.0 file.');
  if (buffer.byteLength > MAX_MODEL_BYTES) fail('GLB files must be 16 MB or smaller.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) fail('Choose a valid GLB 2.0 file.');
  let json, binary = false;
  for (let offset = 12; offset < buffer.byteLength;) {
    if (offset + 8 > buffer.byteLength) fail('The GLB file is truncated.');
    const length = view.getUint32(offset, true), kind = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > buffer.byteLength) fail('The GLB file is truncated.');
    if (offset === 12 && kind !== 0x4e4f534a) fail('The GLB is missing its model description.');
    if (kind === 0x4e4f534a) {
      if (json) fail('The GLB contains multiple model descriptions.');
      try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset + 8, length))); }
      catch { fail('The GLB model description is invalid.'); }
    } else if (kind === 0x004e4942) binary = true;
    offset += 8 + length;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) fail('The GLB model description is invalid.');
  for (const key of ['meshes', 'scenes', 'nodes', 'buffers', 'bufferViews', 'accessors', 'images', 'animations', 'skins', 'cameras', 'extensionsUsed', 'extensionsRequired']) {
    if (json[key] !== undefined && !Array.isArray(json[key])) fail('The GLB model description is invalid.');
  }
  for (const node of json.nodes || []) {
    if (!node || typeof node !== 'object' || (node.children !== undefined && !Array.isArray(node.children))) fail('The GLB node hierarchy is invalid.');
  }
  if (json?.asset?.version !== '2.0' || !binary || !json.meshes?.length || !json.scenes?.length) fail('The GLB must contain a 3D model.');
  if (json.animations?.length || json.skins?.length || json.cameras?.length || json.nodes?.some(n => n.skin !== undefined || n.camera !== undefined)) fail('Use a static GLB without animations, skins or cameras.');
  if (json.buffers?.some(b => b.uri !== undefined) || json.images?.some(i => i.uri !== undefined)) fail('Embed all textures and buffers in the GLB; external files are not supported.');
  if (json.extensionsUsed?.some(e => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu', 'KHR_lights_punctual', 'EXT_mesh_gpu_instancing'].includes(e))) fail('Export an uncompressed GLB without lights or instancing.');
  const supportedRequired = new Set(['KHR_materials_clearcoat', 'KHR_materials_dispersion', 'KHR_materials_ior', 'KHR_materials_sheen', 'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_iridescence', 'KHR_materials_anisotropy', 'KHR_materials_unlit', 'KHR_materials_volume', 'KHR_materials_emissive_strength', 'KHR_texture_transform', 'KHR_mesh_quantization', 'EXT_materials_bump', 'EXT_texture_webp', 'EXT_texture_avif']);
  if (json.extensionsRequired?.some(e => !supportedRequired.has(e))) fail('This GLB requires an unsupported extension. Export a standard, uncompressed GLB.');
  if ((json.nodes?.length || 0) > 2000 || (json.accessors || []).some(a => !Number.isInteger(a.count) || a.count < 0 || a.count > 2000000)) fail('This model is too complex. Use fewer than 2,000 nodes and 500,000 triangles.');
  // A cyclic node graph can otherwise recurse indefinitely inside the loader.
  const active = new Set(), visited = new Set(), nodes = json.nodes || [];
  function visit(i, depth = 0) {
    if (!Number.isInteger(i) || !nodes[i] || active.has(i) || depth > 100) fail('The GLB node hierarchy is invalid or too deep.');
    if (visited.has(i)) return;
    active.add(i);
    for (const child of nodes[i].children || []) visit(child, depth + 1);
    active.delete(i); visited.add(i);
  }
  nodes.forEach((_, i) => visit(i));
  return json;
}
export function modelName(filename) {
  return filename.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || 'Imported model';
}
