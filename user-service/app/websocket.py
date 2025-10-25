from fastapi import WebSocket
from typing import List, Dict
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_map: Dict[int, WebSocket] = {}  # map user_id → websocket

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_map[user_id] = websocket

        await self.broadcast(json.dumps({
            "type": "user_online",
            "user_id": user_id
        }))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # also remove from user_map if present
        for uid, ws in list(self.user_map.items()):
            if ws == websocket:
                del self.user_map[uid]

                import asyncio
                asyncio.create_task(self.broadcast(json.dumps({
                    "type": "user_offline",
                    "user_id": uid
                })))

    async def send_to_user(self, user_id: int, message: str):
        ws = self.user_map.get(user_id)
        if ws:
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

    async def broadcast(self, message: str):
        to_remove = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                to_remove.append(connection)
        for conn in to_remove:
            self.disconnect(conn)

manager = ConnectionManager()
