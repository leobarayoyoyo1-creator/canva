# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start         # Run both servers together (recommended)
npm run server    # Express backend only  → http://localhost:3001
npm run dev       # Vite frontend only    → http://localhost:5173 (exposed on LAN via --host)
npm run build     # Production build
npm run lint      # ESLint
```

No test suite exists in this project.

## Architecture

Visual canvas tool (n8n-style) for mapping system architectures. Built with React + Vite, `@xyflow/react` v12, and Tailwind CSS v4.

### State management

All canvas state lives in a single custom hook: `src/store/useCanvasStore.js`.

- **No external state library** — uses React `useState` + `useCallback` + `useRef`
- Persists `nodes` and `edges` to SQLite (`canvas.db`) via Express backend — **not** localStorage
- Debounced save (1s) on every state change; `navigator.sendBeacon` on `beforeunload` as backup
- Undo/redo via a manual snapshot stack (`historyRef`) — call `snapshot()` **before** any mutation
- Callbacks (e.g. `onAddNear`, `onUpdate`, `onResizeEnd`) are **not** stored in state. They're injected at render time in `Canvas.jsx` via `useMemo` (`nodesWithCallbacks`), keeping serializable state clean

### Node types

| type | component | description |
|---|---|---|
| `systemNode` | `SystemNode.jsx` | Main architectural nodes with category/status |
| `stickyNote` | `StickyNote.jsx` | Yellow collapsible sticky notes (not connectable, no handles) |
| `textCard` | `TextCard.jsx` | Resizable text cards with accent color |

Edge type `system` → `SystemEdge.jsx` — supports smart path routing via `src/utils/smartPath.js` and inline label editing.

### Category/color constants

`CATEGORIES`, `STATUSES`, `PRIMARY_COLOR`, and `SNAP_GRID` are exported from `useCanvasStore.js`. **They are also duplicated in `server.js`** (server runs in Node.js, can't import from Vite modules). If changing any constant, update both files.

Categories: `client`, `product`, `api`, `database`, `queue`, `service`, `other`.

### Backend (`server.js`)

Express server (port 3001, bound to `0.0.0.0` for LAN access) with SQLite via `better-sqlite3`:

| Endpoint | Purpose |
|---|---|
| `GET /api/canvas` | Load saved nodes + edges |
| `POST /api/canvas` | Save nodes + edges (frontend, debounced 1s + sendBeacon) |
| `GET /api/events` | SSE stream — browser subscribes directly to port 3001 (bypasses Vite proxy) |
| `POST /api/webhook/entrada` | Receives `{ nome, codigo, modelo, data? }` from n8n, runs `processEntrada`, saves to DB, broadcasts `canvas-update` SSE event with full canvas |

Vite proxies `/api/*` to `http://localhost:3001`, **except** SSE. `useWebhookListener.js` connects EventSource directly to `http://hostname:3001/api/events` when on port 5173, because Vite's proxy buffers SSE and events never arrive in real time.

### Webhook flow (`processEntrada` in `server.js`)

1. Find or create client node (matched by `nome`, case-insensitive)
2. Create product node with `createdAt` (YYYY-MM-DD from payload or server date)
3. Create textCard node below product with `createdAt`
4. Save to SQLite → broadcast full `canvas-update` SSE → frontend calls `setCanvasFromServer`

`createdAt` is stored only on `product` and `textCard` nodes — not on `client` (clients are reused across dates).

### Filter system (`Canvas.jsx`)

Date filter is **purely visual** — it never modifies the store or DB:
- `filterDates` (state): persisted in `localStorage` (not the canvas data)
- `filterPositions` (state): temporary drag positions during filter, discarded on clear
- `filterData` (useMemo): computes `visibleIds` + `layoutPositions` from current nodes/edges
- `handleNodesChange`: intercepts position changes during filter → `filterPositions` instead of store
- On clear: positions revert to the real positions stored in the DB

### Canvas behaviors

- **Snap grid**: 16px (`SNAP_GRID`). SystemNode sizes snap to 32px (2× grid); TextCard to 16px.
- **Alignment guides**: shown during systemNode drag (`GuideLines.jsx`), triggered within 6px threshold.
- **Border merging**: adjacent systemNodes/textCards hide shared borders (`getTouchingSides` in `Canvas.jsx`).
- **Color snap**: textCards touching a systemNode inherit the node's category color while dragging.
- **Edge snap**: textCards snapped to adjacent node edges on drag stop (minimum penetration axis).
- **Smart routing**: `smartPath.js` only reroutes Right→Left forward-going connections (targetX > sourceX + 80); all others use bezier fallback.
- **Pan**: middle mouse button. **Selection**: left-drag. **Delete**: Delete key.
- **Copy/paste**: Ctrl+C / Ctrl+V (in-session clipboard only, not persisted).
- **StickyNote delete**: only via Delete key after selection — right-click is disabled for stickyNotes.

---

## Known Issues Backlog

Discovered during audit (2026-03-06). Ordered by priority within each group.

### P1 — Real bugs (broken behavior)

| # | Where | Problem |
|---|---|---|
| 1 | `SystemEdge.jsx:49` | Escape on edge label commits the draft instead of canceling — should restore the previous label |
| 2 | `Canvas.jsx:483` | Right-click on stickyNote is silently ignored; no way to delete via context menu (only Delete key works, which is hidden) |
| 3 | `server.js:94` | Webhook products positioned relative to client's DB position — after user drags the client node, new products from n8n land in the wrong place |
| 4 | `server.js` | No deduplication for products — if n8n retries a webhook, identical `{nome, codigo, modelo}` creates duplicate product + textCard nodes |

### P2 — UX gaps (missing expected functionality)

| # | Where | Problem |
|---|---|---|
| 5 | `Canvas.jsx` + `useCanvasStore.js` | textCard accent color has no reset — once color-snapped to a node, there's no way to revert to the original color |
| 6 | `useCanvasStore.js:358` | `updateStickyNote` (used for both stickyNotes and textCards) has no `snapshot()` — changes to textCard fontSize, bgColor, accentColor cannot be undone |

### P3 — Technical debt (fix when touching related code)

| # | Where | Problem |
|---|---|---|
| 7 | `useCanvasStore.js:47-55` | `INITIAL_NODES` places a hardcoded "API Gateway" node on first boot (empty DB). It gets saved to the DB on the first debounce. Confusing for new installs. |
| 8 | `server.js` + `useCanvasStore.js` | Constants duplicated: `CATEGORIES`, `PRIMARY_COLOR`, `SNAP_GRID`, `DEFAULT_NODE_WIDTH/HEIGHT`. Already caused bug: server creates textCards at width 224, client creates them at 240. |
| 9 | `useCanvasStore.js:119` | `saveTimer` useEffect has no cleanup — timer fires after unmount. Harmless in practice (hook never unmounts) but incorrect. |

### P4 — Low priority / won't fix soon

| # | Where | Problem |
|---|---|---|
| 10 | `SystemEdge.jsx:18` | `useNodes()` in every edge instance — all edges re-render + recompute smart path on any node move. Fine for <50 nodes, degrades at scale. |
| 11 | `useCanvasStore.js:57-63` | `migrateNodes` adds `style: {width:224, height:96}` to stickyNotes — they ignore `style` entirely. Unnecessary data bloat. |
| 12 | `useCanvasStore.js:267` | `deleteNode` calls `closeContextMenu()` internally even when deletion comes from context menu (already handled). Redundant but harmless. |
