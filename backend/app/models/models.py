from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Float
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)

    members = relationship("Member", back_populates="owner")

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    age = Column(Integer)
    relation = Column(String)

    owner = relationship("User", back_populates="members")
    reports = relationship("Report", back_populates="member")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    file_url = Column(String)
    parsed_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    member = relationship("Member", back_populates="reports")
