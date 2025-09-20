# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Stack: React 18 + TypeScript + Vite + Tailwind CSS + D3 + Zustand (with devtools + persisted storage)
- Purpose: Interactive VLAN/network topology simulator with drag-and-drop device creation, D3-rendered canvas, simple connection management, and a domain model for VLANs and simulation primitives.

Common commands (npm)
- Install dependencies: npm install
- Start dev server (Vite, port 3000): npm run dev
- Type-check + production build: npm run build
- Preview build locally: npm run preview
- Lint (ESLint): npm run lint
- Format (Prettier): npx prettier --write .
- Tests: not configured in this repo (no test runner or scripts present)

Key configuration
- Dev server port: 3000 (vite.config.ts)
- TypeScript: tsconfig.json (+ tsconfig.node.json for Vite config)
- Tailwind: tailwind.config.js + postcss.config.js; styles in src/index.css
- Linting: .eslintrc.cjs (TS + react-refresh rules)
- Formatting: .prettierrc

Big-picture architecture
- Entry points
  - index.html bootstraps the app and loads /src/main.tsx
  - src/main.tsx creates the React root and renders <App />
  - src/App.tsx composes the main layout: Sidebar, Toolbar, and the central Canvas (wrapped by ErrorBoundary)

- State management (Zustand) — src/store/index.ts
  - Central store holds AppState (loading, error, currentView, selection, simulationRunning) and domain state: devices, connections, vlans
  - Actions for full device/connection/VLAN CRUD, view switching, simulation flags, errors, and bulk operations
  - Persisted to localStorage (key: "vlan-simulator-store"); devtools enabled

- Domain model (TypeScript types) — src/types/
  - devices.ts: DeviceType (switch/router/pc/server), interface/VLAN interface config, switch/router/pc/server structures
  - connections.ts: Connection model, ConnectionType/Status, topology/pathing helpers and enums
  - vlan.ts: VLAN model, status/type enums, assignment/broadcast-domain structures
  - simulation.ts: Packet/Protocol/Flow/Scenario/Stats types (future-facing for simulation features)

- Visualization layer (D3) — src/utils/d3-helpers/
  - canvasHelpers.ts: builds the SVG canvas, responsive sizing, grid pattern, zoom/pan behaviors, fit-to-canvas and coordinate transforms
  - deviceHelpers.ts: data join + rendering for devices (shapes, icons, labels, status), drag behavior, selection highlighting, layout helpers
  - connectionHelpers.ts: connection path computation (straight/curved with offset for multi-links), line styling (access vs trunk), labels, and hooks for future packet animations

- VLAN logic utilities — src/utils/vlan-logic/vlanConfiguration.ts
  - Validation/assignment helpers for configuring access/trunk ports, validating VLAN IDs and presence, native VLAN rules, interface status checks, and connectivity checks across switches
  - Produces structured validation results (warnings/errors) for UI consumption

- UI components
  - Sidebar (src/components/Sidebar/Sidebar.tsx):
    - View navigation (Topology/VLANs/Simulation/Statistics)
    - Device palette (drag device templates into the Canvas)
    - Lists devices or VLANs contextually by view
  - Toolbar (src/components/Toolbar/Toolbar.tsx):
    - File menu: New Topology, Load Sample, Import/Export topology JSON
    - View-specific controls (e.g., VLAN color highlight toggle; simulation start/stop placeholder)
  - Canvas (src/components/Canvas/Canvas.tsx):
    - Hosts the D3 SVG; renders devices and connections
    - Drag-n-drop device creation from templates; zoom/pan; connection label toggle; fit-to-canvas and reset-zoom
    - Uses useConnectionManager for connection creation flow and guards
  - ErrorBoundary (src/components/ErrorBoundary.tsx): Catches and displays runtime errors with a simple UI

- Sample data — src/data/sampleData.ts
  - Device templates (Switch/Router/PC/Server) and default VLAN set
  - sampleTopology and helpers to generate sample interconnections

Development notes
- Persisted state: The app persists topology and view to localStorage. To fully reset state outside the UI controls, remove the key "vlan-simulator-store" from localStorage.
- Sample topology: Load via Toolbar > File > "Load Sample" or the Canvas empty-state button. This seeds devices/VLANs and creates sample connections for quick visualization.
- Views other than Topology (VLAN Config, Packet Simulation, Statistics) are present as stubs for future integration with vlanConfiguration utilities and simulation types.
