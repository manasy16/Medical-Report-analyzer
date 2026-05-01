from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Report, Member, User
from auth.deps import get_current_user

router = APIRouter(prefix="/trends", tags=["trends"])

@router.get("/")
def get_trends(member_id: int, param: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify member belongs to user
    member = db.query(Member).filter(Member.id == member_id, Member.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Member does not belong to user")

    # Fetch last 10 reports
    reports = db.query(Report).filter(Report.member_id == member_id).order_by(Report.created_at.asc()).limit(10).all()
    
    trend_data = []
    for report in reports:
        parsed = report.parsed_json or {}
        # The structure from previous task: extracted_values contains { value, unit, status }
        extracted = parsed.get("extracted_values", {})
        param_data = extracted.get(param.lower())
        
        if param_data and param_data.get("value") is not None:
            trend_data.append({
                "date": report.created_at.strftime("%Y-%m-%d"),
                "value": param_data.get("value"),
                "unit": param_data.get("unit", "")
            })

    # Basic trend logic
    insight = "Stable"
    if len(trend_data) >= 2:
        first = trend_data[0]["value"]
        last = trend_data[-1]["value"]
        diff = last - first
        if diff > 0.1:
            insight = "Increasing"
        elif diff < -0.1:
            insight = "Decreasing"

    return {
        "parameter": param,
        "trend": trend_data,
        "insight": insight
    }
