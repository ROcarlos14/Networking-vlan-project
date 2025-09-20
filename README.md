# VLAN Simulator

Lightweight VLAN topology simulator and visualizer built with React, TypeScript, Vite and D3. This repository contains a development-ready UI and simulation engines for VLAN learning, packet flow and spanning-tree simulation.

## Quick start (Windows PowerShell)

Prerequisites: Node.js 16+ and `npm`.

1. Install dependencies:

```powershell
npm ci
```

2. Start the dev server:

```powershell
npm run dev
```

3. Open the app in your browser: `http://localhost:5173`

4. Useful scripts

- `npm run dev` — start Vite dev server
- `npm run build` — run TypeScript check and build production bundle
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

## Goals

- Interactive topology editor (add/remove devices, connect ports)
- VLAN tagging and per-VLAN visualization
- Packet flow simulation with basic statistics
- Export/import topology JSON and example presets

## Example presets

The project includes a `sampleTopology` used by the UI `File → Load Sample` action. You can also import/export JSON topologies using the toolbar.

## Contributing

Small, focused PRs welcomed. Please run `npm run lint` and unit tests (if added) before opening a PR.

## Next steps (recommended)

- Add CI for lint/test/build.
- Add more example topologies in `public/examples/` for quick manual testing.
- Add a lightweight smoke test (Vitest) to validate the store and topology load/save.

---
Made to help evaluate and demo VLAN behaviors. If you want, I can add example presets and a CI workflow next.
