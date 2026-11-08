"""WebSocket hub: one channel per user, plus a 'staff' group for the fraud console.

Sync route handlers run in a threadpool, so `notify` hands work to the event loop with
run_coroutine_threadsafe.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket

log = logging.getLogger("safebank.ws")


class Hub:
    def __init__(self) -> None:
        self.users: dict[int, set[WebSocket]] = defaultdict(set)
        self.staff: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, ws: WebSocket, user_id: int, is_staff: bool) -> None:
        self.loop = asyncio.get_running_loop()
        self.users[user_id].add(ws)
        if is_staff:
            self.staff.add(ws)

    def disconnect(self, ws: WebSocket, user_id: int) -> None:
        self.users[user_id].discard(ws)
        self.staff.discard(ws)

    async def _send(self, targets: list[WebSocket], message: dict) -> None:
        data = json.dumps(message, default=str)
        for ws in targets:
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001 - a dead socket must never break a request
                log.debug("dropping dead socket")

    def _targets(self, user_ids: list[int] | None, staff: bool) -> list[WebSocket]:
        targets: set[WebSocket] = set()
        for uid in user_ids or []:
            targets |= self.users.get(uid, set())
        if staff:
            targets |= self.staff
        return list(targets)

    def notify(self, message: dict, user_ids: list[int] | None = None, staff: bool = False) -> None:
        targets = self._targets(user_ids, staff)
        if not targets or self.loop is None or self.loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(self._send(targets, message))
        else:
            asyncio.run_coroutine_threadsafe(self._send(targets, message), self.loop)

    async def send_to_user(self, user_id: int, message: dict) -> None:
        await self._send(self._targets([user_id], False), message)


hub = Hub()
