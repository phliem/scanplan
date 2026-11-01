# Scanplan

A standalone, buildless 3D warehouse event planner. Use pnpm via corepack and Node.js 22.13+ (24 preferred). There are no runtime package dependencies; Three.js and OrbitControls are vendored with their MIT license.

- `dist/app.js`: venue geometry, rendering and editor interactions.
- `dist/layout.js`: dimensions in metres, furniture footprints and boundary/collision rules.
- `dist/model-file.js`: GLB preflight validation and import limits.
- `dist/model-library.js`: IndexedDB model bytes and static GLTFLoader templates. Uploaded placements share template geometry/materials; never dispose those when rebuilding furniture.
- Restore the model library before validating saved layouts. Keep editing and layout saving paused during startup; failed/missing model restoration must never overwrite the existing save.
- `server.mjs`: local static server; reads its port from `project.json`.
- Run `corepack pnpm dev` and `corepack pnpm test`.
- Three.js Y rotations map local +X toward world -Z; collision axes use the negative angle.
- Venue dimensions are estimates from one photograph, not a measured scan. Never claim surveyed accuracy or certified event capacity.
- Do not upload or include the source photograph or its people in deployed assets.
- Work on feature branches; commit and push as authorized. Do not automatically create pull requests or merge.
