from sqlalchemy.orm import Session
from models.models import Report

def get_member_history_context(member_id: int, db: Session, limit: int = 5):
    reports = db.query(Report).filter(Report.member_id == member_id).order_by(Report.created_at.desc()).limit(limit).all()
    
    if not reports:
        return ""

    lines = ["Previous report history, most recent first:"]
    for report in reports:
        parsed = report.parsed_json or {}
        date = report.created_at.strftime("%Y-%m-%d")
        ext = parsed.get("extracted_values", {})

        if not ext:
            continue

        values = []
        for param, details in ext.items():
            if len(values) >= 12:
                break
            if not isinstance(details, dict):
                continue
            val = details.get("value")
            unit = details.get("unit", "")
            if val is not None:
                values.append(f"{param}={val} {unit}".strip())

        if values:
            lines.append(f"{date}: " + "; ".join(values))

    return "\n".join(lines[:limit + 1])
