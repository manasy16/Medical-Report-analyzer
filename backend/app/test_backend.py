# ============================================================
# test_backend.py
# Run: python test_backend.py
# Make sure uvicorn is running first: uvicorn main:app --reload
# ============================================================

import sys
import json
import requests

BASE_URL  = "http://127.0.0.1:8000"
TEST_FILE = r"C:\Users\manas\Desktop\blood\blood_report.pdf"  # ← your file

# ── Colour helpers ───────────────────────────────────────────
OK   = "\033[92m  [PASS]\033[0m"
FAIL = "\033[91m  [FAIL]\033[0m"
INFO = "\033[96m  [INFO]\033[0m"
WARN = "\033[93m  [WARN]\033[0m"


# ============================================================
# TEST 1 — Health check
# ============================================================

def test_health():
    print("\n── Test 1: Health check ──────────────────────────────")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        if r.status_code == 200:
            print(f"{OK} Server is running")
        else:
            print(f"{FAIL} Unexpected response: {r.text}")
    except requests.exceptions.ConnectionError:
        print(f"{FAIL} Cannot connect — is uvicorn running?")
        print(f"       Start it with: uvicorn main:app --reload")
        sys.exit(1)


# ============================================================
# TEST 2 — Bad file type (should get 400)
# ============================================================

def test_bad_file_type():
    print("\n── Test 2: Bad file type (expect 400) ───────────────")
    fake = ("report.txt", b"not a blood report", "text/plain")
    r = requests.post(f"{BASE_URL}/upload", files={"file": fake}, timeout=10)
    if r.status_code == 400:
        print(f"{OK} Correctly rejected unsupported file type")
    else:
        print(f"{FAIL} Expected 400, got {r.status_code} — {r.text}")


# ============================================================
# TEST 3 — Unknown job ID (should get 404)
# ============================================================

def test_unknown_job():
    print("\n── Test 3: Unknown job_id (expect 404) ──────────────")
    r = requests.get(f"{BASE_URL}/result/fake-id-000", timeout=5)
    if r.status_code == 404:
        print(f"{OK} Correctly returned 404 for unknown job")
    else:
        print(f"{FAIL} Expected 404, got {r.status_code}")


# ============================================================
# TEST 4 — Full pipeline (upload → result)
# Upload now WAITS for the pipeline to finish before returning,
# so no polling needed — just upload then fetch result directly.
# ============================================================

def test_full_pipeline():
    print("\n── Test 4: Full pipeline ─────────────────────────────")

    # ── Upload ────────────────────────────────────────────────
    print(f"{INFO} Uploading {TEST_FILE}")
    print(f"{INFO} This may take 20–60s (OCR + Gemini calls)... please wait")

    try:
        with open(TEST_FILE, "rb") as f:
            mime = "application/pdf" if TEST_FILE.endswith(".pdf") else "image/jpeg"
            r = requests.post(
                f"{BASE_URL}/upload",
                files={"file": (TEST_FILE, f, mime)},
                timeout=180    # 3 min — enough for OCR + multiple LLM calls
            )
    except FileNotFoundError:
        print(f"{FAIL} File not found: {TEST_FILE}")
        print(f"       Update TEST_FILE at the top of this script")
        return
    except requests.exceptions.Timeout:
        print(f"{FAIL} Request timed out — pipeline is taking too long")
        print(f"       Check uvicorn console for errors")
        return

    if r.status_code != 200:
        print(f"{FAIL} Upload failed: {r.status_code} — {r.text}")
        return

    resp   = r.json()
    job_id = resp.get("job_id")
    status = resp.get("status")
    print(f"{OK} Upload complete — job_id: {job_id} | status: {status}")

    if status == "failed":
        print(f"{FAIL} Pipeline failed during upload — check uvicorn console")
        return

    # ── Fetch result ──────────────────────────────────────────
    print(f"\n── Test 5: Fetch result ──────────────────────────────")
    r2 = requests.get(f"{BASE_URL}/result/{job_id}", timeout=30)

    if r2.status_code != 200:
        print(f"{FAIL} Result fetch failed: {r2.status_code} — {r2.text}")
        return

    data = r2.json()

    # ── Print results table ───────────────────────────────────
    print(f"\n  {'Field':<25} Value")
    print(f"  {'─'*25} {'─'*38}")
    print(f"  {'Status':<25} {data.get('status')}")
    print(f"  {'Is Critical':<25} {data.get('is_critical')}")
    print(f"  {'Confidence':<25} {data.get('confidence')}")
    print(f"  {'Risk Level':<25} {data.get('risk_level')}")
    print(f"  {'Extraction Failed':<25} {data.get('extraction_failed')}")
    print(f"  {'Validation Errors':<25} {data.get('validation_errors')}")
    print(f"  {'Critic Valid':<25} {data.get('critic_valid')}")
    print(f"  {'Critic Safe':<25} {data.get('critic_safe')}")
    print(f"  {'Critic Issues':<25} {data.get('critic_issues')}")

    print(f"\n  OCR Preview (first 300 chars):")
    preview = data.get("raw_text_preview", "")
    print(f"  {preview!r}" if preview else f"  (empty — OCR produced nothing)")

    print(f"\n  Summary:\n    {data.get('summary') or '(empty)'}")

    diet = data.get("diet_suggestions", [])
    if diet:
        print(f"\n  Diet Suggestions:")
        for item in diet:
            print(f"    • {item}")
    else:
        print(f"\n  Diet Suggestions: (none)")

    print(f"\n  Extracted Values:")
    ext = data.get("extracted_values", {})
    if ext:
        print(json.dumps(ext, indent=4))
    else:
        print(f"  (empty — LLM could not extract values)")
        print(f"\n{WARN} Extraction is empty. Next step:")
        print(f"       Open http://127.0.0.1:8000/debug/{job_id}")
        print(f"       Check 'raw_text' — if it has blood values,")
        print(f"       the problem is the LLM prompt, not OCR.")
        print(f"       If 'raw_text' is empty, OCR is the problem.")

    # ── Safety check ──────────────────────────────────────────
    print(f"\n── Safety assertion ──────────────────────────────────")
    if data.get("is_critical") and diet:
        print(f"{FAIL} SAFETY VIOLATION: critical report has diet suggestions!")
    elif data.get("is_critical"):
        print(f"{OK} Critical report — no diet advice given (correct)")
    else:
        print(f"{INFO} Report not critical — safety gate not triggered")

    # ── Debug link ─────────────────────────────────────────────
    print(f"\n{INFO} Full debug dump:")
    print(f"       http://127.0.0.1:8000/debug/{job_id}")


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    print(f"\n{'='*55}")
    print(f"  BLOOD REPORT ANALYZER — BACKEND TESTS")
    print(f"{'='*55}")
    print(f"  Server : {BASE_URL}")
    print(f"  File   : {TEST_FILE}")
    print(f"{'='*55}")

    test_health()
    test_bad_file_type()
    test_unknown_job()
    test_full_pipeline()

    print(f"\n{'='*55}\n")