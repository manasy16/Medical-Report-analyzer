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

# ── In-memory job store ──────────────────────────────────────
jobs: dict = {}


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
    token: Optional[str] = Depends(oauth2_scheme)
):
    # ── File type check ───────────────────────────────────────
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Upload a PDF or image."
        )

    file_bytes = await file.read()
    job_id     = str(uuid.uuid4())

    # Get history context if member_id is provided
    history_context = ""
    if member_id:
        history_context = get_member_history_context(member_id, db)

    # Mark as processing
    jobs[job_id] = {"status": "processing", "result": None, "error": None, "member_id": member_id}

    print(f"\n[UPLOAD] job_id={job_id} | file={file.filename} | language={language} | member_id={member_id}")

    try:
        # ── Run the LangGraph pipeline ────────────────────────
        print(f"[PIPELINE] Starting graph for job {job_id[:8]}...")
        result = await asyncio.to_thread(run_graph, file_bytes, language, history_context)

        # ── Save to DB if authenticated and member_id provided ──
        if member_id and token:
            try:
                from auth.utils import decode_access_token
                payload = decode_access_token(token)
                if payload:
                    user_id = payload.get("id")
                    # Double check member belongs to user
                    member = db.query(Member).filter(Member.id == member_id, Member.user_id == user_id).first()
                    if member:
                        # Prepare the JSON result for storage
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
            except Exception as e:
                print(f"[DB] Failed to save report: {e}")

        jobs[job_id] = {"status": "done", "result": result, "error": None}
        print(f"[PIPELINE] Done — job {job_id[:8]}")

    except Exception as e:
        traceback.print_exc()
        jobs[job_id] = {"status": "failed", "result": None, "error": str(e)}
        print(f"[PIPELINE] Failed — job {job_id[:8]} — {e}")

    return {"job_id": job_id, "status": jobs[job_id]["status"]}


# ============================================================
# GET /result/{job_id}
# ============================================================
@app.get("/result/{job_id}")
def get_result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "processing":
        return {"job_id": job_id, "status": "processing", "result": None}

    if job["status"] == "failed":
        return {
            "job_id": job_id,
            "status": "failed",
            "error" : job.get("error", "Check uvicorn logs for details")
        }

    raw = job.get("result") or {}
    llm_out  = raw.get("llm_output",     {}) or {}
    ext_data = raw.get("extracted_data", {}) or {}
    critic   = raw.get("critic_output",  {}) or {}

    return {
        "job_id"           : job_id,
        "status"           : "done",
        "report_type": raw.get("report_type", "unknown"),
        "is_critical"      : raw.get("is_critical",       False),
        "confidence"       : raw.get("confidence",        0.0),
        "extraction_failed": raw.get("extraction_failed", False),
        "validation_errors": raw.get("validation_errors", []) or [],
        "extracted_values" : ext_data,
        "summary"          : llm_out.get("summary",          {}),
        "risk_level"       : llm_out.get("risk_level",       "unknown"),
        "parameters"       : llm_out.get("parameters",       []) or [],
        "diet_suggestions" : llm_out.get("diet_suggestions", {}) or [],
        "critic_valid"     : critic.get("is_valid", None),
        "critic_safe"      : critic.get("safe",     None),
        "critic_issues"    : critic.get("issues",   []) or [],
        "raw_text_preview" : (raw.get("raw_text") or "")[:300],
        "member_id"        : job.get("member_id")
    }

@app.get("/health")
def health():
    return {"status": "ok"}