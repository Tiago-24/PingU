from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime
from . import models, schemas, crud
from .db import engine, SessionLocal
from fastapi.middleware.cors import CORSMiddleware
import json
from .websocket import manager
from .auth import create_access_token, decode_access_token
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import os

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


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")  # ou onde crias o token

import os
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
GROUP_SERVICE_URL = os.getenv("GROUP_SERVICE_URL")


def verify_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = decode_access_token(token)
        return payload  # payload pode conter o user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.post("/register", response_model=schemas.UserOut,)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.create_user(db, user)

    await manager.broadcast(json.dumps({
        "type": "user_created",
        "id": db_user.id,
        "username": db_user.username
    }))

    return db_user

@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.authenticate_user(db, user.username, user.password)
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token({"sub": str(db_user.id), "username": db_user.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": db_user.id, "username": db_user.username}
    }

import httpx
@app.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    token = token_data.get("token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1️⃣ Limpa dados sensíveis
    user.username = f"UnknownUser_{user.id}"
    user.password = crud.get_password_hash("deleted_user")
    user.email = None
    user.deleted_at = datetime.utcnow() if hasattr(user, "deleted_at") else None  # se tiver coluna
    db.commit()

    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer INTERNAL"}
            res = await client.delete(f"{GROUP_SERVICE_URL}/cleanup/{user_id}", headers=headers)
    except Exception as e:
        print(f"⚠️ Group cleanup failed: {e}")

    print(f"✅ User {user.id} anonymized as {user.username}.")
    return Response(status_code=204)




@app.get("/users")
def list_users(db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    users = db.query(models.User).all()
    return [{"id": u.id, "username": u.username} for u in users]

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "username": user.username}

@app.get("/users/by-username/{username}")
def get_user_by_username(username: str, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "username": user.username}



@app.websocket("/ws/users")
async def websocket_users(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        username = payload.get("username")
        if not user_id or not username:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)

    online_now = list(manager.user_map.keys())
    await websocket.send_json({
        "type": "online_users",
        "user_ids": online_now
    })

    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Invites
@app.post("/contacts/invite")
async def send_invite(
    from_user_id: int,
    to_user_id: int,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token),
):
    # look for an existing invite in either direction
    existing = db.query(models.ContactInvite).filter(
        or_(
            and_(models.ContactInvite.from_user_id == from_user_id,
                 models.ContactInvite.to_user_id == to_user_id),
            and_(models.ContactInvite.from_user_id == to_user_id,
                 models.ContactInvite.to_user_id == from_user_id)
        )
    ).order_by(models.ContactInvite.created_at.desc()).first()

    if existing:
        # 🔹 if it was declined, reopen it
        if existing.status == "declined":
            existing.status = "pending"
            existing.from_user_id = from_user_id
            existing.to_user_id = to_user_id
            existing.created_at = datetime.now().isoformat()
            db.commit()
            db.refresh(existing)
            invite = existing
        # 🔹 if already accepted or pending, block
        elif existing.status in ("pending", "accepted"):
            raise HTTPException(status_code=400, detail="Invite already exists or already contacts")
    else:
        # create a fresh invite
        invite = models.ContactInvite(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            status="pending",
            created_at=datetime.now().isoformat()
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)

    # notify the receiver in real time
    from_user = db.query(models.User).get(from_user_id)
    await manager.send_to_user(
        to_user_id,
        json.dumps({
            "type": "invite_received",
            "invite": {
                "id": invite.id,
                "from_user_id": from_user_id,
                "from_username": from_user.username
            }
        })
    )

    return invite




@app.get("/contacts/invites/{user_id}")
def list_invites(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    invites = db.query(models.ContactInvite).filter(models.ContactInvite.to_user_id == user_id, models.ContactInvite.status == "pending").all()
    return invites


@app.post("/contacts/invite/{invite_id}/respond")
async def respond_invite(invite_id: int, accept: bool, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):
    invite = db.query(models.ContactInvite).get(invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    invite.status = "accepted" if accept else "declined"
    db.commit()

    if accept:
        db.add(models.Contact(user_id=invite.from_user_id, contact_id=invite.to_user_id))
        db.add(models.Contact(user_id=invite.to_user_id, contact_id=invite.from_user_id))
        db.commit()

        # Notificar ambos os users de novos contactos
        from_user = db.query(models.User).get(invite.from_user_id)
        to_user = db.query(models.User).get(invite.to_user_id)

        await manager.send_to_user(
            invite.from_user_id,
            json.dumps({
                "type": "contact_added",
                "user": {"id": to_user.id, "username": to_user.username}
            })
        )

        await manager.send_to_user(
            invite.to_user_id,
            json.dumps({
                "type": "contact_added",
                "user": {"id": from_user.id, "username": from_user.username}
            })
        )

    return invite



@app.get("/contacts/{user_id}")
def list_contacts(user_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    contacts = (
        db.query(models.User)
        .join(models.Contact, models.Contact.contact_id == models.User.id)
        .filter(models.Contact.user_id == user_id)
        .all()
    )
    return [{"id": u.id, "username": u.username} for u in contacts]


from sqlalchemy import or_, and_

@app.delete("/contacts/{user_id}/remove/{contact_id}")
async def remove_contact(user_id: int, contact_id: int, db: Session = Depends(get_db), token_data: dict = Depends(verify_token)):

    contacts = (
        db.query(models.Contact)
        .filter(
            or_(
                and_(models.Contact.user_id == user_id, models.Contact.contact_id == contact_id),            )
        )
        .all()
    )

    if not contacts:
        raise HTTPException(status_code=404, detail="Contact not found")

    for c in contacts:
        db.delete(c)

    invite = (
        db.query(models.ContactInvite)
        .filter(
            and_(
                models.ContactInvite.from_user_id == user_id,
                models.ContactInvite.to_user_id == contact_id
            )
        )
        .first()
    )

    if invite:
        invite.status = "declined"

    db.commit()
    print(f"✅ Removed {len(contacts)} contact(s) successfully.\n")
    return {"status": "removed"}


@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)