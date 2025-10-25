from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
from sqlalchemy import or_, and_, func
from datetime import datetime, timezone
import requests
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
GROUP_SERVICE_URL = os.getenv("GROUP_SERVICE_URL")

def get_user_info(user_id: int, token: str):
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{USER_SERVICE_URL}/users/{user_id}", headers=headers)
        if res.status_code == 200:
            data = res.json()
            username = data.get("username")
            # Se foi anonimizado
            if username and username.startswith("UnknownUser_"):
                return {"id": user_id, "username": "Unknown User"}
            return data
    except Exception as e:
        print(f"⚠️ Erro ao contactar user-service: {e}")
    return {"id": user_id, "username": "Unknown User"}



def get_group_members_ids(db: Session, group_id: int, token: str):
    try:
        # Chamamos o group-service (já tens o GROUP_SERVICE_URL definido)
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{GROUP_SERVICE_URL}/groups/{group_id}/members", headers=headers)

        if res.status_code == 200:
            members = res.json()
            # cada membro vem do group-service no formato {"id": x, "username": "..."}
            return [m["id"] for m in members]
        else:
            print(f"⚠️ Erro a obter membros do grupo {group_id}: {res.status_code}")
            return []
    except Exception as e:
        print(f"❌ Erro ao contactar group-service: {e}")
        return []


def get_user_groups(user_id: int, token: str):
    """Busca os grupos de um user no group-service"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{GROUP_SERVICE_URL}/groups/{user_id}", headers = headers)
        if res.status_code == 200:
            return res.json()  # lista [{id, name}, ...]
    except Exception as e:
        print(f"Erro ao contactar group-service: {e}")
    return []



def save_message(db: Session, sender_id: int, receiver_id: int, content: str, reply_to_id: int | None = None, image_url=None):
    msg = models.Message(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        reply_to_id=reply_to_id,
        was_reply=bool(reply_to_id),
        image_url=image_url
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_conversation(db, user1_id: int, user2_id: int, token: str):
    messages = (
        db.query(models.Message)
        .filter(
            ((models.Message.sender_id == user1_id) & (models.Message.receiver_id == user2_id))
            | ((models.Message.sender_id == user2_id) & (models.Message.receiver_id == user1_id))
        )
        .order_by(models.Message.timestamp.asc())
        .all()
    )

    result = []
    for m in messages:
        sender = get_user_info(m.sender_id, token)
        receiver = get_user_info(m.receiver_id, token) if m.receiver_id else None

        msg_dict = {
            "id": m.id,
            "from": sender["username"],
            "to": receiver["username"] if receiver else None,
            "content": m.content,
            "image_url": m.image_url,
            "timestamp": m.timestamp.replace(tzinfo=timezone.utc).isoformat(),
        }

        # Se é (ou foi) uma reply
        if m.was_reply:
            replied = None
            if m.reply_to_id:
                replied = db.query(models.Message).get(m.reply_to_id)

            if replied:
                replied_sender = get_user_info(replied.sender_id, token)
                msg_dict["reply_to"] = {
                    "id": replied.id,
                    "from": replied_sender["username"],
                    "content": replied.content,
                }
            else:
                msg_dict["reply_to"] = {
                    "id": None,
                    "from": None,
                    "content": "Message unavailable",
                }

        result.append(msg_dict)




    return result



def save_group_message(
    db: Session,
    token: str,
    sender_id: int,
    group_id: int,
    content: str,
    reply_to_id: int | None = None,
    image_url=None
):
    # 1️⃣ Create and save message (with optional reply_to_id)
    msg = models.GroupMessage(
        sender_id=sender_id,
        group_id=group_id,
        content=content,
        reply_to_id=reply_to_id,  # 👈 store the relation if present
        was_reply=bool(reply_to_id),
        image_url=image_url
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # 2️⃣ Fetch group members from group-service
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{GROUP_SERVICE_URL}/groups/{group_id}/members", headers=headers)
        members = res.json() if res.status_code == 200 else []
    except Exception as e:
        print(f"Erro ao contactar group-service: {e}")
        members = []

    # 3️⃣ Create unread-tracking rows (skip sender)
    for m in members:
        if m["id"] != sender_id:
            db.add(models.GroupMessageRead(
                message_id=msg.id,
                user_id=m["id"],
                read=False
            ))
    db.commit()

    return msg




def get_group_messages(db: Session, group_id: int, token: str):
    messages = (
        db.query(models.GroupMessage)
        .filter(models.GroupMessage.group_id == group_id)
        .order_by(models.GroupMessage.timestamp.asc())
        .all()
    )

    result = []
    for m in messages:
        sender = get_user_info(m.sender_id, token)

        msg_dict = {
            "id": m.id,
            "from": sender["username"],
            "group": group_id,
            "content": m.content,
            "image_url": m.image_url,
            "timestamp": m.timestamp.replace(tzinfo=timezone.utc).isoformat(),
        }

        # 👇 incluir info de reply (se for ou tiver sido uma reply)
        if getattr(m, "was_reply", False):
            replied = None
            if m.reply_to_id:
                replied = db.query(models.GroupMessage).get(m.reply_to_id)

            if replied:
                replied_sender = get_user_info(replied.sender_id, token)
                msg_dict["reply_to"] = {
                    "id": replied.id,
                    "from": replied_sender["username"],
                    "content": replied.content,
                }
            else:
                msg_dict["reply_to"] = {
                    "id": None,
                    "from": None,
                    "content": "Message unavailable",
                }

        result.append(msg_dict)

    return result


def get_last_message_between(db, user1_id: int, user2_id: int):
    return (
        db.query(models.Message)
        .filter(
            or_(
                and_(models.Message.sender_id == user1_id, models.Message.receiver_id == user2_id),
                and_(models.Message.sender_id == user2_id, models.Message.receiver_id == user1_id),
            )
        )
        .order_by(models.Message.timestamp.desc())
        .first()
    )

def get_last_group_message(db, group_id: int):
    return (
        db.query(models.GroupMessage)
        .filter(models.GroupMessage.group_id == group_id)
        .order_by(models.GroupMessage.timestamp.desc())
        .first()
    )

def mark_messages_read(db: Session, user_id: int, other_id: int):
    """Marca todas as mensagens de other_id → user_id como lidas"""
    messages = (
        db.query(models.Message)
        .filter(
            models.Message.sender_id == other_id,
            models.Message.receiver_id == user_id
        )
        .all()
    )

    for m in messages:
        existing = (
            db.query(models.MessageRead)
            .filter(models.MessageRead.message_id == m.id, models.MessageRead.user_id == user_id)
            .first()
        )
        if existing:
            if not existing.read:
                existing.read = True
                existing.read_at = datetime.utcnow()
        else:
            db.add(models.MessageRead(
                message_id=m.id,
                user_id=user_id,
                read=True,
                read_at=datetime.utcnow()
            ))

    db.commit()


def mark_group_messages_read(db: Session, user_id: int, group_id: int):
    """Marca todas as mensagens do grupo como lidas para o user_id"""
    messages = (
        db.query(models.GroupMessage)
        .filter(models.GroupMessage.group_id == group_id)
        .all()
    )

    for m in messages:
        existing = (
            db.query(models.GroupMessageRead)
            .filter(models.GroupMessageRead.message_id == m.id, models.GroupMessageRead.user_id == user_id)
            .first()
        )
        if existing:
            if not existing.read:
                existing.read = True
                existing.read_at = datetime.utcnow()
        else:
            db.add(models.GroupMessageRead(
                message_id=m.id,
                user_id=user_id,
                read=True,
                read_at=datetime.utcnow()
            ))

    db.commit()


def get_unread_counts(db: Session, user_id: int, token: str):
    # Diretas
    direct_unread = (
        db.query(models.Message.sender_id, func.count(models.Message.id))
        .outerjoin(
            models.MessageRead,
            (models.Message.id == models.MessageRead.message_id) & (models.MessageRead.user_id == user_id)
        )
        .filter(
            models.Message.receiver_id == user_id,
            models.Message.sender_id != user_id,
            or_(
                models.MessageRead.id == None,
                models.MessageRead.read == False
            )
        )
        .group_by(models.Message.sender_id)
        .all()
    )
    direct_counts = {str(sender_id): count for sender_id, count in direct_unread}

    # 🔹 Buscar grupos do utilizador ao group-service
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(f"{GROUP_SERVICE_URL}/groups/{user_id}", headers=headers)
        groups = res.json() if res.status_code == 200 else []
        group_ids = [g["id"] for g in groups]
    except Exception as e:
        print(f"Erro ao contactar group-service: {e}")
        group_ids = []

    # Grupos
    if group_ids:
        group_unread = (
            db.query(models.GroupMessage.group_id, func.count(models.GroupMessage.id))
            .outerjoin(
                models.GroupMessageRead,
                (models.GroupMessage.id == models.GroupMessageRead.message_id) & (models.GroupMessageRead.user_id == user_id)
            )
            .filter(
                models.GroupMessage.group_id.in_(group_ids),
                models.GroupMessage.sender_id != user_id,
                or_(
                    models.GroupMessageRead.id == None,
                    models.GroupMessageRead.read == False
                )
            )
            .group_by(models.GroupMessage.group_id)
            .all()
        )
        group_counts = {str(group_id): count for group_id, count in group_unread}
    else:
        group_counts = {}

    return {"direct": direct_counts, "groups": group_counts}

#def delete_direct_conversation(db: Session, user1_id: int, user2_id: int):
#    db.query(models.Message).filter(
#        ((models.Message.sender_id == user1_id) & (models.Message.receiver_id == user2_id)) |
#        ((models.Message.sender_id == user2_id) & (models.Message.receiver_id == user1_id))
#    ).delete(synchronize_session=False)
#    db.commit()


#def delete_group_conversation(db: Session, group_id: int):
#    db.query(models.GroupMessage).filter(models.GroupMessage.group_id == group_id).delete(synchronize_session=False)
#    db.commit()



