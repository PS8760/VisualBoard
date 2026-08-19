# VisualBoard — Virtual Whiteboard

## Presentation Deck Content

---

## Slide 1 — Title

> **VisualBoard**
>
> *A Collaborative Virtual Whiteboard for Drawing, Architecture Design, and Documentation*
>
> **Author:** Pranav Umesh Ghodke
>
> (Visual WhiteBoard — Backend + Frontend Project)

---

## Slide 2 — Agenda

1. Introduction & Overview
2. Problem Statement
3. Scope
4. Objectives
5. Core Features (The 3 Modes)
6. Technology Stack
7. System Architecture
8. Database Design
9. Module Breakdown
10. User Workflow
11. Future Scope & Enhancements
12. Conclusion

---

## Slide 3 — Introduction & Overview

- **VisualBoard** is a web-based virtual whiteboard that lets users draw anything they want on an infinite canvas.
- It is a **full-stack application** split into two codebases:
  - **`frontend/`** — React-based interactive whiteboard UI.
  - **`backend/`** — REST + real-time API and data layer.
- Built for teams, designers, developers, and creators to think, sketch, and collaborate in real time.
- The product goes beyond a normal drawing board by adding **three intelligent working modes** (see Slide 7).

---

## Slide 4 — Problem Statement

- Traditional whiteboards and static drawing tools leave the canvas **disorganised** as content grows.
- People designing **system architectures** struggle to get structured suggestions while sketching.
- Important context such as **documents, files, and notes** is stored separately from the diagram, so it gets lost.
- Most tools focus only on "drawing", not on **organisation, intelligence, and documentation**.

**VisualBoard solves these three problems with three dedicated modes.**

---

## Slide 5 — Scope

### In Scope
- Interactive drawing whiteboard with shapes, freehand, and elements.
- **Mode 1 — Auto-Arrangement:** automatically arranges every element on the board into a clean, ordered layout.
- **Mode 2 — Architecture Suggestions:** intelligent suggestions while a user designs a system architecture.
- **Mode 3 — Document Attachment:** attach any form of document at any step of the project/board.
- Multi-user boards with role-based access (owner / editor / viewer).
- Element-level persistence and snapshot-based **version history**.
- Collaborative comments on boards.
- User authentication (register / login) with JWT.
- Real-time collaboration via WebSockets (Socket.IO).

### Out of Scope (for now)
- Offline-first sync and mobile native apps.
- AI model training — suggestions will be rule/API driven initially.
- Multi-player presence with voice/video.

---

## Slide 6 — Objectives

### Primary
1. Provide a smooth, real-time drawing experience on a virtual whiteboard.
2. Keep the board organised at all times — any cluttered canvas can be transformed into a clean, logical order with a single action.
3. Support structured thinking — when a user designs a system architecture, the platform offers relevant suggestions to guide and improve the design.
4. Keep all context together — documents can be attached at any step of the work and stay tied to that step, so nothing is lost.
5. Enable **multi-user collaboration** with live sync and role-based access.
6. Preserve every stage of work through **version snapshots** and enable rollback.

### Secondary
- Clean, maintainable, layered backend (controllers → services → routes → Prisma models).
- Reusable, scalable frontend architecture (React + Zustand + Fabric.js).
- Secure APIs with JWT authentication and input validation (Zod).

---

## Slide 7 — Core Features: The 3 Modes

### Mode 1 — Auto-Arrangement
- Every single element present on the whiteboard gets arranged in an ordered, structured layout.
- Useful when a board becomes crowded or unstructured.
- Reduces manual dragging and aligning.

### Mode 2 — Architecture Suggestions
- If a user is designing any system architecture, the system gives **relevant suggestions**.
- Helpful for developers and architects to follow patterns and best practices while drawing.

### Mode 3 — Document Attachment
- The user can **attach any form of document** at any step of his project.
- Documents stay associated with that specific step on the board, so context is never lost.

---

## Slide 8 — Technology Stack

### Frontend (`frontend/`)
- **React 19** + **TypeScript** + **Vite**
- **Fabric.js** — canvas whiteboard rendering
- **Tailwind CSS 4** — styling
- **Framer Motion** — animations
- **React Router DOM** — routing
- **Zustand** — state management
- **Socket.IO Client** — real-time updates
- **Axios** — HTTP client

### Backend (`backend/`)
- **Node.js** + **Express 5** + **TypeScript**
- **Prisma ORM** with **PostgreSQL**
- **Socket.IO** — WebSocket real-time layer
- **Redis** — caching / real-time coordination
- **JWT (jsonwebtoken)** + **bcrypt** — authentication & password hashing
- **Zod** — input validation
- **Helmet** — security headers
- **Morgan** — request logging
- **CORS** — cross-origin support

---

## Slide 9 — System Architecture

```
                    +---------------------------+
                    |    Frontend (React SPA)   |
                    |  Fabric.js whiteboard UI  |
                    +-------------+-------------+
                                  |
                     HTTP (REST)  |   WebSocket (Socket.IO)
                                  v
                    +-------------+-------------+
                    |        Backend API        |
                    |   Express + Socket.IO     |
                    +------+----------+---------+
                           |          |
                    +------v--+   +---v-------+
                    |  Redis  |   | PostgreSQL|
                    |  cache/ |   | Prisma    |
                    |  real-  |   | models    |
                    |  time   |   |           |
                    +---------+   +-----------+
```

- **Frontend → Backend:** REST endpoints for auth, boards, elements, comments, versions, users.
- **Frontend ↔ Backend:** Socket.IO events for live drawing sync and collaboration.
- **Backend → DB:** Prisma client (with pg adapter) talking to PostgreSQL.
- **Backend → Redis:** used for caching / real-time coordination.

---

## Slide 10 — Database Design (Prisma Models)

| Model | Purpose | Key Fields |
|---|---|---|
| `users` | Authentication & profile | id, name, email (unique), password (hashed), avatar |
| `boards` | Whiteboard sessions | id, title, description, owner_id |
| `board_members` | Role-based access (owner/editor/viewer) | user_id, board_id, role |
| `elements` | Every shape/drawing on the board | id, board_id, element_data (JSON) |
| `versions` | Snapshot history & rollback | id, board_id, snapshot (JSON), created_by |
| `comments` | Collaborative discussion | id, board_id, user_id, content |

**Relationships:**
- A user owns many boards; boards have many members.
- A board has many elements, versions, and comments.
- Version snapshots store the full board state as JSON for rollback.

---

## Slide 11 — Module Breakdown

### Backend Modules (`backend/src/modules/`)
| Module | Responsibility |
|---|---|
| `auth` | Register, login, JWT issue & verification |
| `user` | User profile management |
| `board` | Create/read/update/delete boards, membership |
| `element` | CRUD of drawing elements (element_data JSON) |
| `version` | Snapshot creation, history, rollback |
| `comment` | Board-level comments |
| `socket` | Real-time event handling & broadcast |
| `health` | Server & database health checks |

### Supporting Layer
- `config/` — Prisma client, DB, Redis configuration
- `middleware/` — Auth (JWT) and error-handling middleware
- `utils/` — hashing, JWT helpers, logging
- `constants/` — messages, roles, route names
- `types/` — shared TypeScript types

### Frontend Pages (`frontend/src/pages/Home/`)
- Hero, Navbar, Features, Collaboration, CTA, Testimonials, Footer
- Routes planned: `/`, `/login`, `/register`, `/board/:id`

---

## Slide 12 — User Workflow

1. **Sign up / Log in** → user is authenticated with JWT.
2. **Create or open a board** → whiteboard canvas loads.
3. **Draw freely** using the canvas tools (shapes, freehand, elements).
4. **Mode 1:** hit auto-arrange → all elements are reorganised into an ordered layout.
5. **Mode 2:** when designing a system architecture, receive smart suggestions as you draw.
6. **Mode 3:** attach documents at any step of the project — they stay linked to that step.
7. **Collaborate:** teammates join the board, add comments, and draw in real time.
8. **Version control:** snapshots are saved; any previous state can be restored.

---

## Slide 13 — Future Scope & Enhancements

- AI/ML-powered architecture suggestions (learn from user designs).
- Voice/video collaboration and richer presence (cursors, avatars).
- Export boards to PDF, PNG, and diagram formats.
- Offline mode with automatic sync when back online.
- Template library for common architecture & flow diagrams.
- Advanced role/permission policies and organisation workspaces.
- Deeper document integration (image previews, file indexing, search).

---

## Slide 14 — Conclusion

- **VisualBoard** is a full-stack collaborative whiteboard that goes beyond drawing.
- Its three modes — **Auto-Arrangement**, **Architecture Suggestions**, and **Document Attachment** — turn a blank canvas into a structured, intelligent workspace.
- Built on a solid, scalable stack: **React + Fabric.js** on the frontend and **Express + Prisma + PostgreSQL + Socket.IO + Redis** on the backend.
- A strong foundation for teams, architects, designers, and creators to **think, sketch, and collaborate in real time**.

---

> **Thank You**
>
> *VisualBoard — Think. Sketch. Collaborate. In Real Time.*
