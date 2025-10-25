from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
from . import models, crud
from .db import engine, SessionLocal
from .websocket import manager
from fastapi.middleware.cors import CORSMiddleware
import asyncio, json
from datetime import datetime, timezone
from .auth import verify_token
from jose import jwt, JWTError
import requests

import os, uuid
from fastapi import File, UploadFile, Request
from fastapi.staticfiles import StaticFiles

# --- Prometheus Metrics ---
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import time


app = FastAPI()


# --- Define Prometheus metrics ---
REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests",
    ["method", "endpoint", "http_status"]
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "HTTP request latency (s)",
    ["endpoint"]
)


# Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev: allow everything
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Middleware to track requests ---
@app.middleware("http")
async def prometheus_middleware(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
    REQUEST_LATENCY.labels(request.url.path).observe(process_time)

    return response


# === File uploads (simple local storage) ===
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve static files from /uploads → available at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")




SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"


# Create tables
models.Base.metadata.create_all(bind=engine)

# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI 🚀 with DB + WebSockets"}


@app.get("/messages/{user1}/{user2}")
def get_conversation(user1: int, user2: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    token = token_data.get("token")
    return crud.get_conversation(db, user1, user2, token)


@app.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    payload = {
        "type": "delete",
        "id": msg.id,
        "chat_type": "direct",
        "from": msg.sender_id,
        "to": msg.receiver_id,
    }

    db.delete(msg)
    db.commit()

    await manager.send_to_users([msg.sender_id, msg.receiver_id], json.dumps(payload))

    return {"status": "deleted"}



@app.delete("/group_messages/{message_id}")
async def delete_group_message(message_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    
    msg = db.query(models.GroupMessage).filter(models.GroupMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    payload = {
        "type": "delete",
        "id": msg.id,
        "chat_type": "group",
        "group_id": msg.group_id,
        "from": msg.sender_id,
    }

    db.delete(msg)
    db.commit()

    await manager.send_to_group(db, msg.group_id, json.dumps(payload), token_data.get("token"))

    return {"status": "deleted"}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("username")  # or "sub", depending on what you encode
        if not username or str(payload.get("sub")) != str(user_id):
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return
    
    
    await manager.connect(websocket, user_id)

    # Buscar user info no user-service
    user_info = crud.get_user_info(user_id, token)
    if not user_info or user_info.get("username") == "Unknown":
        await websocket.close()
        return
    username = user_info["username"]

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            content = data.get("content")

            print(f"🛰️ Incoming WS event: {msg_type} from {username}")

            if msg_type == "direct":
                to_id = data.get("to")
                receiver = crud.get_user_info(to_id, token)
                if not receiver:
                    await websocket.send_json(f"User {to_id} not found")
                    continue

                # get reply_to (if exists)
                reply_to = data.get("reply_to")
                reply_to_id = reply_to.get("id") if reply_to else None
                image_url = data.get("image_url")

                # save message in DB
                save = crud.save_message(
                    db,
                    sender_id=user_id,
                    receiver_id=receiver["id"],
                    content=content,
                    reply_to_id=reply_to_id,
                    image_url=image_url
                )

                # build broadcast payload
                message_payload = {
                    "id": save.id,
                    "type": "direct",
                    "from": username,
                    "to": receiver["username"],
                    "content": content,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                # include reply info if exists
                if reply_to:
                    message_payload["reply_to"] = {
                        "id": reply_to["id"],
                        "from": reply_to["from"],
                        "content": reply_to["content"],
                    }

                if image_url:
                    message_payload["image_url"] = image_url

                await manager.send_to_users([user_id, to_id], json.dumps(message_payload))


            elif msg_type == "group":
                group_id = data["group"]["id"] if isinstance(data["group"], dict) else data["group"]
                reply_to = data.get("reply_to")
                reply_to_id = reply_to.get("id") if reply_to else None
                image_url = data.get("image_url")

                save = crud.save_group_message(
                    db,
                    token,
                    sender_id=user_id,
                    group_id=group_id,
                    content=content,
                    reply_to_id=reply_to_id,
                    image_url=image_url
                )

                message_payload = {
                    "id": save.id,
                    "type": "group",
                    "from": username,
                    "group": group_id,
                    "content": content,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                if reply_to:
                    message_payload["reply_to"] = {
                        "id": reply_to["id"],
                        "from": reply_to["from"],
                        "content": reply_to["content"],
                    }

                if image_url:
                    message_payload["image_url"] = image_url

                await manager.send_to_group(db, group_id, json.dumps(message_payload), token)

            elif msg_type == "typing":
                to_id = data.get("to")
                if to_id:
                    await manager.send_to_user(to_id, json.dumps({
                        "type": "typing",
                        "from_user_id": user_id,
                        "from_username": username
                    }))

            elif msg_type == "stop_typing":
                to_id = data.get("to")
                if to_id:
                    await manager.send_to_user(to_id, json.dumps({
                        "type": "stop_typing",
                        "from_user_id": user_id
                    }))

            elif msg_type == "group_typing":
                group_id = data.get("group")
                if group_id:
                    members = crud.get_group_members_ids(db, group_id, token)
                    for member_id in members:
                        if member_id != user_id:
                            await manager.send_to_user(member_id, json.dumps({
                                "type": "group_typing",
                                "group_id": group_id,
                                "from_user_id": user_id,
                                "from_username": username
                            }))

            elif msg_type == "group_stop_typing":
                print(f"🛑 {username} stopped typing in group {data.get('group')}")
                group_id = data.get("group")
                if group_id:
                    members = crud.get_group_members_ids(db, group_id, token)
                    for m_id in members:
                        if m_id != user_id:
                            await manager.send_to_user(m_id, json.dumps({
                                "type": "group_stop_typing",
                                "from_user_id": user_id,
                                "from_username": username,
                                "group_id": group_id
                            }))



    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({
            "type": "status",
            "message": f"{username} left the chat"
        }))

@app.get("/group_messages/{group_id}")
def get_group_msgs(group_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    token = token_data.get("token")
    return crud.get_group_messages(db, group_id, token)

@app.get("/conversations/{user_id}")
def list_conversations(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    # 🔹 Buscar todos os users ao user-service
    try:
        token = token_data.get("token")
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{crud.USER_SERVICE_URL}/users", headers=headers)
        all_users = res.json() if res.status_code == 200 else []
    except Exception as e:
        print(f"Erro ao contactar user-service: {e}")
        all_users = []

    # 🔹 Direct chats (exclui o próprio user)
    user_data = []
    for u in all_users:
        if u["id"] == user_id:
            continue
        last_msg = crud.get_last_message_between(db, user_id, u["id"])
        user_data.append({
            "id": u["id"],
            "username": u["username"],
            "last_message": last_msg.content if last_msg else None,
            "last_timestamp": last_msg.timestamp if last_msg else None,
        })

    # 🔹 Groups (a DB local ainda sabe quais grupos ele pertence)
    groups = crud.get_user_groups(user_id, token)
    group_data = []
    for g in groups:
        last_msg = crud.get_last_group_message(db, g["id"])
        group_data.append({
            "id": g["id"],
            "name": g["name"],
            "last_message": (
                f"{crud.get_user_info(last_msg.sender_id, token)['username']}: {last_msg.content}"
                if last_msg else None
            ),
            "last_timestamp": last_msg.timestamp if last_msg else None,
        })

    return {"users": user_data, "groups": group_data}



@app.get("/conversations/{user_id}/unread")
def get_unread(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    token = token_data.get("token")
    return crud.get_unread_counts(db, user_id, token)

@app.post("/conversations/{user_id}/read/{other_id}")
def mark_direct_as_read(user_id: int, other_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    crud.mark_messages_read(db, user_id, other_id)
    return {"status": "ok"}

@app.post("/conversations/{user_id}/groups/{group_id}/read")
def mark_group_as_read(user_id: int, group_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    crud.mark_group_messages_read(db, user_id, group_id)
    return {"status": "ok"}

@app.delete("/conversations/{user1_id}/{user2_id}")
async def delete_direct_conversation(user1_id: int, user2_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    messages = (
        db.query(models.Message)
        .filter(
            ((models.Message.sender_id == user1_id) & (models.Message.receiver_id == user2_id)) |
            ((models.Message.sender_id == user2_id) & (models.Message.receiver_id == user1_id))
        )
        .all()
    )

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found in this conversation")

    for msg in messages:
        db.delete(msg)
    db.commit()

    # broadcast para todos os sockets → conversa apagada
    await manager.send_to_users([user1_id, user2_id], json.dumps({
        "type": "conversation_deleted",
        "chat_type": "direct",
        "user1": user1_id,
        "user2": user2_id
    }))

    return {"status": "deleted"}

@app.delete("/group_conversations/{group_id}")
async def delete_group_conversation(group_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    messages = db.query(models.GroupMessage).filter(models.GroupMessage.group_id == group_id).all()

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found in this group")

    for msg in messages:
        db.delete(msg)
    db.commit()

    await manager.send_to_group(db, group_id, json.dumps({
        "type": "conversation_deleted",
        "chat_type": "group",
        "group_id": group_id
    }), token_data.get("token"))

    return {"status": "deleted"}



ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB

@app.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    token_data: dict = Depends(verify_token),
):
    # 1) Validar tipo
    ext = ALLOWED_MIME.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Only images (jpg, png, webp, gif) are allowed.")

    # 2) Nome seguro
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)

    # 3) Guardar com limite de tamanho
    size = 0
    try:
        with open(dest_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    try:
                        os.remove(dest_path)
                    except FileNotFoundError:
                        pass
                    raise HTTPException(status_code=413, detail="File too large (max 10MB).")
                out.write(chunk)
    finally:
        await file.close()

    # 4) URL pública (ex.: http://localhost:8000/uploads/<filename>)
    base = str(request.base_url).rstrip("/")
    url = f"{base}/uploads/{filename}"

    return {"url": url}



@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)