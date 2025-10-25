from fastapi import HTTPException
from sqlalchemy.orm import Session
from . import models, schemas
import os
import requests

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")

def create_group(db: Session, name: str, member_ids: list[int], owner_id: int):
    group = models.Group(name=name, owner_id=owner_id)
    db.add(group)
    db.commit()
    db.refresh(group)

    for uid in member_ids:
        gm = models.GroupMember(user_id=uid, group_id=group.id)
        db.add(gm)
    db.commit()

    return group

def get_user_groups(db: Session, user_id: int):
    return (
        db.query(models.Group)
        .join(models.GroupMember)
        .filter(models.GroupMember.user_id == user_id)
        .all()
    )

def leave_group(db: Session, group_id: int, user_id: int):
    member = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if member:
        db.delete(member)
        db.commit()
        return True
    return False

def requester_id_from_token(token_data: dict) -> int | None:
    return token_data.get("user_id") or token_data.get("id")

def assert_owner(db: Session, group_id: int, token_data: dict):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    requester_id = token_data.get("user_id") or token_data.get("id")
    
    # ✅ Verificação direta do owner_id
    if requester_id != group.owner_id:
        raise HTTPException(status_code=403, detail="Only the group owner can perform this action")

    return group

def get_usernames_from_ids(user_ids, token_data):
    headers = {"Authorization": f"Bearer {token_data.get('token')}"}
    usernames = []
    for uid in user_ids:
        try:
            # ✅ URL absoluta para user-service
            r = requests.get(f"{USER_SERVICE_URL}/users/{uid}", headers=headers)
            if r.status_code == 200:
                usernames.append(r.json()["username"])
        except Exception as e:
            print("Error fetching username:", e)
    return usernames

def get_group_members_ids(db: Session, group_id: int, token: str):
    """✅ Obtém member IDs diretamente da BD - SEM loop"""
    try:
        members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
        return [m.user_id for m in members]
    except Exception as e:
        print(f"❌ Erro ao obter membros da BD: {e}")
        return []