"""
WebSocket connection manager.

Tracks active socket connections grouped by room, and broadcasts JSON messages
to every member of a room. Each socket is tagged with the user_id it belongs to
so we can mark users connected/disconnected and clean up on drop.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Dict, Set, Tuple

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # room_id -> set of (websocket, user_id)
        self._rooms: Dict[str, Set[Tuple[WebSocket, str]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[room_id].add((websocket, user_id))

    async def disconnect(self, room_id: str, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[room_id].discard((websocket, user_id))
            if not self._rooms[room_id]:
                self._rooms.pop(room_id, None)

    def active_user_ids(self, room_id: str) -> Set[str]:
        return {uid for _, uid in self._rooms.get(room_id, set())}

    async def broadcast(self, room_id: str, message: dict) -> None:
        """Send `message` to every socket in the room. Dead sockets are pruned."""
        dead: list[Tuple[WebSocket, str]] = []
        for ws, uid in list(self._rooms.get(room_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append((ws, uid))
        if dead:
            async with self._lock:
                for entry in dead:
                    self._rooms.get(room_id, set()).discard(entry)


manager = ConnectionManager()
