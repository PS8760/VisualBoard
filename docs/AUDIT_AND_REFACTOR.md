# Audit & refactor log — realtime, canvas, comments, versions, attachments

Date: 2026-10-14. Scope: full-stack audit of the whiteboard's collaboration path, plus fixes, tests and docs.
Protocol reference: [`API.md`](API.md).

## 1. Critical defects found

| # | Area | Defect | Impact |
|---|------|--------|--------|
| 1 | Sync | Every client saved by **PUT `/elements/bulk` (full replace) 900 ms after any change, remote changes included**, and also sent socket events. | A stale tab deleted whatever collaborators had added since it last synced (lost updates). N clients made N full-board writes per edit, and the 200-writes/15-min limiter returned 429s within minutes of normal editing. |
| 2 | Sync | `updateElement` did a read-modify-write in Node; there were no ACKs, no ordering and no conflict guard. | Concurrent patches overwrote each other, and out-of-order broadcasts regressed state. |
| 3 | Sync | No resync after reconnect; events missed while disconnected were lost forever. If the first connection failed, the socket was closed for good and **fake "simulated" collaborators** were shown on real boards. | Clients silently diverged, and users saw fake people. |
| 4 | Versions | The client called `POST /versions/:id/restore`, but the route is `/boards/:boardId/versions/:id/restore`. | **Restore never worked.** |
| 5 | Versions | Restore never checked that the version belonged to the board in the URL. | **IDOR**: the owner of board A could restore board B's snapshot into board B. |
| 6 | Versions | Restore wasn't broadcast, so other clients kept the old state and their next bulk save overwrote the restore. Nothing created snapshots automatically, despite the "autosaved every change" UI text. The list endpoint shipped every full snapshot. | Restore was undone by collaborators, history was empty, and payloads were large. |
| 7 | Comments | Comments were persisted twice (socket emit **and** REST). The comment tool posted an empty comment (rejected by the server, left dangling locally). Remote clients also called DELETE for comments they merely received. Pins came from a client-mutated `commentCount`, and the thread popover used screen coordinates captured at click time. | Duplicate comments, broken pins, popovers drifting while panning/zooming. |
| 8 | Canvas | Fabric 7 defaults objects to a **center** origin; all app math (drawing, overlays, arrange, backend layout, stored data) is top-left. | Shapes jumped by half their size when created, and overlays were misplaced. |
| 9 | Canvas | Members of a multi-selection were serialized with **selection-relative** coordinates. Resizing (`scaleX/Y`) was never persisted. Group bounds grew by 1px per save. | Multi-select drags teleported elements near the origin, resizes were lost on reload, cards slowly grew. |
| 10 | Canvas | Every remote change ran `canvas.clear()` and rebuilt every object. | Jank under collaboration, and loss of the local selection or in-progress text editing whenever anyone else edited. |
| 11 | Canvas | Remote cursors were transformed into world space twice. `fitBoardToView` was immediately undone by a stale viewport. | Cursors appeared in the wrong place when panned/zoomed, and fit-to-content never applied. |
| 12 | Data | Seeded and legacy rows stored the element id only in the row column, not in `element_data`. | Those elements had `id: undefined` on the client, so edits to them were sent without an id. |
| 13 | Attachments | Images were persisted as `blob:` URLs. A fake 0-byte "Welcome.txt" document (no stored bytes) was created on every new board. Deleting an element deleted its files but left the DB rows. A failed DB insert orphaned uploaded bytes. | Images broke for everyone else and after reload, a broken document appeared on every board, and storage and metadata got out of sync. |
| 14 | Misc | Renaming a board was never persisted (`setTitle` only triggered the bulk save). Undo/redo replaced the whole board, reverting collaborators' work, and wasn't synced. | Lost renames, and undo destroyed other users' edits. |

### Found during end-to-end testing on the Docker stack

| # | Defect | Fix |
|---|--------|-----|
| 15 | The frontend Dockerfile never copied `index.html`, so `docker compose up --build` always failed. | The file is now copied. |
| 16 | nginx's default 1 MB body limit rejected attachments between 1 and 10 MB with a 413. | `client_max_body_size 12m`, with streaming proxying. |
| 17 | The socket.io Redis adapter was never enabled: the check ran before the Redis connection was ready. Realtime events never crossed API instances. | The server waits for Redis to be ready. Verified with two API instances sharing Redis. |
| 18 | The seed inserted rows with explicit ids without advancing the Postgres sequences, so the first board, comment or version created afterwards failed with P2002. Re-running the seed also duplicated the demo content. | Sequences are reset, and the seed is idempotent. |
| 19 | Starter content for new boards used hardcoded global ids (`seed_1`…), so only the first board ever created got it; later boards hit conflicts. It also included a fake comment pin. | Fresh ids per board; the fake pin is removed. |
| 20 | Compose hardcoded host ports 5432/6379, which clash with local installs. | Host ports and rate limits are configurable. |
| 21 | Status-bar tooltips overflowed the board's `overflow: hidden` root, which the browser could then scroll programmatically, pushing the top bar off-screen. | The root uses `overflow: clip`. |
| 22 | The onboarding tour was a centered modal over a full-screen blur, so it described tools it never showed. Its `highlightTool` field was unused, each step's tool switch fired one step late, it covered 4 of 12 tools, and board hotkeys (R, Delete…) still fired behind it. | It's now a spotlight tour anchored to the real UI via `data-tour` attributes, with 11 steps covering every tool, the side panel (opened for that step), history, sharing, undo and commands. The card is placed beside its target, input is blocked during the tour, it supports ←/→/Esc, and it can be replayed from Help. The advertised **I**/**D** shortcuts are now actually bound. |

## 2. Architecture after the refactor

### Realtime sync (client `services/realtime.ts`, server `modules/socket/*`)
- **Single write path per resource.** Elements go over the socket with ACKs. Comments go over REST, and the server broadcasts them with the client's `clientId` for optimistic reconciliation. Bulk sync is no longer used by the editor.
- **Outbox.** Local edits are applied optimistically and queued. Rapid updates to one element are merged into a single write. A create followed by a delete that never left the client is dropped. At most one operation per element is in flight, so ordering is preserved; different elements are sent concurrently.
- **ACK / rollback.** Every mutation is ACKed with the authoritative row. Timeouts retry with backoff, which is safe because every operation is idempotent server-side. A `NOT_FOUND` response removes the element locally. `FORBIDDEN` switches the board to read-only. Other rejections roll back by resyncing from the server and rebasing still-pending operations on top.
- **Versions.** The server owns `version` and increments it atomically in the same `UPDATE … SET element_data = element_data || $patch` statement, so patches to different fields never lose each other. Broadcasts carry the full merged row, and clients ignore anything older than what they already hold.
- **Reconnects.** socket.io reconnects with jittered exponential backoff (0.5–10 s). The browser's `offline`/`online` events drop and restore the socket immediately, and the server heartbeat now detects silent drops in about 18 s instead of 45 s. Every (re)join is ACKed, which triggers a resync plus a rebase of pending operations before the outbox is replayed. The UI shows a reconnecting/offline banner with the number of queued changes, and `beforeunload` warns while writes are pending.
- **Live drag previews** (`element:preview`) are volatile, throttled to about 30 Hz and never persisted. Receivers snap back if the final update never arrives. Cursors are volatile with trailing-edge throttling, so the resting position is always delivered.
- **REST and socket parity.** REST writes broadcast through `socket.bus.ts` (and the Redis adapter when configured), and socket payloads use the same Zod schemas as REST.

### Canvas (`pages/Board/CanvasStage.tsx`)
- **Incremental reconciliation**: board store → Fabric. Each object is tracked with a key-order-independent render signature, and only changed elements are rebuilt, in place, keeping their z-order. Changes to objects the user is currently dragging, multi-selecting or text-editing are deferred until they let go. Local edits mark themselves as already synced, so they never trigger a rebuild.
- Top-left origin is pinned globally. Scale and rotation are persisted. Multi-selection edits are serialized in absolute coordinates.
- Performance: `skipOffscreen` viewport culling, batched rendering (`renderOnAddRemove: false`), viewport store updates coalesced to one per animation frame, and cursor moves no longer write to the store.
- Input: anchor-correct ctrl/trackpad pinch zoom, two-finger touch pinch and pan, and modifier keys reset on window blur.
- Text is re-measured once web fonts load; Fabric's glyph-width cache is cleared first, otherwise text measured with the fallback font stayed clipped.

### Undo / redo (`stores/useBoardStore.ts`)
History is a list of per-element `{ before, after }` changes. Edits made in the same tick form one step, and typing into one element merges into one step. Undo reverts **only the fields this user changed** and syncs through the outbox. It never resurrects an element a collaborator deleted. History resets on restore.

### Comments
Threads are anchored in **world space**: to an element (following it as it moves), or to an absolute point. Element-pinned comments also store x/y, so when the element is deleted the server un-pins them (broadcasting `comment:updated`) and the thread stays where it was. The comment tool opens an on-canvas composer, and threads support replies, deletion (author or owner) and pending/failed states. Panel entries can jump to their thread.

### Versions
- **Auto-snapshots**: taken after edits settle for 30 s, or at least every 3 min during continuous editing.
- Snapshots identical to the latest one (by content hash) are skipped, and each board keeps its newest 100. Postgres compresses the JSONB bodies.
- Every snapshot is labelled: `Manual snapshot`, `Auto-save` or `Before restore`.
- Restore checks the version belongs to the board, saves a safety copy and assigns versions higher than anything clients have seen. It broadcasts `board:restored`, so every client swaps state in place without reconnecting. Pending snapshots are flushed on graceful shutdown.

### Attachments
- Uploads are checked on the client (type and the 10 MB limit) with progress toasts.
- PDF and image uploads must match their declared type's file signature.
- Stored bytes are deleted if the DB write fails.
- Downloads are streamed, with an RFC 5987 filename and an immutable cache header.
- Deleting a document strips the attachment from elements that reference it.
- Element deletion keeps the attachment, so restored versions still resolve it.
- The document tool opens a real file picker.
- Canvas images are re-encoded to WebP/JPEG inline data URLs of at most about 95 KB, so they render for everyone, after reloads and inside snapshots.

## 3. Schema and data changes

- `20261014000000_version_labels`: adds `versions.label`, plus indexes `(board_id, created_at DESC)` and `comments(element_id)`.
- `20261014000100_backfill_element_ids`: writes `element_data.id` for legacy rows. The seed now stores ids and versions.

Run `npx prisma migrate deploy` (Docker does this on boot).

**Compatibility note:** pen strokes and lines created by the previous build were stored with Fabric's center-based positions, so they may now appear offset by half their size. Shapes, notes, text and seed data were already stored top-left and are unaffected.

## 4. Verification

| Suite | Result |
|-------|--------|
| Backend lint, typecheck and build | clean |
| Backend tests | 90 passed. New `test/integration/realtime.test.ts` covers ACKs, server-owned versions, 20 concurrent cross-field patches with no lost update, roles/validation/NOT_JOINED, cross-board id hijack, idempotent replays, un-pinning, restore broadcast, cross-board restore IDOR, snapshot dedupe and retention, and legacy rows. |
| Frontend lint, `tsc -b` and build | clean |
| Frontend unit tests | 51 passed. New `realtime.test.ts` and `history.test.ts` cover coalescing, per-element ordering, stale-broadcast rejection plus rebase, rollback, NOT_FOUND, offline queue → rejoin rebase, ACK-timeout retry, restore handling, field-level undo, typing coalescing and comment threading. |
| E2E (Playwright, real API, Postgres and sockets) | 13 passed, against the dev servers and against the full `docker compose` stack (nginx + production build + Redis adapter), 26/26 on a repeated run; the collaboration specs also passed 16/16 repeated runs. New `e2e/collaboration.spec.ts` covers two-user live drawing, **commenting while another user restores a version**, **uploading while a collaborator moves elements**, and **offline edits queued then synced**. |

Production-path checks on the Docker stack:
- An element created through one API instance is broadcast to a client on another instance via Redis.
- A 6 MB PDF uploaded and downloaded through nginx round-trips byte-identical; 11 MB is rejected with a clean 413.
- AI suggestions return results through the API and render in the UI.
- Backend tests also pass against Docker Postgres.

The existing e2e specs had two harness bugs, both fixed: they passed `{ token, user }` but read `session`, and they didn't dismiss the onboarding overlay. Two previously failing unit tests depended on the machine (a missing Groq key; a locale-specific date format) and are now environment-independent.

## 5. Known limitations

- Conflicts resolve **per field, last writer wins** (not a CRDT). Two people editing the same text element at once doesn't merge characters.
- The outbox lives in memory. Closing the tab while offline loses queued edits; the user is warned before unload.
- Auto-snapshot timers are per process. A crash loses only the pending checkpoint.
- Uploads are buffered in memory (multer, 10 MB cap). Document previews are rendered on the client; the server generates no thumbnails.
