from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(100), nullable=False)


class ContactInvite(Base):
    __tablename__ = "contact_invites"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, nullable=False)
    to_user_id = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")  # pending / accepted / declined
    created_at = Column(String, default=lambda: datetime.now().isoformat())


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    contact_id = Column(Integer, nullable=False)
    created_at = Column(String, default=lambda: datetime.now().isoformat())