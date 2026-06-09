from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Report, Member, User
from auth.deps import get_current_user

router = APIRouter(prefix="/trends", tags=["trends"])

def normalize_param_name(value: str) -> str:
    return (value or "").strip().lower().replace(" ", "_").replace("-", "_")


def to_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "").strip())
        except ValueError:
            return None
    return None


@router.get("/")
def get_trends(member_id: int, param: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify member belongs to user
    member = db.query(Member).filter(Member.id == member_id, Member.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Member does not belong to user")

    # Fetch latest 10 reports, then chart them oldest -> newest.
    reports = (
        db.query(Report)
        .filter(Report.member_id == member_id)
        .order_by(Report.created_at.desc())
        .limit(10)
        .all()
    )
    reports = list(reversed(reports))
    
    trend_data = []
    requested_param = normalize_param_name(param)
    for report in reports:
        parsed = report.parsed_json or {}
        extracted = parsed.get("extracted_values", {})
        normalized = {
            normalize_param_name(key): value
            for key, value in extracted.items()
            if isinstance(value, dict)
        }
        param_data = normalized.get(requested_param)
        
        if param_data and param_data.get("value") is not None:
            numeric_value = to_number(param_data.get("value"))
            if numeric_value is None:
                continue
            trend_data.append({
                "date": report.created_at.strftime("%Y-%m-%d"),
                "value": numeric_value,
                "unit": param_data.get("unit", "")
            })

    insight = "Not enough data"
    if len(trend_data) >= 2:
        first = trend_data[0]["value"]
        last = trend_data[-1]["value"]
        diff = last - first
        tolerance = max(abs(first) * 0.03, 0.1)
        if diff > tolerance:
            insight = "Increasing"
        elif diff < -tolerance:
            insight = "Decreasing"
        else:
            insight = "Stable"

    return {
        "parameter": requested_param,
        "trend": trend_data,
        "insight": insight
    }
