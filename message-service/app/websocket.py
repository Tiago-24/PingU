from fastapi import WebSocket
from typing import List, Dict
from . import crud
from sqlalchemy.orm import Session

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_map: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_map[user_id] = websocket

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_to_user(self, user_id: int, message: str):
        ws = self.user_map.get(user_id)
        if ws:
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

    async def send_to_users(self, user_ids: list, message: str):
        for user_id in user_ids:
            ws = self.user_map.get(user_id)
            if ws:
                try:
                    await ws.send_text(message)
                except Exception:
                    self.disconnect(ws)

    async def send_to_group(self, db: Session, group_id: int, message: str, token: str):
        """
        Sends a message to all active WebSocket connections of users in a group.
        """
        try:
            # 🔍 buscar membros do grupo
            member_ids = crud.get_group_members_ids(db, group_id, token)
            for uid in member_ids:
                ws = self.user_map.get(uid)
                if ws:
                    try:
                        await ws.send_text(message)
                    except Exception:
                        self.disconnect(ws)
        except Exception as e:
            print(f"❌ Error sending message to group {group_id}: {e}")


    async def broadcast(self, message: str):
        to_remove = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # If connection is closed, mark for removal
                to_remove.append(connection)

        for conn in to_remove:
            self.disconnect(conn)

manager = ConnectionManager()