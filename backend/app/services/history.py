from sqlalchemy.orm import Session
from models.models import Report

def get_member_history_context(member_id: int, db: Session, limit: int = 5):
    reports = db.query(Report).filter(Report.member_id == member_id).order_by(Report.created_at.desc()).limit(limit).all()
    
    if not reports:
        return "No previous history available for this member."

    context = "\n### Previous Report History (Most Recent First):\n"
    for i, report in enumerate(reports):
        parsed = report.parsed_json or {}
        date = report.created_at.strftime("%Y-%m-%d")
        ext = parsed.get("extracted_values", {})
        
        context += f"#### Report Date: {date}\n"
        if not ext:
            summary = parsed.get("summary", {}).get("en", "No data available")
            context += f"- Summary: {summary}\n"
            continue
            
        for param, details in ext.items():
            val = details.get("value")
            unit = details.get("unit", "")
            if val is not None:
                context += f"- {param.capitalize()}: {val} {unit}\n"
        context += "\n"
        
    return context
