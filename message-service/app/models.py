from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func, Table, Boolean
from sqlalchemy.orm import relationship
from .db import Base
from datetime import datetime

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer)
    receiver_id = Column(Integer, nullable=True)  # null se for grupo
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    was_reply = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer)
    group_id = Column(Integer)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    reply_to_id = Column(Integer, ForeignKey("group_messages.id", ondelete="SET NULL"), nullable=True)
    was_reply = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)


class MessageRead(Base):
    __tablename__ = "message_reads"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"))
    user_id = Column(Integer)
    read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)

    message = relationship("Message")

class GroupMessageRead(Base):
    __tablename__ = "group_message_reads"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("group_messages.id", ondelete="CASCADE"))
    user_id = Column(Integer)
    read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)

    message = relationship("GroupMessage")
