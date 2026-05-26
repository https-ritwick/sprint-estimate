"""
EXL Sprint Estimate — FastAPI backend.

REST + WebSocket API. The server is the single source of truth: it holds all
room state in memory and pushes the full room snapshot to every connected
socket on each mutation. No database is used.

There are no user roles. The session creator is flagged internally as the admin
and is the only one allowed to manage the session (reveal/reset/finalize, run
the timer, remove participants, import stories, end the session). Admin-only
actions are guarded by an X-User-Id header that must map to a user with
is_admin=True in that room.

Sessions are never terminated automatically. They survive every disconnect —
including the admin's — and only end when the admin explicitly ends them. A
single admin can run many independent sessions at once; each room has its own
id, link, participants, stories, votes, logs, timer and settings.
"""
from __future__ import annotations

import asyncio
import csv
import io
import time

from fastapi import (
    FastAPI,
    Header,
    HTTPException,
    Query,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .analysis import analyze_story
from .connection_manager import manager
from .models import (
    ActivityLog,
    CreateRoomRequest,
    DeckType,
    FinalizeRequest,
    JoinRoomRequest,
    Priority,
    RemoveUserRequest,
    Room,
    SessionConfig,
    Story,
    StoryImportRequest,
    StoryRequest,
    TimerRequest,
    User,
    VoteRequest,
    new_id,
)
from .store import store

app = FastAPI(title="EXL Sprint Estimate API", version="3.0.0")

# Permissive CORS — internal tool served from an Angular dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _require_room(room_id: str) -> Room:
    room = store.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


def _require_admin(room: Room, user_id: str | None) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    user = room.users.get(user_id)
    if not user:
        raise HTTPException(status_code=403, detail="Unknown user for this session")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


async def _broadcast_state(room: Room, event: str = "state") -> None:
    await manager.broadcast(room.id, {"event": event, "room": room.to_public()})


async def _broadcast_kick(room_id: str, user_id: str) -> None:
    """Tell a specific user they were removed so their client can redirect."""
    await manager.broadcast(room_id, {"event": "kicked", "userId": user_id})


def _sync_connection_flags(room: Room) -> None:
    active = manager.active_user_ids(room.id)
    for uid, user in room.users.items():
        user.is_connected = uid in active


def _config_from_request(req) -> SessionConfig:
    c = req.config
    return SessionConfig(
        project_name=c.projectName,
        sprint_name=c.sprintName,
        deck_type=c.deckType.value if isinstance(c.deckType, DeckType) else str(c.deckType),
        admin_votes=c.adminVotes,
        velocity=c.velocity,
        share_velocity=c.shareVelocity,
        effort_pointing=c.effortPointing,
        auto_reveal=c.autoReveal,
        allow_change_after_reveal=c.allowChangeAfterReveal,
        auto_calculate=c.autoCalculate,
        enable_timer=c.enableTimer,
    )


async def _maybe_auto_reveal(room: Room) -> bool:
    """If the room is configured to auto-flip and everyone has voted, reveal."""
    if not room.config.auto_reveal:
        return False
    story = room.get_active_story()
    if not story or story.revealed:
        return False
    if store.everyone_voted(room):
        store.reveal(room)
        room.log("admin_revealed", "Estimates auto-revealed (everyone voted)")
        return True
    return False


# --------------------------------------------------------------------------- #
# Room lifecycle
# --------------------------------------------------------------------------- #
@app.post("/api/rooms")
async def create_room(req: CreateRoomRequest):
    config = _config_from_request(req)
    room = store.create_room(req.roomName, config)
    room.admin_corporate_id = req.adminCorporateId
    room.admin_name = req.adminName
    admin = User(
        id=new_id("user-"),
        name=req.adminName,
        is_admin=True,
        team=req.team,
        corporate_id=req.adminCorporateId,
    )
    store.add_user(room, admin)
    room.log("session_created", f'{admin.name} created the session', admin)
    return {"room": room.to_public(), "user": admin.to_public()}


@app.get("/api/rooms/{room_id}")
async def get_room(room_id: str):
    room = _require_room(room_id)
    _sync_connection_flags(room)
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest):
    room = _require_room(room_id)
    if room.ended:
        raise HTTPException(status_code=410, detail="This session has ended")

    # Admin rejoin: if the joiner presents the creator's corporate ID and there
    # is currently no connected admin, restore admin controls to them. This lets
    # the admin leave and come back without ever terminating the session.
    cid = (req.corporateId or "").strip()
    is_admin = False
    rejoined_admin = False
    if cid and room.admin_corporate_id and cid == room.admin_corporate_id:
        existing_admin = next((u for u in room.users.values() if u.is_admin and u.is_connected), None)
        if existing_admin is None:
            is_admin = True
            rejoined_admin = True

    user = User(
        id=new_id("user-"),
        name=req.name,
        is_admin=is_admin,
        team=req.team,
        corporate_id=cid,
    )
    store.add_user(room, user)
    if rejoined_admin:
        room.log("admin_rejoined", f'{user.name} rejoined as Admin', user)
    else:
        room.log("user_joined", f'{user.name} joined the session', user)
    await _broadcast_state(room, event="user_joined")
    return {"room": room.to_public(), "user": user.to_public()}


@app.post("/api/rooms/{room_id}/leave")
async def leave_room(room_id: str, x_user_id: str | None = Header(default=None)):
    """A user leaving NEVER ends the session — not even the admin. The room,
    its stories, votes, logs, timer and settings all remain available."""
    room = _require_room(room_id)
    if x_user_id:
        user = store.remove_user(room, x_user_id)
        if user:
            if user.is_admin:
                room.log("admin_left", f'{user.name} (Admin) left the sprint', user)
            else:
                room.log("user_left", f'{user.name} left the session', user)
        await _broadcast_state(room, event="user_left")
    return {"ok": True}


@app.post("/api/rooms/{room_id}/end")
async def end_session(room_id: str, x_user_id: str | None = Header(default=None)):
    """Explicitly end a session. Admin only. This is the ONLY way a session ends."""
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    room.ended = True
    store.stop_timer(room)
    room.log("session_ended", f'{admin.name} ended the session', admin)
    await _broadcast_state(room, event="session_ended")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/remove-user")
async def remove_user(room_id: str, req: RemoveUserRequest, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    if req.userId == admin.id:
        raise HTTPException(status_code=400, detail="Admin cannot remove themselves")
    user = store.remove_user(room, req.userId)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    room.log("admin_removed_participant", f'{admin.name} removed {user.name}', user)
    await _broadcast_kick(room.id, req.userId)
    await _broadcast_state(room, event="user_removed")
    return {"room": room.to_public()}


# --------------------------------------------------------------------------- #
# Stories
# --------------------------------------------------------------------------- #
@app.post("/api/rooms/{room_id}/stories")
async def add_story(room_id: str, req: StoryRequest, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = Story(
        id=new_id("story-"),
        title=req.title,
        description=req.description,
        acceptance_criteria=req.acceptanceCriteria,
        priority=req.priority,
        jira_id=req.jiraId,
    )
    store.add_story(room, story)
    room.log("story_added", f'Story added: "{story.title}"', admin)
    await _broadcast_state(room, event="story_added")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/stories/import")
async def import_stories(room_id: str, req: StoryImportRequest, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    count = 0
    for item in req.stories:
        story = Story(
            id=new_id("story-"),
            title=item.title,
            description=item.description,
            acceptance_criteria=item.acceptanceCriteria,
            priority=item.priority,
            jira_id=item.jiraId,
        )
        store.add_story(room, story)
        count += 1
    room.log("stories_imported", f'{admin.name} imported {count} stories', admin)
    await _broadcast_state(room, event="stories_imported")
    return {"room": room.to_public(), "imported": count}


@app.put("/api/rooms/{room_id}/stories/{story_id}")
async def update_story(
    room_id: str,
    story_id: str,
    req: StoryRequest,
    x_user_id: str | None = Header(default=None),
):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    updated = store.update_story(
        room,
        story_id,
        title=req.title,
        description=req.description,
        acceptance_criteria=req.acceptanceCriteria,
        priority=req.priority,
        jira_id=req.jiraId,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Story not found")
    room.log("story_updated", f'Story updated: "{updated.title}"', admin)
    await _broadcast_state(room, event="story_updated")
    return {"room": room.to_public()}


@app.delete("/api/rooms/{room_id}/stories/{story_id}")
async def delete_story(room_id: str, story_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = room.get_story(story_id)
    title = story.title if story else story_id
    store.delete_story(room, story_id)
    room.log("story_deleted", f'Story deleted: "{title}"', admin)
    await _broadcast_state(room, event="story_deleted")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/active-story")
async def set_active_story(
    room_id: str,
    storyId: str = Query(...),
    x_user_id: str | None = Header(default=None),
):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = store.set_active_story(room, storyId)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    room.log("story_changed", f'Now estimating: "{story.title}"', admin)
    await _broadcast_state(room, event="active_story_changed")
    return {"room": room.to_public()}


# --------------------------------------------------------------------------- #
# Voting
# --------------------------------------------------------------------------- #
@app.post("/api/rooms/{room_id}/vote")
async def vote(room_id: str, req: VoteRequest):
    room = _require_room(room_id)
    user = room.users.get(req.userId)
    if not user:
        raise HTTPException(status_code=403, detail="Unknown user")
    if user.is_admin and not room.config.admin_votes:
        raise HTTPException(status_code=403, detail="Admin estimating is disabled for this session")

    story = room.get_active_story()
    changed = bool(story and req.userId in story.votes)
    story = store.cast_vote(room, req.userId, req.card)
    if not story:
        raise HTTPException(status_code=409, detail="No active story or estimating is closed")

    room.log(
        "vote_changed" if changed else "user_voted",
        f'{user.name} {"changed their estimate" if changed else "estimated"}',
        user,
    )
    revealed = await _maybe_auto_reveal(room)
    await _broadcast_state(room, event="revealed" if revealed else "vote_cast")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/reveal")
async def reveal(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = store.reveal(room)
    if not story:
        raise HTTPException(status_code=404, detail="No active story")
    room.log("admin_revealed", f'{admin.name} revealed the estimates', admin)
    await _broadcast_state(room, event="revealed")
    return {"room": room.to_public(), "results": analyze_story(story, room.users, room.deck)}


@app.post("/api/rooms/{room_id}/reset")
async def reset(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = store.reset_votes(room)
    if not story:
        raise HTTPException(status_code=404, detail="No active story")
    room.log("admin_reset", f'{admin.name} reset the estimates', admin)
    await _broadcast_state(room, event="reset")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/finalize")
async def finalize(room_id: str, req: FinalizeRequest, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    story = store.finalize(room, req.estimate)
    if not story:
        raise HTTPException(status_code=404, detail="No active story")
    room.log("admin_finalized", f'{admin.name} finalized "{story.title}" at {req.estimate}', admin)
    await _broadcast_state(room, event="finalized")
    return {"room": room.to_public()}


@app.get("/api/rooms/{room_id}/results")
async def results(room_id: str):
    room = _require_room(room_id)
    story = room.get_active_story()
    if not story:
        raise HTTPException(status_code=404, detail="No active story")
    return {"results": analyze_story(story, room.users, room.deck)}


# --------------------------------------------------------------------------- #
# Timer (admin only)
# --------------------------------------------------------------------------- #
@app.post("/api/rooms/{room_id}/timer/start")
async def start_timer(room_id: str, req: TimerRequest, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    store.start_timer(room, req.durationSeconds, req.autoReveal)
    room.log("timer_started", f'{admin.name} started a {req.durationSeconds}s timer', admin)
    await _broadcast_state(room, event="timer_started")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/timer/pause")
async def pause_timer(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    store.pause_timer(room)
    room.log("timer_paused", f'{admin.name} paused the timer', admin)
    await _broadcast_state(room, event="timer_paused")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/timer/resume")
async def resume_timer(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    store.resume_timer(room)
    room.log("timer_resumed", f'{admin.name} resumed the timer', admin)
    await _broadcast_state(room, event="timer_resumed")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/timer/reset")
async def reset_timer(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    store.reset_timer(room)
    room.log("timer_reset", f'{admin.name} reset the timer', admin)
    await _broadcast_state(room, event="timer_reset")
    return {"room": room.to_public()}


@app.post("/api/rooms/{room_id}/timer/stop")
async def stop_timer(room_id: str, x_user_id: str | None = Header(default=None)):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)
    store.stop_timer(room)
    room.log("timer_stopped", f'{admin.name} stopped the timer', admin)
    await _broadcast_state(room, event="timer_stopped")
    return {"room": room.to_public()}


# --------------------------------------------------------------------------- #
# Export
# --------------------------------------------------------------------------- #
@app.get("/api/rooms/{room_id}/export")
async def export(room_id: str, fmt: str = Query("json", pattern="^(json|csv)$")):
    room = _require_room(room_id)

    rows = []
    for story in room.stories:
        res = analyze_story(story, room.users, room.deck)
        rows.append({
            "storyId": story.id,
            "title": story.title,
            "jiraId": story.jira_id,
            "priority": story.priority.value,
            "status": story.status.value,
            "finalEstimate": story.final_estimate or "",
            "average": res["average"],
            "median": res["median"],
            "min": res["min"],
            "max": res["max"],
            "consensus": res["consensus"],
            "totalVotes": res["totalVotes"],
        })

    if fmt == "csv":
        buf = io.StringIO()
        fieldnames = list(rows[0].keys()) if rows else [
            "storyId", "title", "jiraId", "priority", "status",
            "finalEstimate", "average", "median", "min", "max",
            "consensus", "totalVotes",
        ]
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{room.name}-summary.csv"'},
        )

    payload = {
        "room": {
            "id": room.id,
            "name": room.name,
            "createdAt": room.created_at,
            "config": room.config.to_public(),
        },
        "exportedAt": time.time(),
        "stories": rows,
        "history": room.history,
        "activity": [a.to_public() for a in room.activity],
    }
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f'attachment; filename="{room.name}-summary.json"'},
    )


# --------------------------------------------------------------------------- #
# CSV story import (multipart upload)
# --------------------------------------------------------------------------- #
@app.post("/api/rooms/{room_id}/stories/import-csv")
async def import_stories_csv(
    room_id: str,
    file: UploadFile = File(...),
    x_user_id: str | None = Header(default=None),
):
    room = _require_room(room_id)
    admin = _require_admin(room, x_user_id)

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV appears to be empty")

    # Normalise header names (case-insensitive, ignore spaces/underscores).
    def norm(h: str) -> str:
        return (h or "").strip().lower().replace(" ", "_")

    headers = {norm(h): h for h in reader.fieldnames}
    if "title" not in headers:
        raise HTTPException(
            status_code=400,
            detail="CSV must include at least a 'title' column",
        )

    valid_priorities = {p.value.lower(): p for p in Priority}
    count = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        title = (row.get(headers.get("title", ""), "") or "").strip()
        if not title:
            errors.append(f"Row {i}: missing title")
            continue
        prio_raw = (row.get(headers.get("priority", ""), "") or "").strip().lower()
        priority = valid_priorities.get(prio_raw, Priority.MEDIUM)
        story = Story(
            id=new_id("story-"),
            title=title[:160],
            description=(row.get(headers.get("description", ""), "") or "").strip(),
            acceptance_criteria=(row.get(headers.get("acceptance_criteria", ""), "") or "").strip(),
            priority=priority,
            jira_id=(row.get(headers.get("story_id", ""), "") or row.get(headers.get("jira_id", ""), "") or "").strip(),
        )
        store.add_story(room, story)
        count += 1

    if count == 0:
        raise HTTPException(status_code=400, detail="No valid stories found. " + "; ".join(errors[:5]))

    room.log("stories_imported", f'{admin.name} imported {count} stories from CSV', admin)
    await _broadcast_state(room, event="stories_imported")
    return {"room": room.to_public(), "imported": count, "errors": errors}


# --------------------------------------------------------------------------- #
# WebSocket
# --------------------------------------------------------------------------- #
@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    room = store.get_room(room_id)
    if room is None:
        await websocket.close(code=4404)
        return

    await manager.connect(room_id, user_id, websocket)
    store.set_user_connected(room, user_id, True)
    await _broadcast_state(room, event="connected")

    try:
        while True:
            await websocket.receive_text()
            user = room.users.get(user_id)
            if user:
                user.last_seen = time.time()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(room_id, user_id, websocket)
        if user_id not in manager.active_user_ids(room_id):
            store.set_user_connected(room, user_id, False)
        await _broadcast_state(room, event="disconnected")


# --------------------------------------------------------------------------- #
# Background timer loop
#
# Fires once per second. For every room with a running timer it broadcasts the
# current timer state so all clients stay in sync (and anyone joining mid-timer
# gets the correct remaining seconds). When a timer reaches zero it stops and,
# if auto-reveal is enabled, reveals the active story. There is exactly ONE loop
# for the whole process — no per-room or per-request loops — so ticks never
# duplicate.
# --------------------------------------------------------------------------- #
@app.on_event("startup")
async def _start_timer_loop():
    async def loop():
        while True:
            await asyncio.sleep(1)
            now = time.time()
            for room in list(store._rooms.values()):  # noqa: SLF001
                t = room.timer
                if not t.is_running or t.ends_at is None:
                    continue
                if now >= t.ends_at:
                    # Timer elapsed.
                    store.stop_timer(room)
                    if t.auto_reveal:
                        story = store.reveal(room)
                        if story:
                            room.log("admin_revealed", "Estimates auto-revealed (timer elapsed)")
                            event = "revealed"
                        else:
                            event = "timer_stopped"
                    else:
                        room.log("timer_stopped", "Timer elapsed")
                        event = "timer_stopped"
                    await _broadcast_state(room, event=event)
                else:
                    # Still running — push a lightweight tick so every client's
                    # countdown stays synced with the server's canonical state.
                    await manager.broadcast(
                        room.id,
                        {"event": "timer_tick", "timer": t.to_public()},
                    )
    asyncio.create_task(loop())


@app.get("/api/health")
async def health():
    return {"status": "ok", "rooms": len(store._rooms)}  # noqa: SLF001
