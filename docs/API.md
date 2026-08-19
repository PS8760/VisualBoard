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

An element is the fabric `BoardElement` wire format: `{ id, kind, x, y, width, height, rotation, fill, stroke, strokeWidth, content, version, … }`.
`kind` ∈ `rect | circle | sticky | line | arrow | pen | text | image | document | comment`. Single-element payloads are capped at 200 KB; bulk syncs at 5000 elements.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/elements` | member | All elements, oldest first. |
| POST | `/boards/:boardId/elements` | editor | `{ element }` → 201. |
| PUT | `/boards/:boardId/elements/bulk` | editor | `{ elements: [...] }` — full reconciliation (creates, updates, deletes) in one transaction → `{ created, updated, removed }`. |
| PUT | `/boards/:boardId/elements/:elementId` | editor | `{ element }` full replace. |
| PATCH | `/boards/:boardId/elements/:elementId` | editor | `{ patch }` merge; validated against the element schema; auto-increments `version`. |
| DELETE | `/boards/:boardId/elements/:elementId` | editor | Removes the element and its stored attachment files. |

## Comments

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/comments` | member | Comments with author profiles. |
| POST | `/boards/:boardId/comments` | member | `{ content, element_id?, x?, y? }` → 201. |
| PUT | `/boards/:boardId/comments/:commentId` | author | `{ content }`. |
| DELETE | `/boards/:boardId/comments/:commentId` | author or board owner | Removes the comment. |

## Versions

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/versions` | member | Snapshots with author (`users`). |
| POST | `/boards/:boardId/versions` | editor | `{ label? }` — snapshots current elements → 201. |
| GET | `/boards/:boardId/versions/:versionId` | member | A single snapshot. |
| POST | `/boards/:boardId/versions/:versionId/restore` | editor | Restores the snapshot atomically → `{ board_id, restored_elements }`. |

## Documents

Uploads are limited to 10 MB and an allowlist of MIME types (pdf, office, images, text).

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/boards/:boardId/documents` | member | Metadata, newest first. |
| POST | `/boards/:boardId/documents` | editor | `multipart/form-data`, field `file` (optional `elementId`) → 201. |
| GET | `/documents/:documentId` | member | Metadata. |
| GET | `/documents/:documentId/download` | member | File bytes with `Content-Disposition: attachment`. |
| DELETE | `/documents/:documentId` | editor | Removes metadata and stored bytes. |

## WebSocket events (socket.io, `/socket.io`)

Authenticated via `handshake.auth.token`.

| Event (emit) | Payload | Event (receive) | Payload |
| --- | --- | --- | --- |
| `board:join` | `{ boardId }` | `board:users`, `user:join`, `error` | presence snapshot / join / denial |
| `board:leave` | `{ boardId }` | `user:leave` | `{ id }` |
| `cursor:update` | `{ boardId, x, y, tool }` | `cursor:update` (relayed, ≤20 Hz per socket) | `{ id, userId, x, y, tool }` |
| `element:created` | `{ boardId, element }` | `element:created` broadcast | `{ boardId, element }` |
| `element:updated` | `{ boardId, id, patch }` | `element:updated` broadcast | `{ boardId, id, patch }` |
| `element:removed` | `{ boardId, id }` | `element:removed` broadcast | `{ boardId, id }` |
| `comment:created` | `{ boardId, content, element_id?, x?, y? }` | `comment:created` broadcast | `{ boardId, comment }` |
| `error` | — | `error` | `{ message }` |

RBAC is enforced server-side for every socket mutation. The REST API is the source of truth for persistence; socket mutations persist to the database before broadcasting.
