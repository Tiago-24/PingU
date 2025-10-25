from typing import List
from fastapi import WebSocket
from . import crud
from sqlalchemy.orm import Session

class ConnectionManager:
    def __init__(self):
        self.user_map: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.user_map[user_id] = websocket

    def disconnect(self, websocket: WebSocket):
        for uid, ws in list(self.user_map.items()):
            if ws == websocket:
                del self.user_map[uid]
                break

    async def send_to_user(self, user_id: int, message: str):
        ws = self.user_map.get(user_id)
        if ws:
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

    async def broadcast(self, message: str):
        for ws in list(self.user_map.values()):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

    async def send_to_group(self, db: Session, group_id: int, message: str, token: str):
        from app.crud import get_group_members_ids
        member_ids = crud.get_group_members_ids(db, group_id, token)
        for uid in member_ids:
            if uid in self.user_map:
                try:
                    await self.user_map[uid].send_text(message)
                except Exception:
                    self.disconnect(self.user_map[uid])


# Singleton
manager = ConnectionManager()
