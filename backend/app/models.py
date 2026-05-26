"""
Pydantic schemas and in-memory domain entities for the EXL Sprint Estimate app.

Two layers live here:
  1. Domain dataclasses (User, Story, Room, TimerState, ActivityLog, SessionConfig)
     held in process memory.
  2. Pydantic request/response models used to validate the REST boundary.

No database is used — everything is in-memory and resets when the server restarts.

There are no user roles. A user is simply a participant; the session creator is
flagged internally with `is_admin=True` and is the only one who can manage the
session. Whether the admin also estimates is governed by the `admin_votes` config.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums & constants
# --------------------------------------------------------------------------- #
class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class StoryStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ESTIMATED = "estimated"


class DeckType(str, Enum):
    FIBONACCI = "fibonacci"
    MODIFIED_FIBONACCI = "modified_fibonacci"
    TSHIRT = "tshirt"
    POWERS_OF_TWO = "powers_of_two"


# --------------------------------------------------------------------------- #
# Card decks
# --------------------------------------------------------------------------- #
# Each deck ends with the neutral cards "?" and "Pass". "Coffee" is kept as an
# accepted neutral card for backwards compatibility but is no longer in a deck.
DECKS: dict[str, list[str]] = {
    DeckType.FIBONACCI.value: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "Pass"],
    DeckType.MODIFIED_FIBONACCI.value: ["0", "0.5", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "Pass"],
    DeckType.TSHIRT.value: ["XS", "S", "M", "L", "XL", "XXL", "?", "Pass"],
    DeckType.POWERS_OF_TWO.value: ["0", "1", "2", "4", "8", "16", "32", "64", "?", "Pass"],
}

# Default deck (used when none specified).
CARD_DECK = DECKS[DeckType.FIBONACCI.value]

# Cards excluded from numeric statistics across every deck.
NON_NUMERIC_CARDS = {"?", "Pass", "Coffee"}

# Ordinal scale for T-shirt sizes so averages/medians still make sense.
TSHIRT_SCALE = {"XS": 1, "S": 2, "M": 3, "L": 5, "XL": 8, "XXL": 13}


def deck_for(deck_type: str) -> list[str]:
    return DECKS.get(deck_type, CARD_DECK)


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


# --------------------------------------------------------------------------- #
# Domain objects (in-memory)
# --------------------------------------------------------------------------- #
@dataclass
class User:
    id: str
    name: str
    is_admin: bool = False
    team: str = ""
    corporate_id: str = ""
    is_connected: bool = True
    last_seen: float = field(default_factory=time.time)

    def can_vote(self, admin_votes: bool) -> bool:
        """Everyone estimates; the admin only does so when admin_votes is on."""
        return (not self.is_admin) or admin_votes

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "isAdmin": self.is_admin,
            "team": self.team,
            "corporateId": self.corporate_id,
            "isConnected": self.is_connected,
        }


@dataclass
class Story:
    id: str
    title: str
    description: str = ""
    acceptance_criteria: str = ""
    priority: Priority = Priority.MEDIUM
    jira_id: str = ""
    status: StoryStatus = StoryStatus.PENDING
    final_estimate: Optional[str] = None
    votes: dict = field(default_factory=dict)   # user_id -> card value (str)
    revealed: bool = False

    def to_public(self, include_votes: bool) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "acceptanceCriteria": self.acceptance_criteria,
            "priority": self.priority.value,
            "jiraId": self.jira_id,
            "status": self.status.value,
            "finalEstimate": self.final_estimate,
            "revealed": self.revealed,
            # Always reveal *who* has voted (for checkmarks); only reveal values
            # once the round is revealed.
            "votedUserIds": list(self.votes.keys()),
            "votes": self.votes if include_votes else {},
        }


@dataclass
class TimerState:
    is_running: bool = False
    duration_seconds: int = 60
    ends_at: Optional[float] = None
    auto_reveal: bool = False
    # Remaining seconds captured when paused, so resume can continue.
    paused_remaining: Optional[int] = None

    @property
    def is_paused(self) -> bool:
        return not self.is_running and self.paused_remaining is not None

    def to_public(self) -> dict:
        remaining = None
        if self.is_running and self.ends_at is not None:
            remaining = max(0, int(round(self.ends_at - time.time())))
        elif self.is_paused:
            remaining = self.paused_remaining
        return {
            "isRunning": self.is_running,
            "isPaused": self.is_paused,
            "durationSeconds": self.duration_seconds,
            "remainingSeconds": remaining,
            "autoReveal": self.auto_reveal,
        }


@dataclass
class ActivityLog:
    id: str
    ts: float
    kind: str             # machine-readable event kind (e.g. "user_joined")
    message: str          # human-readable, pre-rendered sentence
    user_name: str = ""
    corporate_id: str = ""

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "ts": self.ts,
            "kind": self.kind,
            "message": self.message,
            "userName": self.user_name,
            "corporateId": self.corporate_id,
        }


@dataclass
class SessionConfig:
    project_name: str = ""
    sprint_name: str = ""
    deck_type: str = DeckType.FIBONACCI.value
    admin_votes: bool = False
    velocity: Optional[float] = None
    share_velocity: bool = True
    effort_pointing: bool = True
    auto_reveal: bool = False          # auto-flip when everyone has voted
    allow_change_after_reveal: bool = False
    auto_calculate: bool = True
    enable_timer: bool = True

    def to_public(self) -> dict:
        return {
            "projectName": self.project_name,
            "sprintName": self.sprint_name,
            "deckType": self.deck_type,
            "adminVotes": self.admin_votes,
            "velocity": self.velocity,
            "shareVelocity": self.share_velocity,
            "effortPointing": self.effort_pointing,
            "autoReveal": self.auto_reveal,
            "allowChangeAfterReveal": self.allow_change_after_reveal,
            "autoCalculate": self.auto_calculate,
            "enableTimer": self.enable_timer,
        }


@dataclass
class Room:
    id: str
    name: str
    created_at: float = field(default_factory=time.time)
    config: SessionConfig = field(default_factory=SessionConfig)
    users: dict = field(default_factory=dict)     # user_id -> User
    stories: list = field(default_factory=list)   # ordered list[Story]
    active_story_id: Optional[str] = None
    timer: TimerState = field(default_factory=TimerState)
    history: list = field(default_factory=list)   # list[dict] of finalized rounds
    activity: list = field(default_factory=list)  # list[ActivityLog], newest last
    # Identity of the session creator. Used so the admin can leave and rejoin
    # (with the same corporate ID) and have controls restored, without the
    # session ever being terminated by their disconnect.
    admin_corporate_id: str = ""
    admin_name: str = ""
    ended: bool = False                            # only the admin can set this

    def get_active_story(self) -> Optional[Story]:
        if not self.active_story_id:
            return None
        return next((s for s in self.stories if s.id == self.active_story_id), None)

    def get_story(self, story_id: str) -> Optional[Story]:
        return next((s for s in self.stories if s.id == story_id), None)

    @property
    def deck(self) -> list[str]:
        return deck_for(self.config.deck_type)

    def log(self, kind: str, message: str, user: Optional[User] = None) -> ActivityLog:
        entry = ActivityLog(
            id=new_id("log-"),
            ts=time.time(),
            kind=kind,
            message=message,
            user_name=user.name if user else "",
            corporate_id=user.corporate_id if user else "",
        )
        self.activity.append(entry)
        # Keep the activity feed bounded.
        if len(self.activity) > 300:
            self.activity = self.activity[-300:]
        return entry

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "createdAt": self.created_at,
            "config": self.config.to_public(),
            "users": [u.to_public() for u in self.users.values()],
            "stories": [s.to_public(include_votes=s.revealed) for s in self.stories],
            "activeStoryId": self.active_story_id,
            "timer": self.timer.to_public(),
            "history": self.history,
            "activity": [a.to_public() for a in self.activity[-120:]],
            "cardDeck": self.deck,
            "adminCorporateId": self.admin_corporate_id,
            "adminName": self.admin_name,
            "ended": self.ended,
        }


# --------------------------------------------------------------------------- #
# API request models
# --------------------------------------------------------------------------- #
class SessionConfigRequest(BaseModel):
    projectName: str = ""
    sprintName: str = ""
    deckType: DeckType = DeckType.FIBONACCI
    adminVotes: bool = False
    velocity: Optional[float] = None
    shareVelocity: bool = True
    effortPointing: bool = True
    autoReveal: bool = False
    allowChangeAfterReveal: bool = False
    autoCalculate: bool = True
    enableTimer: bool = True


class CreateRoomRequest(BaseModel):
    roomName: str = Field(..., min_length=1, max_length=80)
    adminName: str = Field(..., min_length=1, max_length=60)
    adminCorporateId: str = ""
    team: str = ""
    config: SessionConfigRequest = Field(default_factory=SessionConfigRequest)


class JoinRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    team: str = ""
    corporateId: str = ""


class StoryRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str = ""
    acceptanceCriteria: str = ""
    priority: Priority = Priority.MEDIUM
    jiraId: str = ""


class StoryImportItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str = ""
    acceptanceCriteria: str = ""
    priority: Priority = Priority.MEDIUM
    jiraId: str = ""


class StoryImportRequest(BaseModel):
    stories: list[StoryImportItem] = Field(default_factory=list)


class VoteRequest(BaseModel):
    userId: str
    card: str


class FinalizeRequest(BaseModel):
    estimate: str


class TimerRequest(BaseModel):
    durationSeconds: int = 60
    autoReveal: bool = False


class RemoveUserRequest(BaseModel):
    userId: str
