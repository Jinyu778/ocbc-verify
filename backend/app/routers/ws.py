"""One WebSocket per signed-in tab. Carries live updates and WebRTC call signalling."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.exceptions import HTTPException

from .. import db as db_module
from ..models import CallSession
from ..realtime import hub
from ..security import user_from_token

router = APIRouter()


@router.websocket("/api/ws")
async def websocket(ws: WebSocket, token: str = ""):
    with db_module.SessionLocal() as db:
        try:
            user = user_from_token(db, token)
        except HTTPException:
            await ws.close(code=4401)
            return
        uid, role = user.id, user.role
    await ws.accept()
    await hub.connect(ws, uid, role == "staff")
    await ws.send_text(json.dumps({"type": "hello", "user_id": uid}))
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = msg.get("type")
            if kind == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            elif kind in ("call.signal", "call.chat"):
                await _relay(uid, msg)
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(ws, uid)


async def _relay(sender_id: int, msg: dict) -> None:
    """Forward WebRTC offers/answers/ICE and fallback chat lines between the two call parties only."""
    call_id = msg.get("call_id")
    with db_module.SessionLocal() as db:
        c = db.get(CallSession, int(call_id)) if call_id else None
        if not c or c.status == "ended":
            return
        parties = {c.customer_user_id, c.staff_user_id}
    if sender_id not in parties:
        return
    other = next((p for p in parties if p and p != sender_id), None)
    if other is None:
        return
    out = {"type": msg["type"], "call_id": c.id, "from": sender_id}
    if msg["type"] == "call.signal":
        out["data"] = msg.get("data")
    else:
        out["text"] = str(msg.get("text", ""))[:1000]
    await hub.send_to_user(other, out)
