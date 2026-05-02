import uuid
import asyncio
import traceback
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from graph import run_graph
from database import engine, Base, get_db
from models.models import Report, Member, User
from routes import auth, members, reports, trends
from auth.deps import get_current_user, oauth2_scheme
from services.history import get_member_history_context

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Blood Report Analyzer API")

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(members.router)
app.include_router(reports.router)
app.include_router(trends.router)

# ============================================================
# GET /me
# ============================================================
@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "id": current_user.id}


# ============================================================
# POST /upload
# ============================================================
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    language: str = Form("en"),
    member_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ── File type check ───────────────────────────────────────
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Upload a PDF or image."
        )

    file_bytes = await file.read()

    # Get history context if member_id is provided
    history_context = ""
    if member_id:
        history_context = get_member_history_context(member_id, db)

    print(f"\n[UPLOAD] file={file.filename} | language={language} | member_id={member_id}")

    # ── Run the LangGraph pipeline (Synchronous) ──────────────
    try:
        print(f"[PIPELINE] Running analysis...")
        result = run_graph(file_bytes, language, history_context)
        
        if not result:
            raise HTTPException(status_code=500, detail="Analysis failed to produce a result")

        # ── DB Save Logic ─────────────────────────────────────
        if member_id and current_user:
            try:
                # Double check member belongs to user
                member = db.query(Member).filter(Member.id == member_id, Member.user_id == current_user.id).first()
                if member:
                    llm_out = result.get("llm_output", {}) or {}
                    ext_data = result.get("extracted_data", {}) or {}
                    
                    parsed_for_db = {
                        "summary": llm_out.get("summary", {}),
                        "risk_level": llm_out.get("risk_level", "unknown"),
                        "parameters": llm_out.get("parameters", []),
                        "diet_suggestions": llm_out.get("diet_suggestions", {}),
                        "extracted_values": ext_data,
                        "is_critical": result.get("is_critical", False)
                    }
                    
                    new_report = Report(
                        member_id=member_id,
                        file_url=file.filename,
                        parsed_json=parsed_for_db
                    )
                    db.add(new_report)
                    db.commit()
                    print(f"[DB] Saved report for member {member_id}")
            except Exception as db_e:
                print(f"[DB] Failed to save report: {db_e}")

        # ── Format and return result ───────────────────────────
        llm_out  = result.get("llm_output",     {}) or {}
        ext_data = result.get("extracted_data", {}) or {}
        critic   = result.get("critic_output",  {}) or {}

        return {
            "status"           : "done",
            "report_type"      : result.get("report_type", "unknown"),
            "is_critical"      : result.get("is_critical",       False),
            "confidence"       : result.get("confidence",        0.0),
            "extraction_failed": result.get("extraction_failed", False),
            "validation_errors": result.get("validation_errors", []) or [],
            "extracted_values" : ext_data,
            "summary"          : llm_out.get("summary",          {}),
            "risk_level"       : llm_out.get("risk_level",       "unknown"),
            "parameters"       : llm_out.get("parameters",       []) or [],
            "diet_suggestions" : llm_out.get("diet_suggestions", {}) or [],
            "critic_valid"     : critic.get("is_valid", None),
            "critic_safe"      : critic.get("safe",     None),
            "critic_issues"    : critic.get("issues",   []) or [],
            "raw_text_preview" : (result.get("raw_text") or "")[:300]
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}