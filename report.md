# VisualBoard — A Collaborative Virtual Whiteboard for Drawing, Architecture Design and Documentation

## 1. Abstract

VisualBoard is a full-stack, web-based collaborative whiteboard that provides an infinite canvas for drawing, brainstorming, and designing system architectures in real time. Conventional digital whiteboards become cluttered as content grows, offer little guidance while designing technical diagrams, and keep supporting documents detached from the actual work. VisualBoard addresses these gaps with three intelligent working modes: an Auto-Arrangement engine that reorganises a messy canvas into a clean, ordered layout; an AI-powered Architecture Suggestion system that reviews a board and recommends concrete improvements; and a Document Attachment system that keeps files tied to the exact step of the project on which they belong. The application is built as two independent codebases — a React 19 + Fabric.js frontend and a Node.js + Express 5 + Prisma backend backed by PostgreSQL, with Socket.IO powering real-time synchronisation. It supports secure authentication (JWT, bcrypt and OAuth), role-based access control (Owner, Editor, Viewer), comments, version history with one-click restore, and live multi-user cursors. The described system is fully integrated, covered by seventy-eight automated tests, and verified through a continuous-integration pipeline, making it a robust and scalable foundation for team collaboration.

## 2. Introduction

Modern teams think, plan, and design together, yet the tools they use are often fragmented. A designer sketches on one app, a developer documents the same idea in another, and the discussion about the design lives somewhere else entirely. As a result, context is lost and collaboration becomes inefficient.

VisualBoard was conceived to close that gap. It is a single, unified workspace where a team can open an infinite canvas, draw using a rich set of tools — rectangles, circles, lines, arrows, freehand pen, text, sticky notes, images, and documents — and collaborate on the same board at the same time, from different locations. Every change a user makes is broadcast instantly to everyone else, and each participant can see the live cursor position of the others.

What distinguishes VisualBoard from a conventional drawing application is its intent. It is not merely a place to draw; it is a place to *think*. Once the canvas is populated, the user can invoke Auto-Arrangement to transform random clutter into a structured diagram. While designing a software system, the user can request Architecture Suggestions and receive focused, actionable feedback. At any point, the user can attach documents so that the reasoning behind a diagram stays with it. Around all of this sits a professional security and collaboration layer: authentication, role-based permissions, threaded comments, version snapshots, and reliable persistence. The remainder of this report describes the objectives, the problem it solves, the architecture, the design and implementation, and the directions in which it can grow.

## 3. Objectives

The project is driven by five central objectives:

- **Interactive Canvas — to provide an intuitive infinite canvas for drawing, shapes, text, and architecture diagrams.** The foundation of the application is a responsive, unbounded workspace that never restricts the user. It supports freehand drawing, geometric shapes, editable text, sticky notes, and imported images, and it is designed so that sketching a system architecture feels as natural as drawing on paper. Smooth zooming, panning, and an optional grid make the canvas comfortable to work with at any scale.

- **Auto-Arrangement — to transform cluttered boards into structured and logically arranged layouts.** A board that starts clean rarely stays clean; as elements accumulate, the layout becomes scattered and difficult to read. This objective is met by a one-click mechanism that analyses every element and its relationships, then rearranges them into a logical, non-overlapping, grid-aligned layout, so that order can always be restored.

- **Architecture Assistance — to provide contextual suggestions while users design system architectures.** Drawing an architecture is only half the task; knowing whether it is complete, secure, and scalable is the harder half. This objective is met by having the platform examine the board's elements and discussion and offer relevant, expert-style suggestions that help the user improve the design as it is being created.

- **Contextual Documentation — to allow documents to be attached directly to relevant elements or stages of a project.** Important files — specifications, references, and notes — are usually stored away from the diagram they describe, and are consequently forgotten. This objective is met by allowing any form of document to be attached to any board or element at any stage, so that supporting material remains permanently tied to the step it belongs to and nothing is lost.

- **Real-Time Collaboration — to enable multiple users to work together with role-based access, live synchronization, comments, and version history.** This objective is met by synchronising every change instantly across all participants through Socket.IO, enforcing Owner, Editor, and Viewer roles on every operation, and providing threaded comments and snapshot-based version history so that a team can collaborate safely and recover any previous state.

In addition to these primary objectives, the project also aims to maintain a clean and layered backend architecture, a reusable and scalable frontend, and a secure, well-validated API surface.

## 4. Literature Review

The design of VisualBoard draws on recent research in collaborative systems, graph layout, and AI-assisted architecture. The table below lists the research papers referred to for this project — all published in IEEE venues in 2023 or later — and records how each one informed the final system.

| Sr. No. | Reference (Authors, Title, IEEE Source, Year) | Focus Area | Key Contribution and Relevance to VisualBoard |
|---|---|---|---|
| 1 | P. Ishola and R. Mailler, "Hybrid WebRTC-WebSocket Communication and Adaptive State Synchronization for Scalable Real-Time 3D Collaborative Whiteboard," in *Proc. IEEE Int. Conf. on Information and Communication Systems (ICICS)*, 2025. | Real-time transport and synchronization | Combines WebSocket-style transport with adaptive state synchronization for a collaborative whiteboard; directly supports VisualBoard's Socket.IO room broadcast and incremental state-sync model. |
| 2 | E. Santana de Almeida, I. Ahmed, and A. van der Hoek, "Let's Go to the Whiteboard (Again): Perceptions from Software Architects on Whiteboard Architecture Meetings," *IEEE Transactions on Software Engineering*, vol. 49, no. 10, pp. 4773–4795, 2023. | Whiteboarding for architecture | Shows that the whiteboard is central to software-architecture work and that digital whiteboards are increasingly used; justified the Architecture Assistance and Contextual Documentation features. |
| 3 | J. Jahić and A. Sami, "State of Practice: LLMs in Software Engineering and Software Architecture," in *Proc. IEEE 21st Int. Conf. on Software Architecture Companion (ICSA-C)*, 2024, pp. 311–318. | LLMs in software architecture | Surveys the practical adoption of LLMs for architecture tasks; grounds VisualBoard's Groq/Llama suggestion pipeline. |
| 4 | R. Dhar, K. Vaidhyanathan, and V. Varma, "Can LLMs Generate Architectural Design Decisions? — An Exploratory Empirical Study," in *Proc. IEEE 21st Int. Conf. on Software Architecture (ICSA)*, 2024, pp. 79–89. | LLM-generated design decisions | Demonstrates that LLMs can produce useful architectural reasoning; reinforced the design of the AI review and suggestion output. |
| 5 | F. Zhong, M. Xue, J. Zhang, F. Zhang, R. Ban, O. Deussen, and Y. Wang, "Force-Directed Graph Layouts Revisited: A New Force Based on the T-Distribution," *IEEE Transactions on Visualization and Computer Graphics*, 2023. | Force-directed graph layout | Proposes a smoother, more stable force model for graph layout; informs the repulsion and settling behaviour of VisualBoard's Auto-Arrangement algorithm. |

**Findings.** The review confirmed three insights that directly influenced VisualBoard's design. First, low-latency and reliable real-time synchronisation is the foundation of any collaborative canvas, so the transport and state-sync layer was treated as core rather than incidental. Second, automatic layout and AI-assisted review are genuinely valuable but must remain deterministic and transparent so users trust them. Third, a layered, validation-first backend dramatically simplifies maintenance and security. These findings justified the project's central premise: a whiteboard becomes far more useful when drawing, organisation, intelligence, and documentation are unified into one workspace.

## 5. Problem Definition

**Problem identification in the current scenario.** Although a large number of digital whiteboard and diagramming tools exist, they consistently fall short in three specific, clearly observable ways.

1. **Canvases become disorganised as content grows.** When users sketch freely, elements are placed wherever the cursor happens to be. Within minutes a board fills with overlapping shapes, crooked connectors, and scattered notes. Manually tidying such a board is slow and tedious, and users frequently abandon a board once it becomes unreadable rather than invest time in rearranging it. Existing tools offer alignment or grouping, but these require the user to select and arrange items by hand and provide no holistic, one-action restructuring of the entire canvas.

2. **Architecture designers receive no structured guidance.** A developer or architect sketching a system has no feedback on whether the design is missing a component, ignores a security concern, or will not scale. Reviews of system architecture are normally performed manually by a senior engineer, often long after the diagram is drawn and after mistakes have solidified. There is no widely available, low-friction mechanism that reviews a diagram *while it is being designed* and offers improvement suggestions in context.

3. **Supporting documents are separated from the work they describe.** Specifications, reference images, and requirement files typically live in a separate drive or chat thread from the diagram they relate to. When a board is revisited weeks later, the reasoning and the source material are gone, forcing users to reconstruct context or hunt for files. Current whiteboards treat files as a separate upload area rather than as context anchored to a specific element or step.

**Consequence.** The combined effect is that teams spend disproportionate effort on maintenance and rework, lose design context over time, and produce designs that are less complete and less thoughtfully reviewed than they could be.

**Problem statement.** *There is a need for a single, secure, real-time collaborative whiteboard that not only allows free drawing but also automatically organises the canvas, intelligently assists the design of system architectures, and keeps every supporting document permanently attached to the step of the project it belongs to.*

## 6. Proposed System Architecture / Working

VisualBoard follows a classic three-tier client–server architecture with an additional real-time communication channel. The system is deliberately split into two independently deployable codebases so that the UI and the data layer can scale and evolve separately.

### 6.1 High-Level Architecture

```
        +----------------------------------------------+
        |            Frontend (React SPA)              |
        |  Fabric.js canvas · Zustand stores · UI      |
        +----------------------+-----------------------+
                               |
             REST (HTTP/JSON)  |  WebSocket (Socket.IO)
                               v
        +----------------------+-----------------------+
        |             Backend API (Node.js)            |
        |   Express 5 (REST)  +  Socket.IO (real-time)  |
        |   Auth · RBAC · Validation (Zod) · Storage    |
        +---------+--------------------------+----------+
                  |                          |
         +--------v---------+       +--------v---------+
         |   PostgreSQL     |       |      Redis       |
         |   (Prisma ORM)   |       | cache / pub-sub  |
         +------------------+       +------------------+
                  |
         +--------v-----------------------+
         |  Document Store (local / S3)   |
         +--------------------------------+
```

- **Frontend → Backend (REST):** authentication, board and membership management, element and version operations, comments, documents, and AI suggestions.
- **Frontend ↔ Backend (Socket.IO):** live drawing synchronisation, cursor sharing, and presence.
- **Backend → PostgreSQL:** all durable state, accessed through Prisma.
- **Backend → Redis:** optional caching and multi-instance real-time coordination, with graceful degradation when unavailable.
- **Backend → Document Store:** uploaded files, abstracted behind a storage interface that supports local disk or S3.

### 6.2 Working of the System

1. **Authentication.** A user registers or logs in. The backend hashes the password with bcrypt and issues a signed JWT. The token is attached to every subsequent REST request and to the Socket.IO handshake. GitHub and Google OAuth are also supported through server-side code exchange.

2. **Board lifecycle.** The user creates a board and becomes its Owner. Members can be invited by email and assigned one of three roles — Owner, Editor, or Viewer. Every operation, on both REST and WebSocket channels, is checked against these roles before it is allowed.

3. **Drawing and persistence.** As the user draws with any of the twelve tools, each element is represented as a serialisable object. Changes are saved to PostgreSQL through a debounced autosave and an efficient bulk-sync endpoint, so the canvas survives a page reload.

4. **Real-time collaboration.** On opening a board, the client joins a Socket.IO room named after the board. Mutations and cursor updates are broadcast only within that room. Cursor traffic is throttled to twenty updates per second per socket, and every mutation is persisted before it is broadcast, so the database always reflects the true state.

5. **Auto-Arrangement.** When invoked, the backend extracts relationships between elements, clusters connected elements using a union-find algorithm, applies a force-directed layout within each cluster, resolves overlaps, snaps everything to a twenty-pixel grid, and finally arranges the clusters in a neat canvas flow. The new positions are persisted and returned to all clients.

6. **Architecture Suggestions.** The backend assembles the board's title, description, elements, and recent comments into a structured prompt and sends it to an LLM service (Groq, hosting Llama-family models). The model returns a JSON array of suggestions, each with a title, detail, category, and priority. The result is validated and delivered to the suggestions panel in the UI.

7. **Documents.** A file is uploaded via multipart form data, validated for size and MIME type, and stored through the storage abstraction. Its metadata is linked to the board and, optionally, to a specific element, so it remains anchored to its context.

8. **Version history.** A snapshot of all current elements is stored as JSON. Restoring a version is fully transactional: a safety snapshot is taken first, current elements are removed, and the snapshot is reinstated — all or nothing — so a failed restore can never corrupt a board.

## 7. Design and Implementation

### 7.1 Design of the Project Model

The project model is defined by a normalised relational schema managed through Prisma, with a clear hierarchy in which a user owns boards, and each board contains members, elements, versions, comments, and documents.

| Model | Purpose | Key Fields |
|---|---|---|
| `users` | Authentication and profile | id, name, email (unique), password (hashed), avatar, provider |
| `boards` | A whiteboard session | id, title, description, owner_id |
| `board_members` | Role-based access | user_id, board_id, role (owner / editor / viewer) |
| `elements` | Every shape or drawing on the board | id (string), board_id, element_data (JSON) |
| `versions` | Snapshot history and rollback | id, board_id, snapshot (JSON), created_by |
| `comments` | Collaborative discussion | id, board_id, user_id, content, x/y, element_id |
| `documents` | Attached files | id, board_id, element_id, stored_name, mime_type, size |

Relationships are enforced with foreign keys and cascading deletes, and indexes are placed on all foreign-key columns for query performance. A compound unique constraint on `(user_id, board_id)` prevents duplicate memberships. The element itself is stored as JSON, which keeps the schema stable even as new drawing tool kinds are introduced.

The backend is organised into feature modules, each containing a consistent set of files:

```
backend/src/
├── modules/
│   ├── auth/         register, login, JWT issue and verify, OAuth
│   ├── user/         profile management
│   ├── board/        CRUD, membership, and auto-arrangement
│   ├── element/      element CRUD and bulk sync
│   ├── comment/      board-level comments
│   ├── document/     upload, download, deletion
│   ├── version/      snapshot creation, listing, restore
│   ├── suggestions/  AI review pipeline
│   ├── socket/       real-time events and broadcasting
│   └── health/       liveness and readiness probes
├── config/           Prisma, database, Redis, environment
├── middleware/       auth, error handling, rate limiting, request IDs
├── services/         RBAC and storage abstraction
├── utils/            hashing, JWT, IDs, logging, responses
└── constants/        messages, roles, route names
```

Each module follows the same internal pattern — `route → controller → service → Prisma model` — with Zod validation applied at the request boundary. Environment variables are validated on startup with a schema, so a misconfigured server fails loudly rather than becoming insecure.

The frontend likewise follows a layered design. Zustand stores hold separated concerns (authentication, board, canvas, presence, tools, suggestions, theme, and UI), an API layer wraps Axios calls, a realtime service encapsulates Socket.IO, and the canvas is driven by Fabric.js. Key screens include the landing page, dashboard, authentication pages, and the board workspace, which composes the toolbar, canvas stage, right panel, version timeline, cursors overlay, and status bar.

### 7.2 Implementation

**Authentication and security.** Passwords are hashed using bcrypt with ten salt rounds. JWTs are signed with a secret that must be at least thirty-two characters. Security headers are applied with Helmet, CORS is restricted to an allowlist, and rate limiting protects authentication and write endpoints. All user input is validated with Zod, uploaded filenames are sanitised, and path-traversal is prevented in the storage layer.

**The element model.** Every object on the canvas is stored in a standard wire format:

```
{ id, kind, x, y, width, height, rotation, fill, stroke,
  strokeWidth, content, version, ... }
```

where `kind` is one of `rect | circle | sticky | line | arrow | pen | text | image | document | comment`. This uniform shape is what allows features such as bulk synchronisation, versioning, and auto-arrangement to work generically across all tools.

**Auto-Arrangement algorithm.** The core of the arrangement service is a compact but effective sequence: connections are extracted from arrows, lines, and explicit relationships; connected components are found with union-find; small clusters receive a simple grid layout while larger clusters are laid out with an iterative force simulation using repulsion, attraction, and damping; overlaps are then resolved by iterative separation; and finally all coordinates are snapped to a twenty-pixel grid and clusters tiled across the canvas. Because the algorithm is deterministic, the same board always arranges to the same result, which users learn to trust.

**AI Suggestions pipeline.** The board context is loaded (up to eighty elements, twenty recent comments, and member count), reduced to a compact textual representation, and sent with a carefully worded system prompt that instructs the model to return only valid JSON with a defined shape. The response is defensively parsed — markdown fences are stripped, categories and priorities are validated against allowlists, and fields are truncated to safe lengths. A twenty-five-second timeout and graceful error handling ensure a slow AI service never degrades the rest of the application.

**Real-time layer.** Socket.IO connections are authenticated during the handshake, board membership is verified before a room is joined, and every mutation event re-checks the user's role. Viewers are blocked at the socket level from any mutating event, and element deletion also cleans up any associated stored files. Cursor updates are capped at twenty hertz to protect the server from flooding.

**Testing and continuous integration.** The system is covered by seventy-eight backend tests (forty-three integration and thirty-five unit) plus frontend unit, component, and Playwright end-to-end tests. A GitHub Actions pipeline runs linting, type-checking, unit tests, a production build, and the end-to-end suite on every push and pull request, against real PostgreSQL and Redis service containers.

### 7.3 Project Snapshots (to be inserted)

The following screenshots should be captured from a running instance and inserted here, each with a one-line caption:

1. **Landing page** — the hero, feature, and modes sections of the home page.
2. **Dashboard** — the list of boards belonging to the logged-in user, including the empty state and the "Create Board" action.
3. **The board workspace** — the infinite canvas with the toolbar, right panel, and status bar visible.
4. **Drawing in action** — a populated canvas showing rectangles, circles, arrows, sticky notes, and text.
5. **Real-time collaboration** — two browser windows showing the same board with distinct live cursors and presence indicators.
6. **Auto-Arrangement before and after** — a side-by-side pair demonstrating the clean, organised result.
7. **Architecture Suggestions panel** — a list of AI-generated suggestions with categories and priorities.
8. **Version history timeline** — previous snapshots with the restore action available.
9. **Comments on the canvas** — an orange comment marker with its discussion thread open.
10. **Document attachment** — a document card on the canvas with a preview and download action.
11. **CI pipeline** — the green GitHub Actions run showing all jobs passing.

## 8. Contribution

This project is an original work by the author and is published as an open-source repository on GitHub:

- **Repository:** `https://github.com/PS8760/VisualBoard`
- **License:** ISC (as declared in `package.json`)

The complete source — the React frontend, the Node.js backend, the Prisma schema and migrations, the test suites, and the documentation — is made publicly available so that other students and developers can study, reuse, and extend it. Because no dedicated `LICENSE` file currently exists in the repository root, a formal `LICENSE` file containing the ISC text should be added before publication to make the licensing unambiguous.

**Community contribution.** The project has been structured to be contributor-friendly: it includes a continuous-integration pipeline that validates every pull request, a seeded demo database for quick onboarding, an API reference under `docs/`, and consistent code style enforced by linting. This lowers the barrier for external contributions such as new drawing tools, additional AI providers, or new layout strategies.

**Diagramming contribution.** All architecture diagrams in this report — the system architecture, the entity-relationship diagram of the database, the module breakdown, and the sequence diagrams for real-time events — were produced using **Dia**, a free and open-source diagramming application. Dia is itself an open-source project distributed under the GNU General Public License, and it is well suited to software documentation because it offers shape libraries for UML, ER, and network diagrams. Using an open-source tool to document an open-source project keeps the entire workflow within the open-source ecosystem, and the original `.dia` source files can be shared alongside the exported images so that others may edit them.

## 9. Conclusion

VisualBoard demonstrates that a whiteboard can be far more than a surface for drawing. By unifying free-hand sketching, automatic organisation, intelligent architecture review, document attachment, real-time collaboration, and version control into a single, secure application, it addresses three genuine shortcomings of existing tools. The system is built on a modern, well-established stack — React 19 and Fabric.js on the frontend, and Node.js, Express 5, Prisma, PostgreSQL, Redis, and Socket.IO on the backend — and its behaviour is verified by a comprehensive automated test suite running inside a continuous-integration pipeline. Each of the objectives set out at the start of the project has been met: the canvas is genuinely interactive, auto-arrangement restructures a board in a single action, architecture suggestions are produced on demand, documents remain anchored to their context, and collaboration is live and role-aware.

The result is a production-ready application that is stable, secure, and pleasant to use, and that provides a solid foundation for teams, architects, designers, and students to think, sketch, and collaborate in real time. The project also demonstrates a disciplined approach to engineering: a layered backend, consistent validation at every boundary, careful handling of concurrency and failure, and security enforced uniformly across both the REST and real-time channels. More importantly, it shows how thoughtful design decisions, rather than sheer number of features, transform a simple canvas into a genuinely useful workspace, and it leaves a clean, extensible base on which the ideas outlined in the future scope can be built.

## 10. Future Scope

The current implementation is complete and production-ready, but several natural extensions would broaden its usefulness. These are grouped below.

- **Export and import.** Exporting boards to PDF, PNG, and SVG, and importing from tools such as Figma and Miro, would ease adoption and integration into existing workflows.
- **Richer diagramming tools.** Adding triangles, stars, polygons, auto-routing connectors, grouping, alignment and distribution tools, layers, rulers, and guides would move the application closer to professional diagramming software.
- **Deeper AI capabilities.** Training or fine-tuning a model on real architecture datasets, supporting multiple AI providers, and performing real-time analysis as the user draws would make the suggestions more contextual and proactive.
- **Template library.** Pre-built templates for flowcharts, wireframes, mind maps, and common architecture patterns would help new users begin quickly.
- **Mobile and touch support.** Pinch-to-zoom, two-finger panning, and touch-optimised selection handles would make the whiteboard practical on tablets and phones.
- **Offline-first synchronisation.** Allowing users to work without a connection and synchronise automatically once reconnected would improve reliability in low-bandwidth environments.
- **Enterprise features.** Single sign-on (SAML/LDAP), organisation workspaces, activity audit logs, usage analytics, view-only share links, and granular permissions would make the platform suitable for larger organisations.
- **Enhanced document integration.** In-browser previews, full-text indexing, and search across attached documents would turn the attachment feature into a genuine knowledge base.
- **Performance at scale.** Testing and optimising for several hundred simultaneous elements and cursors, and refining the Redis-backed multi-instance deployment, would support larger collaborative sessions.

## 11. References

[1] P. Ishola and R. Mailler, "Hybrid WebRTC-WebSocket Communication and Adaptive State Synchronization for Scalable Real-Time 3D Collaborative Whiteboard," in *Proc. Int. Conf. on Information and Communication Systems (ICICS)*, 2025, doi: 10.1109/ICICS65354.2025.11072969.

[2] E. Santana de Almeida, I. Ahmed, and A. van der Hoek, "Let's Go to the Whiteboard (Again): Perceptions from Software Architects on Whiteboard Architecture Meetings," *IEEE Transactions on Software Engineering*, vol. 49, no. 10, pp. 4773–4795, Oct. 2023.

[3] J. Jahić and A. Sami, "State of Practice: LLMs in Software Engineering and Software Architecture," in *Proc. IEEE 21st Int. Conf. on Software Architecture Companion (ICSA-C)*, Hyderabad, India, 2024, pp. 311–318, doi: 10.1109/ICSA-C63560.2024.00059.

[4] R. Dhar, K. Vaidhyanathan, and V. Varma, "Can LLMs Generate Architectural Design Decisions? — An Exploratory Empirical Study," in *Proc. IEEE 21st Int. Conf. on Software Architecture (ICSA)*, Hyderabad, India, 2024, pp. 79–89, doi: 10.1109/ICSA59870.2024.00016.

[5] F. Zhong, M. Xue, J. Zhang, F. Zhang, R. Ban, O. Deussen, and Y. Wang, "Force-Directed Graph Layouts Revisited: A New Force Based on the T-Distribution," *IEEE Transactions on Visualization and Computer Graphics*, 2023, doi: 10.1109/TVCG.2023.3238821.
