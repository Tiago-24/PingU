from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
from fastapi import HTTPException, status
import re

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_user(db: Session, user: schemas.UserCreate):
    validate_password_strength(user.password)

    hashed_pw = get_password_hash(user.password)
    db_user = models.User(username=user.username, password=hashed_pw)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    db_user = db.query(models.User).filter(models.User.username == username).first()
    if not db_user:
        return None
    if not verify_password(password, db_user.password):
        return None
    return db_user


def validate_password_strength(password: str):
    requirements = [
        {"text": "At least 8 characters", "ok": len(password) >= 8},
        {"text": "One uppercase letter", "ok": bool(re.search(r"[A-Z]", password))},
        {"text": "One lowercase letter", "ok": bool(re.search(r"[a-z]", password))},
        {"text": "One number", "ok": bool(re.search(r"[0-9]", password))},
        {"text": "One special character (!@#$%^&*...)", "ok": bool(re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=]", password))},
    ]

    if not all(req["ok"] for req in requirements):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid password",
                "requirements": requirements
            }
        )

