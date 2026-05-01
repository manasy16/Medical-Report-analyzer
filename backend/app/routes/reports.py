from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Report, Member, User
from auth.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/")
def get_reports(member_id: int = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify member belongs to user
    query = db.query(Report).join(Member).filter(Member.user_id == current_user.id)
    
    if member_id:
        # Extra check: make sure member_id belongs to current_user
        member = db.query(Member).filter(Member.id == member_id, Member.user_id == current_user.id).first()
        if not member:
            raise HTTPException(status_code=403, detail="Member does not belong to user")
        query = query.filter(Report.member_id == member_id)
    
    reports = query.order_by(Report.created_at.desc()).all()
    return reports
