# Scanplan

A browser-only 3D event-layout prototype inspired by the supplied warehouse photograph. It models exposed brick, concrete, steel roof trusses, high windows and skylights. The estimated 12 × 22 m footprint is illustrative, not measured or automatically reconstructed.

## Run

Run `corepack pnpm dev` from this repository (Node.js 22.13+). No dependency installation is required.
Open http://localhost:8108. The server reads its port from `project.json`.
There are no runtime package dependencies. Three.js 0.170.0 and OrbitControls are vendored under `dist/vendor/` with their MIT license so rendering needs no external CDN.

## Use

- Drag empty space to orbit; scroll or use +/− to zoom. Right-drag pans.
- Select **Floor plan** for overhead placement or **Inside** for an eye-level perspective.
- Drag furniture to move it; optionally snap to a 0.25 m grid. The inspector also accepts coordinates in metres, relative to the room centre.
- Add tables, couches and chairs from the catalogue; rotate, duplicate or delete selected items. R rotates, Delete removes and Escape deselects.
- Undo/redo with the toolbar or Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z. History lasts for the current page session. Reset can also be undone.
- Furniture positions persist in this browser's local storage. Export downloads a JSON record, including estimated room dimensions. JSON import is not implemented.
- Objects stay within the estimated room boundary. Amber outlines warn about overlapping furniture; they do not certify circulation, fire egress, accessibility or capacity. Up to 200 furniture objects are supported.

The source photo and its people are not included or uploaded. All geometry and textures are generated locally. There is no backend, room scanning, automatic arrangement, or account integration in this first prototype. The UI switches camera perspectives; it does not implement first-person walking controls.

## Verification

`corepack pnpm test` tests rotated boundaries, collision detection, initial furniture placement and saved-layout validation. Browser QA covers the three views, adding, dragging, rotating, editing coordinates, local persistence and history controls.

Static deployment uses `dist/`. The existing private prototype is at https://brickworks-warehouse-planner.lacypixie.chatgpt.site (ChatGPT sign-in required). This repository is independent of the Octo Devlabs monorepo; the original source is preserved there.
