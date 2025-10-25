from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .db import engine, SessionLocal
from .websocket import manager
from fastapi.middleware.cors import CORSMiddleware
import json
from .auth import verify_token
from jose import jwt, JWTError
import requests
import os


# --- Prometheus Metrics ---
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import time


USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

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



# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# Create tables
models.Base.metadata.create_all(bind=engine)






# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.websocket("/ws/groups/{user_id}")
async def websocket_groups(websocket: WebSocket, user_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("username") or payload.get("sub")
        if not username or not user_id:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/groups", response_model=schemas.GroupOut)
async def create_group(payload: schemas.GroupCreate, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    owner_id = crud.requester_id_from_token(token_data) or (payload.member_ids[0] if payload.member_ids else None)
    if owner_id is None:
        raise HTTPException(status_code=400, detail="Cannot determine owner")

    group = crud.create_group(db, payload.name, payload.member_ids, owner_id)  # keep your logic
    group.owner_id = owner_id
    db.commit(); db.refresh(group)

    await manager.send_to_group(db, group.id, json.dumps({
        "type": "group_created",
        "id": group.id,
        "name": group.name,
        "owner_id": owner_id
    }), token_data.get("token"))

    for username in crud.get_usernames_from_ids(payload.member_ids, token_data):  # helper below
        await manager.broadcast(json.dumps({
            "type": "group_joined",
            "group_id": group.id,
            "group_name": group.name,
            "username": username
        }))
    return group


@app.get("/groups/{user_id}")
def list_user_groups(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    groups = crud.get_user_groups(db, user_id)
    return [{"id": g.id, "name": g.name} for g in groups]

@app.get("/groups/{group_id}/members")
def get_group_members(group_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    if not members:
        raise HTTPException(status_code=404, detail="No members found for this group")

    result = []
    for m in members:
        try:
            token = token_data.get("token")
            headers = {"Authorization": f"Bearer {token}"}
            res = requests.get(f"{USER_SERVICE_URL}/users/{m.user_id}", headers=headers)
            if res.status_code == 200:
                user_data = res.json()
            else:
                user_data = {"id": m.user_id, "username": "Unknown"}
        except Exception as e:
            print(f"Erro ao contactar user-service: {e}")
            user_data = {"id": m.user_id, "username": "Unknown"}

        result.append(user_data)

    return result

@app.delete("/groups/{group_id}/delete/{user_id}")
async def delete_group(group_id: int, user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    group = crud.assert_owner(db, group_id, token_data)

    # Verificar se o utilizador é membro do grupo
    member = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        raise HTTPException(status_code=403, detail="User is not a member of this group")

    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.delete(group)  # graças ao cascade, apaga membros também
    db.commit()

    # Broadcast para todos os clientes → remover grupo em tempo real
    await manager.send_to_group(db, group_id, json.dumps({
        "type": "group_deleted",
        "id": group_id
    }), token_data.get("token"))

    return {"status": "deleted"}

@app.delete("/groups/{group_id}/leave/{user_id}")
async def leave_group(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    # 🧠 Remove the member
    db.delete(member)
    db.commit()

    # Get remaining members
    remaining = db.query(models.GroupMember).filter_by(group_id=group_id).all()
    remaining_ids = [m.user_id for m in remaining]

    # 🧩 CASE 1: group is now empty -> delete group
    if len(remaining_ids) == 0:
        db.delete(group)
        db.commit()

        await manager.broadcast(json.dumps({
            "type": "group_deleted",
            "id": group_id
        }))
        return {"status": "deleted_empty"}

    # 🧩 CASE 2: user who left was the owner -> transfer ownership
    if user_id == group.owner_id:
        new_owner_id = remaining_ids[0]  # pick first member
        group.owner_id = new_owner_id
        db.commit()

        # fetch username for broadcast
        USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
        headers = {"Authorization": f"Bearer {token_data.get('token')}"}
        res = requests.get(f"{USER_SERVICE_URL}/users/{new_owner_id}", headers=headers)
        if res.status_code == 200:
            new_owner_username = res.json().get("username")
        else:
            new_owner_username = str(new_owner_id)

        await manager.send_to_group(db, group_id, json.dumps({
            "type": "owner_transferred",
            "group_id": group_id,
            "new_owner": new_owner_username
        }), token_data.get('token'))

    # broadcast normal “member left”
    await manager.send_to_group(db, group_id, json.dumps({
        "type": "group_left",
        "group_id": group_id,
        "user_id": user_id
    }), token_data.get('token'))

    return {"status": "left"}




@app.post("/groups/{group_id}/members")
async def add_member(group_id: int, username: str = Query(...), db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    group = crud.assert_owner(db, group_id, token_data)

    # Verificar se o grupo existe
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Buscar o utilizador no user-service pelo username
    USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
    headers = {"Authorization": f"Bearer {token_data.get('token')}"}
    res = requests.get(f"{USER_SERVICE_URL}/users/by-username/{username}", headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = res.json()
    user_id = user_data["id"]

    # Verificar se já é membro
    existing = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already in group")

    # Adicionar membro
    new_member = models.GroupMember(user_id=user_id, group_id=group_id)
    db.add(new_member)
    db.commit()

    await manager.send_to_group(db, group_id, json.dumps({
        "type": "member_added",
        "group_id": group_id,
        "username": username
    }), token_data.get('token'))

    # Broadcast adicional: notifica o novo user que ele tem um novo grupo
    await manager.send_to_user(user_id, json.dumps({
        "type": "group_joined",
        "group_id": group_id,
        "group_name": group.name,
        "username": username
    }))

    return {"status": "added", "group_id": group_id, "user": user_data}



@app.delete("/groups/{group_id}/members/{username}")
async def remove_member(group_id: int, username: str, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    group = crud.assert_owner(db, group_id, token_data)

    USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
    headers = {"Authorization": f"Bearer {token_data.get('token')}"}
    res = requests.get(f"{USER_SERVICE_URL}/users/by-username/{username}", headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = res.json()
    user_id = user_data["id"]

    member = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="User not in group")

    db.delete(member)
    db.commit()

    await manager.send_to_group(db, group_id, json.dumps({
        "type": "member_removed",
        "group_id": group_id,
        "user_id": user_id
    }), token_data.get('token'))

    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if group:
        await manager.send_to_group(db, group_id, json.dumps({
            "type": "group_sentoff",
            "group_id": group.id,
            "group_name": group.name,
            "username": username
        }), token_data.get('token'))

    return {"status": "removed", "group_id": group_id, "user_id": user_id}


@app.patch("/groups/{group_id}/owner")
async def transfer_owner(group_id: int, new_owner_username: str = Query(...), db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    group = crud.assert_owner(db, group_id, token_data)  # only current owner can transfer
   
    USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
    headers = {"Authorization": f"Bearer {token_data.get('token')}"}
    res = requests.get(f"{USER_SERVICE_URL}/users/by-username/{new_owner_username}", headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = res.json()
    new_owner_id = user_data["id"]
    
    group.owner_id = new_owner_id
    db.commit()
    await manager.send_to_group(db, group_id, json.dumps({
        "type":"owner_transferred","group_id":group_id,"username":new_owner_username
    }), token_data.get('token'))
    return {"status":"owner_transferred"}

@app.get("/groups/{group_id}/info", response_model=schemas.GroupInfoOut)
def group_info(group_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group: raise HTTPException(404, "Group not found")

    # fetch owner username via user-service
    token = token_data.get("token")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{USER_SERVICE_URL}/users/{group.owner_id}", headers=headers)
    owner_username = r.json().get("username","unknown") if r.status_code==200 else "unknown"

    return {"id": group.id, "name": group.name, "owner_username": owner_username}





import httpx
import os
import json
from fastapi import Depends
from sqlalchemy.orm import Session
from . import models, crud

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")

@app.delete("/cleanup/{user_id}")
async def remove_user_from_all_groups(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    """Remove um user de todos os grupos e transfere ownership se necessário."""
    removed_from = 0
    transferred = 0

    # 1️⃣ Buscar info do user (para saber username)
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{USER_SERVICE_URL}/users/{user_id}", headers={"Authorization": "Bearer INTERNAL"})
            if res.status_code == 200:
                user_info = res.json()
                username = user_info.get("username", f"user_{user_id}")
            else:
                username = f"user_{user_id}"
        except Exception as e:
            print(f"⚠️ Falha a obter info do user {user_id}: {e}")
            username = f"user_{user_id}"

    # 2️⃣ Buscar grupos onde é membro
    memberships = db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).all()
    for member in memberships:
        group = db.query(models.Group).filter(models.Group.id == member.group_id).first()
        if not group:
            continue

        # 3️⃣ Se é o owner → transferir
        if group.owner_id == user_id:
            members = (
                db.query(models.GroupMember)
                .filter(models.GroupMember.group_id == group.id, models.GroupMember.user_id != user_id)
                .order_by(models.GroupMember.id.asc())
                .all()
            )
            if not members:
                # Sem mais ninguém → apagar o grupo
                db.delete(group)
                print(f"🗑️ Grupo {group.name} removido (sem membros restantes)")
            else:
                # Transfere ownership
                new_owner = members[0]
                group.owner_id = new_owner.user_id
                transferred += 1
                print(f"👑 Transferido owner do grupo {group.name} → user {new_owner.user_id}")

        # 4️⃣ Remover user do grupo
        db.delete(member)
        removed_from += 1
        print(f"🚪 User {user_id} removido do grupo {group.name}")

    db.commit()
    print(f"✅ Cleanup completo: {removed_from} grupos limpos, {transferred} transferências")

    return {"removed_from": removed_from, "transferred": transferred}






@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
