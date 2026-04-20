# ============================================================
# main.py — FastAPI Backend (Fixed)
# The pipeline now runs properly before returning the job_id
# ============================================================

import uuid
import asyncio
import traceback
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph import run_graph

app = FastAPI(title="Blood Report Analyzer API")

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store ──────────────────────────────────────
jobs: dict = {}


# ============================================================
# POST /upload
# Runs the full pipeline and waits for it to finish.
# Returns job_id + status once done.
# (For a large app you'd use Celery — this is fine for testing)
# ============================================================

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), language: str = Form("en")):

    # ── File type check ───────────────────────────────────────
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Upload a PDF or image."
        )

    file_bytes = await file.read()
    job_id     = str(uuid.uuid4())

    # Mark as processing so /status returns something meaningful
    jobs[job_id] = {"status": "processing", "result": None, "error": None}

    print(f"\n[UPLOAD] job_id={job_id} | file={file.filename} | size={len(file_bytes):,} bytes")

    try:
        # ── Run the LangGraph pipeline ────────────────────────
        # asyncio.to_thread() runs the sync graph.invoke() in a
        # separate thread so FastAPI's event loop stays unblocked
        print(f"[PIPELINE] Starting graph for job {job_id[:8]} with language {language}...")
        result = await asyncio.to_thread(run_graph, file_bytes, language)

        jobs[job_id] = {"status": "done", "result": result, "error": None}
        print(f"[PIPELINE] Done — job {job_id[:8]}")

    except Exception as e:
        traceback.print_exc()   # full error in uvicorn console
        jobs[job_id] = {"status": "failed", "result": None, "error": str(e)}
        print(f"[PIPELINE] Failed — job {job_id[:8]} — {e}")

    return {"job_id": job_id, "status": jobs[job_id]["status"]}


# ============================================================
# GET /status/{job_id}
# ============================================================

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "status": job["status"]}


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

    # ── Safe access — some nodes may not run on every path ────
    llm_out  = raw.get("llm_output",     {}) or {}
    ext_data = raw.get("extracted_data", {}) or {}
    critic   = raw.get("critic_output",  {}) or {}

    return {
        "job_id"           : job_id,
        "status"           : "done",
        "is_critical"      : raw.get("is_critical",       False),
        "confidence"       : raw.get("confidence",        0.0),
        "extraction_failed": raw.get("extraction_failed", False),
        "validation_errors": raw.get("validation_errors", []) or [],
        "extracted_values" : ext_data,
        "summary"          : llm_out.get("summary",          ""),
        "risk_level"       : llm_out.get("risk_level",       "unknown"),
        "parameters"       : llm_out.get("parameters",       []) or [],
        "diet_suggestions" : llm_out.get("diet_suggestions", []) or [],
        "critic_valid"     : critic.get("is_valid", None),
        "critic_safe"      : critic.get("safe",     None),
        "critic_issues"    : critic.get("issues",   []) or [],
        "raw_text_preview" : (raw.get("raw_text") or "")[:300],
    }


# ============================================================
# GET /debug/{job_id}
# Full raw state — every node's output. Remove before production.
# ============================================================

@app.get("/debug/{job_id}")
def debug_result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    raw = job.get("result") or {}

    # Strip file bytes — too large to show in JSON
    raw_display = {k: v for k, v in raw.items() if k != "file"}

    return {
        "job_id"    : job_id,
        "status"    : job["status"],
        "error"     : job.get("error"),
        "full_state": raw_display
    }


# ============================================================
# GET /health
# ============================================================

@app.get("/health")
def health():
    return {"status": "ok"}