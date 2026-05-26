"""
In-memory session store.

A single SessionStore instance owns every Room. All mutation of room state goes
through here so the API layer stays thin. No persistence — restart clears it.
"""
from __future__ import annotations

import threading
import time
from typing import Optional

from .models import (
    Room,
    SessionConfig,
    Story,
    StoryStatus,
    TimerState,
    User,
    new_id,
)


class SessionStore:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._lock = threading.RLock()

    # ----- rooms ------------------------------------------------------------ #
    def create_room(self, room_name: str, config: Optional[SessionConfig] = None) -> Room:
        with self._lock:
            room_id = new_id("room-")
            room = Room(id=room_id, name=room_name, config=config or SessionConfig())
            self._rooms[room_id] = room
            return room

    def get_room(self, room_id: str) -> Optional[Room]:
        return self._rooms.get(room_id)

    def require_room(self, room_id: str) -> Room:
        room = self._rooms.get(room_id)
        if room is None:
            raise KeyError("Room not found")
        return room

    # ----- users ------------------------------------------------------------ #
    def add_user(self, room: Room, user: User) -> User:
        with self._lock:
            room.users[user.id] = user
            return user

    def remove_user(self, room: Room, user_id: str) -> Optional[User]:
        with self._lock:
            user = room.users.pop(user_id, None)
            # Clean up any votes that user cast on any story.
            for story in room.stories:
                story.votes.pop(user_id, None)
            return user

    def set_user_connected(self, room: Room, user_id: str, connected: bool) -> None:
        with self._lock:
            user = room.users.get(user_id)
            if user:
                user.is_connected = connected

    # ----- stories ---------------------------------------------------------- #
    def add_story(self, room: Room, story: Story) -> Story:
        with self._lock:
            room.stories.append(story)
            # If no story is active yet, make this the active one.
            if room.active_story_id is None:
                self.set_active_story(room, story.id)
            return story

    def update_story(self, room: Room, story_id: str, **fields) -> Optional[Story]:
        with self._lock:
            story = room.get_story(story_id)
            if not story:
                return None
            for key, value in fields.items():
                if value is not None and hasattr(story, key):
                    setattr(story, key, value)
            return story

    def delete_story(self, room: Room, story_id: str) -> None:
        with self._lock:
            room.stories = [s for s in room.stories if s.id != story_id]
            if room.active_story_id == story_id:
                room.active_story_id = room.stories[0].id if room.stories else None

    def set_active_story(self, room: Room, story_id: str) -> Optional[Story]:
        with self._lock:
            story = room.get_story(story_id)
            if not story:
                return None
            prev = room.get_active_story()
            if prev and prev.id != story_id and prev.status == StoryStatus.ACTIVE:
                prev.status = StoryStatus.PENDING
            room.active_story_id = story_id
            if story.status == StoryStatus.PENDING:
                story.status = StoryStatus.ACTIVE
            return story

    # ----- voting ----------------------------------------------------------- #
    def cast_vote(self, room: Room, user_id: str, card: str) -> Optional[Story]:
        with self._lock:
            story = room.get_active_story()
            if not story:
                return None
            # Allow changing a vote after reveal only when configured.
            if story.revealed and not room.config.allow_change_after_reveal:
                return None
            story.votes[user_id] = card
            return story

    def everyone_voted(self, room: Room) -> bool:
        """True when every eligible voter has cast a vote on the active story."""
        story = room.get_active_story()
        if not story:
            return False
        admin_votes = room.config.admin_votes
        voters = [u for u in room.users.values() if u.can_vote(admin_votes)]
        if not voters:
            return False
        return all(u.id in story.votes for u in voters)

    def reveal(self, room: Room) -> Optional[Story]:
        with self._lock:
            story = room.get_active_story()
            if not story:
                return None
            story.revealed = True
            self._stop_timer(room)
            return story

    def reset_votes(self, room: Room) -> Optional[Story]:
        with self._lock:
            story = room.get_active_story()
            if not story:
                return None
            story.votes.clear()
            story.revealed = False
            self._stop_timer(room)
            return story

    def finalize(self, room: Room, estimate: str) -> Optional[Story]:
        with self._lock:
            story = room.get_active_story()
            if not story:
                return None
            story.final_estimate = estimate
            story.status = StoryStatus.ESTIMATED
            room.history.append({
                "storyId": story.id,
                "title": story.title,
                "jiraId": story.jira_id,
                "priority": story.priority.value,
                "finalEstimate": estimate,
                "votes": dict(story.votes),
            })
            return story

    # ----- timer ------------------------------------------------------------ #
    def _stop_timer(self, room: Room) -> None:
        room.timer.is_running = False
        room.timer.ends_at = None
        room.timer.paused_remaining = None

    def start_timer(self, room: Room, duration: int, auto_reveal: bool) -> None:
        with self._lock:
            room.timer.is_running = True
            room.timer.duration_seconds = duration
            room.timer.auto_reveal = auto_reveal
            room.timer.paused_remaining = None
            room.timer.ends_at = time.time() + duration

    def pause_timer(self, room: Room) -> None:
        with self._lock:
            t = room.timer
            if t.is_running and t.ends_at is not None:
                t.paused_remaining = max(0, int(round(t.ends_at - time.time())))
                t.is_running = False
                t.ends_at = None

    def resume_timer(self, room: Room) -> None:
        with self._lock:
            t = room.timer
            if not t.is_running and t.paused_remaining is not None:
                t.is_running = True
                t.ends_at = time.time() + t.paused_remaining
                t.paused_remaining = None

    def reset_timer(self, room: Room) -> None:
        with self._lock:
            room.timer = TimerState(
                duration_seconds=room.timer.duration_seconds,
                auto_reveal=room.timer.auto_reveal,
            )

    def stop_timer(self, room: Room) -> None:
        with self._lock:
            self._stop_timer(room)


store = SessionStore()
