from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Member, User
from auth.deps import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/members", tags=["members"])

class MemberCreate(BaseModel):
    name: str
    age: int
    relation: str

@router.post("/")
def create_member(member_data: MemberCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_member = Member(
        user_id=current_user.id,
        name=member_data.name,
        age=member_data.age,
        relation=member_data.relation
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member

@router.get("/")
def list_members(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    members = db.query(Member).filter(Member.user_id == current_user.id).all()
    return members
