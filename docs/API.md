# VisualBoard API Reference

Base URL: `http://localhost:8000/api/v1` (in production, whatever origin serves the API).

All endpoints (except auth + health) require `Authorization: Bearer <token>`.

## Response envelope

Successful responses: `{ "success": true, "data": … }`
Errors: `{ "success": false, "error": { "code", "message", "details?" } }`

Common error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` (409), `VALIDATION_ERROR` (422), `BAD_REQUEST` (400),
`PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL` (500).

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness. Always 200 when the process is up. |
| GET | `/health/ready` | Readiness. 200 when the database is reachable; 503 otherwise. Reports `checks.database` and `checks.redis`. |

## Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | `{ email, name, password }` → 201 `{ token, user }`. Password must satisfy the policy (min 8 chars, upper, lower, digit, symbol). |
| POST | `/auth/login` | `{ email, password }` → 200 `{ token, user }`. |
| POST | `/auth/github/exchange` | `{ code, redirect_uri }` → exchanges an OAuth code server-side. |
| POST | `/auth/google/exchange` | `{ code, redirect_uri }` or `{ credential }` (verified id_token via JWKS) → `{ token, user }`. |

Auth endpoints are rate-limited (`RATE_LIMIT_AUTH_MAX` per window, default 20/15min).

## Users

| Method | Path | Description |
| --- | --- | --- |
| GET | `/users/me` | Current profile. |
| PUT | `/users/me` | `{ name?, avatar? }` update. |

## Boards

Roles: `owner` > `editor` > `viewer`.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards` | member | Boards the user belongs to, newest first. |
| POST | `/boards` | any user | `{ title, description? }` → 201; creator becomes owner. |
| GET | `/boards/:id` | member | Board with `board_members`, `elements`, and `_count`. |
| PUT | `/boards/:id` | editor | `{ title?, description? }`. |
| DELETE | `/boards/:id` | owner | Deletes the board (and its stored files). |
| GET | `/boards/:id/members` | member | Members with user profiles. |
| POST | `/boards/:id/members` | owner | `{ userId, role: 'editor' \| 'viewer' }` → 201. |
| PUT | `/boards/:id/members/:userId` | owner | `{ role: 'owner' \| 'editor' \| 'viewer' }`. Last owner cannot be demoted (`LAST_OWNER` 409). |
| DELETE | `/boards/:id/members/:userId` | owner | Removes a member. An owner cannot remove themselves while they are the only owner (403). |

## Elements

An element is the fabric `BoardElement` wire format: `{ id, kind, x, y, width, height, rotation, scaleX?, scaleY?, fill, stroke, strokeWidth, content, version, … }`.
Coordinates are world-space, top-left origin. `version` is **server-owned**: it starts at 1 and every write increments it atomically; client-supplied values are ignored. Clients use it to discard out-of-order broadcasts.
`kind` ∈ `rect | circle | sticky | line | arrow | pen | text | image | document | comment`. Single-element payloads are capped at 200 KB; bulk syncs at 5000 elements.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/elements` | member | All elements, oldest first. |
| POST | `/boards/:boardId/elements` | editor | `{ element }` → 201 (upsert; an id owned by another board → 409). |
| PUT | `/boards/:boardId/elements/bulk` | editor | `{ elements: [...] }` — full reconciliation (creates, updates, deletes) in one transaction → `{ created, updated, removed }`. Broadcasts `board:restored`. Destructive for concurrent editors — the web client does not use it. |
| PUT | `/boards/:boardId/elements/:elementId` | editor | `{ element }` full replace. |
| PATCH | `/boards/:boardId/elements/:elementId` | editor | `{ patch }` merged atomically in Postgres (`jsonb ||`), so concurrent patches to different fields never overwrite each other; increments `version`. |
| DELETE | `/boards/:boardId/elements/:elementId` | editor | Removes the element. Comment threads pinned to it are un-pinned (they keep their x/y). Attachments stay on the board (so restoring a version keeps them working) and are removed with the document or the board. |

All element, comment, document and version writes made over REST are also broadcast to the board's socket room.

## Comments

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/comments` | member | Comments with author profiles. |
| POST | `/boards/:boardId/comments` | member | `{ content, element_id?, x?, y?, clientId? }` → 201. `x`/`y` are world coordinates; `clientId` is echoed in the `comment:created` broadcast so the author can swap out its optimistic copy. |
| PUT | `/boards/:boardId/comments/:commentId` | author | `{ content }`. |
| DELETE | `/boards/:boardId/comments/:commentId` | author or board owner | Removes the comment. |

## Versions

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/versions` | member | Timeline, newest first: `{ id, label, element_count, created_at, users }` — **metadata only**, no snapshot bodies. |
| POST | `/boards/:boardId/versions` | editor | `{ label? }` — snapshots current elements → 201. |
| GET | `/boards/:boardId/versions/:versionId` | member | A single snapshot (404 if it belongs to another board). |
| POST | `/boards/:boardId/versions/:versionId/restore` | owner | Saves a "Before restore" safety copy, then replaces the elements atomically → `{ board_id, version_id, restored_elements, elements }`. Broadcasts `board:restored` so every client swaps state in place (no reload, no disconnect). |

Snapshots are also taken automatically: after element writes settle for 30 s (at most every 3 min during continuous editing), labelled "Auto-save". A snapshot identical to the latest one is skipped, and each board keeps its newest 100 versions. JSONB snapshot bodies are TOAST-compressed by Postgres.

## Documents

Uploads are limited to 10 MB and an allowlist of MIME types (pdf, office, images, text).

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/documents` | member | Metadata, newest first. |
| POST | `/boards/:boardId/documents` | editor | `multipart/form-data`, field `file` (optional `elementId`) → 201. |
| GET | `/documents/:documentId` | member | Metadata. |
| GET | `/documents/:documentId/download` | member | Streams the bytes with `Content-Disposition: attachment` (RFC 5987 filename) and an immutable private cache header. |
| DELETE | `/documents/:documentId` | editor | Removes metadata and stored bytes, and strips the attachment from any element referencing it (broadcast as `element:updated`). |

PDF and image uploads must match their declared type's file signature (magic bytes).

## WebSocket events (socket.io, `/socket.io`)

Authenticated via `handshake.auth.token` (a token for a deleted user is rejected with `ERR_UNAUTHORIZED`). Heartbeat: 10 s ping, 8 s timeout.

Every mutating event takes an **acknowledgement callback** and replies `{ ok: true, element? }` or `{ ok: false, code, message }` with `code` ∈ `VALIDATION_ERROR | NOT_JOINED | FORBIDDEN | NOT_FOUND | CONFLICT | REJECTED | INTERNAL`. Payloads are validated with the same schemas as REST, and a socket must join a board before writing to it.

| Event (emit) | Payload | Ack | Broadcast to others |
| --- | --- | --- | --- |
| `board:join` | `{ boardId }` | `{ ok, role, users }` | `user:join` `{ id, userId, name }` |
| `board:leave` | `{ boardId }` | — | `user:leave` `{ id }` |
| `cursor:update` | `{ boardId, x, y, tool }` | — | `cursor:update` `{ id, userId, x, y, tool }` (volatile, ≤20 Hz) |
| `element:preview` | `{ boardId, id, x, y, rotation?, scaleX?, scaleY?, end? }` (center, world space) | — | `element:preview` (volatile, ≤30 Hz, never persisted) |
| `element:created` | `{ boardId, element }` | `{ ok, element }` | `element:created` `{ boardId, element, by }` |
| `element:updated` | `{ boardId, id, patch }` | `{ ok, element }` | `element:updated` `{ boardId, id, element, by }` — the full merged row |
| `element:removed` | `{ boardId, id }` | `{ ok }` (idempotent) | `element:removed` `{ boardId, id, by }` |
| `comment:created` | `{ boardId, content, element_id?, x?, y?, clientId? }` | `{ ok, comment }` | `comment:created` `{ boardId, comment, clientId }` |
| `comment:removed` | `{ boardId, id }` | `{ ok }` | `comment:removed` `{ boardId, id }` |

Server-initiated events: `board:restored` `{ boardId, versionId?, restoredBy, elements }`, `board:updated` `{ boardId, title?, description?, deleted? }`, `comment:updated` `{ boardId, comment }`, `version:created` `{ boardId, id }`.

Semantics:
- **Idempotent writes.** A replayed `element:created` returns the stored row unchanged, so it never overwrites newer edits. A replayed delete succeeds. Clients can safely resend after an ack timeout or a reconnect.
- **Ordering.** Clients keep at most one in-flight operation per element. Broadcasts carry the merged row and its `version`, and receivers drop anything older than what they already have.
- **Multi-instance.** With `REDIS_URL` set, the socket.io Redis adapter fans events out across API instances. Atomic jsonb patches make concurrent writers on different instances safe.
