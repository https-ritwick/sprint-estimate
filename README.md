# EXL Sprint Estimate

A real-time, enterprise-grade **sprint estimation** tool for agile teams, built
for internal EXL usage. Sprint Estimate is a planning-poker-style estimation
tool: teams join a shared session, estimate backlog stories with a configurable
card deck, reveal estimates together, and finalize story points — all in real
time over WebSockets, with **no database required**.

---

## Overview

An **Admin** (the session creator) sets up an estimation session, configures it
(deck type, estimation rules, timer, velocity), and invites the team via a share
link. There are **no roles** — participants simply join with their name, corporate
ID, and team/department. The Admin is tracked internally as the creator and is the
only one who can manage the session.

Participants estimate the active story. When everyone has estimated (or the Admin
reveals manually, or a timer elapses), the cards reveal together and the tool
computes the average, median, range, agreement level, and a suggested estimate.
The Admin finalizes a value and moves to the next story. A full activity log and a
session summary with CSV/JSON export round out the workflow.

Sessions are **never terminated automatically**. They survive every disconnect —
including the Admin's — and end only when the Admin explicitly clicks **End
session**. A single Admin can run **many independent sessions at once**.

The application is intentionally **stateless on disk**: all sessions live in
server memory for the lifetime of the grooming meeting.

---

## Features

- **No roles.** Users enter only a name, corporate ID, and team. The session
  creator is the Admin; everyone else is a participant.
- **Admin leave & rejoin.** If the Admin leaves, the session keeps running with
  all stories, estimates, logs, timer and settings intact. Rejoining with the
  same corporate ID restores Admin controls automatically.
- **Explicit end only.** A session ends solely when the Admin ends it (with a
  confirmation modal) — never on a disconnect.
- **Multiple concurrent sessions** per Admin, each with its own id, invite link,
  participants, stories, estimates, logs, timer and settings.
- **Four card decks** — Fibonacci, Modified Fibonacci, T-Shirt Sizes, Powers of 2;
  chosen at session creation.
- **Estimate-aware card colors** — low values render green, medium amber/orange,
  high red, and neutral cards (`?`, `Pass`) stay neutral. Colors adapt to the deck.
- **"Will the Admin estimate?" toggle** — the Admin can estimate alongside the
  team or manage the session only.
- **Smooth, synced story timer** — the Admin can start / pause / resume / reset.
  The countdown updates every second on all clients, stays in sync via the server,
  and shows the correct remaining time even for participants who join mid-timer.
  When it reaches zero it stops, and (if enabled) auto-reveals the estimates.
- **Real-time activity log** — joins, leaves, Admin-left, Admin-rejoined,
  estimates, estimate changes, reveals, resets, finalizations, participant
  removals, story changes, timer events, and session end — each stamped with
  timestamp, user name, and corporate ID.
- **CSV story import** from the creation page or inside the room, plus manual entry.
- **Remove participant** — the Admin can disconnect any participant; their
  estimates are cleared, an activity entry is logged, and they're redirected out.
- **Auto-reveal** — optionally reveal automatically once everyone eligible has
  estimated.
- **Session summary & export** — headline stats, per-story estimates, full
  activity log, and one-click JSON / CSV export.
- **Professional UI** — EXL orange-and-white theme, corporate navbar, info pages,
  empty/loading states, confirmation modals, toasts, and responsive layouts.

---

## Tech Stack

**Backend**
- Python 3.11+
- FastAPI (REST + WebSocket)
- Uvicorn (ASGI server)
- Pydantic v2 (request validation)
- In-memory store (no database)

**Frontend**
- Angular 17 (standalone components, new control-flow, signals)
- TypeScript
- RxJS
- Native WebSocket client
- Plain CSS with CSS custom properties for theming

---

## Folder Structure

```
sprint-estimate/                  (a.k.a. planning-poker/ — the project root)
├── README.md
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── models.py             # Dataclasses, decks, Pydantic requests (no roles)
│       ├── store.py              # In-memory room store + business logic
│       ├── analysis.py           # Estimate analysis (average/median/consensus/etc.)
│       ├── connection_manager.py # WebSocket connection registry
│       └── main.py               # FastAPI app: REST + WS + 1s timer loop
└── frontend/
    ├── package.json
    ├── angular.json
    └── src/
        ├── index.html
        ├── main.ts
        ├── styles.css            # Global theme (orange/white) + shared classes
        └── app/
            ├── app.component.ts  # Root shell + professional navbar
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   ├── models/models.ts          # Shared TS types + deck definitions
            │   └── services/
            │       ├── api.service.ts         # REST wrappers
            │       ├── websocket.service.ts   # Live room + timer-tick stream
            │       ├── state.service.ts       # Signals + single synced countdown
            │       ├── theme.service.ts
            │       └── toast.service.ts
            ├── components/
            │   ├── voting-cards/              # Colored estimate deck
            │   ├── participants-panel/        # Roster, corp IDs, remove button
            │   ├── activity-log/              # Real-time log panel
            │   └── toast/
            └── pages/
                ├── landing/                   # Home
                ├── about/                     # What is Sprint Estimate?
                ├── guide/                     # Guide
                ├── examples/                  # Examples
                ├── create-session/            # Full session creation form
                ├── join-session/              # Join via invite link (no roles)
                ├── room/                       # Live estimation room
                └── summary/                   # Session wrap-up + export
```

> Note: the project directory is named `planning-poker/` for historical reasons;
> the application itself is **Sprint Estimate**.

---

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

API at `http://localhost:8000` (health: `GET /api/health`).

Run with a **single worker** (the default with `--reload`) — state is held in the
process, so multiple workers would not share rooms.

---

## Frontend Setup

```bash
cd frontend
npm install
```

### Run

```bash
npm start
```

App at `http://localhost:4200`, talking to the backend at `http://localhost:8000`.
To point elsewhere, edit `src/environments/environment.development.ts`
(`apiBase`, `wsBase`).

### Production build

```bash
npm run build
# Output: frontend/dist/exl-planning-poker/browser/
```

---

## Run Commands (quick reference)

| Task           | Command                                                   |
| -------------- | --------------------------------------------------------- |
| Start backend  | `cd backend && uvicorn app.main:app --reload --port 8000` |
| Start frontend | `cd frontend && npm start`                                |
| Build frontend | `cd frontend && npm run build`                            |

Start the backend first, then the frontend, and open `http://localhost:4200`.

---

## CSV Import Format

Import stories from the **creation page** or **inside the room** (Admin only).
Header names are matched case-insensitively and ignore spaces/underscores.

| Column                | Required | Notes                                                       |
| --------------------- | -------- | ----------------------------------------------------------- |
| `title`               | **Yes**  | Rows without a title are skipped and reported.              |
| `story_id`            | No       | Mapped to the story's Jira/reference ID.                    |
| `jira_id`             | No       | Alternative to `story_id`.                                  |
| `description`         | No       | Free text.                                                  |
| `acceptance_criteria` | No       | Free text.                                                  |
| `priority`            | No       | `Low` / `Medium` / `High` / `Critical` (invalid -> Medium). |

**Example**

```csv
story_id,title,description,acceptance_criteria,priority
APP-101,User login,Allow users to sign in,Valid creds succeed; invalid show error,High
APP-102,Password reset,Email-based reset flow,Token expires in 30m,Medium
```

---

## WebSocket Explanation

Each participant holds one WebSocket:

```
ws://localhost:8000/ws/{roomId}/{userId}
```

- On connect, the server registers the socket and pushes the full room snapshot.
- **Every state-changing REST action** updates the in-memory room and broadcasts
  the full snapshot as `{ "event": "<name>", "room": { ... } }`.
- **Timer ticks** are sent as a lightweight frame once per second while a timer
  runs: `{ "event": "timer_tick", "timer": { ... } }`. This keeps every client's
  countdown in sync and gives mid-join users the correct remaining time.
- **Participant removal** is broadcast as `{ "event": "kicked", "userId": "..." }`;
  the matching client clears its session and redirects home.
- **Session end** is broadcast as `{ "event": "session_ended", "room": {...} }`;
  clients route to the summary.

REST is used for commands; WebSocket fans out the resulting state.

---

## Timer Behavior

- The **backend holds the canonical timer state** (`ends_at` is authoritative).
- A **single** background loop ticks once per second for the whole process — there
  is no per-room or per-request loop, so ticks never duplicate.
- The **frontend runs exactly one local interval** (owned by the state service)
  that decrements the displayed seconds for smoothness, and **re-syncs to the
  server** on every snapshot and every `timer_tick`, so the display never drifts.
- Controls (start / pause / resume / reset) are **Admin-only**; participants see
  the countdown only while a timer is active.
- The timer **stops at 0**. If auto-reveal is enabled, estimates reveal
  automatically at 0.
- Pause / reset / end reflect **instantly on all clients** via broadcast.
- A user **joining mid-timer** receives the correct remaining time from the
  initial snapshot.

---

## Multiple Session Behavior

One Admin can create any number of sessions. Each `POST /api/rooms` returns a new
room with an independent id, invite link, participant set, story backlog, estimates,
activity log, timer, and settings. Creating a new session never affects existing
ones — they all run concurrently in memory.

---

## Admin Leaving Behavior

- If the Admin leaves (or simply disconnects), the **session is not terminated**.
  Participants stay connected; all stories, estimates, logs, timer and settings
  remain available. The activity log records **"Admin left the sprint."**
- When the Admin **rejoins using the same corporate ID** (and no other admin is
  currently connected), Admin controls are **restored automatically**, and the log
  records **"Admin rejoined the sprint."**
- The session ends **only** when the Admin explicitly clicks **End session** (which
  asks for confirmation). Ended sessions reject new joins and route everyone to the
  summary.

---

## Known Limitations

- **In-memory only.** All rooms, estimates, and logs live in server memory and are
  lost on restart. No persistence layer by design.
- **Single-process.** State is not shared across multiple backend workers; run a
  single Uvicorn worker.
- **No authentication.** Anyone with the session id/invite link can join. Identity
  is self-reported (name + corporate ID); suitable for trusted internal use. Admin
  rejoin trusts the corporate ID presented.
- **Session identity** is held in the browser (`sessionStorage`); clearing it or
  switching browsers requires rejoining.

---

## Future Scope

- Optional persistence (Redis or a database) for durable sessions and history.
- Authentication / SSO integration for corporate identity and stronger admin rejoin.
- Multi-worker support via a shared pub/sub backend.
- Jira / Azure Boards integration for two-way story sync.
- Per-story discussion threads and notes.
- Exportable meeting reports (PDF) and velocity charts across sprints.
- Configurable custom decks.

---

*Built for internal EXL sprint grooming. Real-time, database-free, enterprise-ready.*
