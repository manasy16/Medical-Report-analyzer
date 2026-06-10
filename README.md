# 🩺 Medical Report Analyzer

An AI-powered web application that reads medical reports (PDF or image), extracts all parameters, and generates easy-to-understand summaries in **English, Hindi, and Hinglish** — built as a college mini project with production-grade architecture.

**Live Demo:--  https://medical-report-analyzer-1-ig02.onrender.com

---

## What It Does

Upload any medical report — CBC, Lipid Panel, Thyroid, Liver Function, Kidney Function, Diabetes, or Urine Analysis — and get back:

- A plain-language summary naming every abnormal value with its actual number
- Per-parameter explanations in 3 languages (what it measures, what your value means)
- Natural diet and lifestyle tips for each parameter
- A safety gate that blocks all advice and refers to a doctor if any value is critically dangerous
- Trend analysis if you've uploaded previous reports for the same member

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| AI Pipeline | LangGraph + LangChain |
| Primary LLM | Groq — Llama 3.3 70B |
| Fallback LLMs | Mistral Small → Gemini 2.0 Flash |
| OCR | Tesseract + Poppler (with pypdf fast path) |
| Database | PostgreSQL (Render) / SQLite (local) |
| Auth | JWT tokens |
| Frontend | React |
| Deployment | Docker on Render |
| Observability | LangSmith tracing |

---

## Architecture — The LangGraph Pipeline

The core of this project is a **stateful directed graph** built with LangGraph. Every uploaded report passes through a sequence of nodes, with conditional routing at key decision points. The graph looks like this:

```
start
  │
  ▼
ocr ──────────────────────────────────── Fast path: embedded PDF text (skips Tesseract)
  │                                       Slow path: Tesseract OCR at DPI 120
  ▼
clean ────────────────────────────────── Collapses whitespace
  │
  ▼
detect_type ──────────────────────────── Keyword detection first, LLM only if ambiguous
  │
  ▼
extract ──────────────────────────────── LLM extracts ALL parameters as structured JSON
  │
  ▼
validate ─────────────────────────────── Rule-based sanity checks (no negative values etc.)
  │
  ├── extraction_failed ──► report_failure ──► END
  │
  ▼
safety_gate ──────────────────────────── Checks critical thresholds per report type
  │
  ├── is_critical ──► blocked ──────────── Doctor referral only, no diet advice ──► END
  │
  ▼
confidence ───────────────────────────── Scores confidence (lower if validation errors)
  │
  ▼
analyze ──────────────────────────────── Generates summary + all parameters + diet tips
  │                                       in English, Hindi, Hinglish
  ▼
END
```

### Node-by-Node Breakdown

**`ocr` — Text Extraction**

First tries to extract embedded text directly from the PDF using `pypdf` — this is a fast path that skips Tesseract entirely for digital (non-scanned) PDFs, dropping OCR time from ~160s to ~1.5s. Falls back to Tesseract at DPI 120 with grayscale and 2 threads for scanned documents or images. A `_looks_like_medical_text()` check validates the extracted text contains actual medical keywords before trusting it.

**`clean` — Text Cleaner**

Collapses all extra whitespace, newlines, and tabs into a single clean string. Reduces token count sent to the LLM and improves extraction accuracy.

**`detect_type` — Report Type Detector**

First runs local keyword scoring — counts how many type-specific keywords appear in the text (e.g. "hemoglobin", "wbc", "platelet" → CBC). If score ≥ 2 matches, returns the type immediately with zero LLM cost. Only falls back to an LLM call for genuinely ambiguous reports. Supports: `cbc`, `lipid`, `thyroid`, `liver`, `kidney`, `diabetes`, `urine`.

**`extract` — Parameter Extraction**

Single LLM call that extracts every parameter present in the report as structured JSON. The prompt explicitly instructs the model to extract ALL parameters (not just common ones), use snake_case keys, and distinguish between quantitative values (numbers) and qualitative values (strings like "Negative" or "3+"). Returns a flat dict of `{param_name: {value, unit}}`.

**`validate` — Sanity Check**

Pure Python rule-based checks — no LLM. Catches impossible values like negative hemoglobin, non-numeric types where numbers are expected. Sets `validation_errors` which lowers the confidence score downstream.

**`safety_gate` — Critical Value Detection**

Checks extracted values against per-type critical thresholds defined in `CRITICAL_THRESHOLDS`. For example: Hemoglobin < 7 g/dL, Platelets < 50,000, WBC > 50,000, Bilirubin > 10, eGFR < 15. Also handles qualitative checks like Red urine color. If any threshold is breached, sets `is_critical = True` and the graph routes to the `blocked` node — no analysis, no diet advice, only a calm doctor referral message.

**`blocked` — Critical Report Handler**

Returns a hardcoded calm message in all 3 languages telling the user to see a doctor. No LLM call. Diet suggestions are always empty `[]`. This is a safety-critical node — it exists to ensure the AI never gives lifestyle advice when someone needs urgent medical attention.

**`report_failure` — Extraction Failure Handler**

Reached when OCR produced no text or the extraction LLM returned unparseable output. Returns a friendly message asking the user to upload a clearer image. Prevents blank screens.

**`confidence` — Confidence Scorer**

Simple rule: 90% if no validation errors, 60% if errors exist. Returned in the API response so the frontend can signal result reliability to the user.

**`analyze` — Primary Analyzer**

The main LLM call. Takes the extracted parameters + report-type-specific reference ranges + any history context from previous reports. Generates a complete response in one shot:
- `summary` — 2-3 sentences naming every abnormal value by name and number
- `risk_level` — normal / borderline / mild / critical
- `parameters` — one object per extracted parameter with explanation and nutrition guide, all in 3 languages
- `diet_suggestions` — general tips (empty if risk is critical or mild)

Prompt explicitly instructs: "include one object for EVERY key in extracted data — do not skip any." This is what ensures all 14+ CBC parameters or 18 urine parameters appear in output.

**`critic` + `fix` — Safety Review Loop** *(in code, currently routed around)*

`critic` reviews the analyzer output for tone (no alarming language), safety (no medication suggestions), and structural consistency. `fix` corrects any issues found. The loop retries up to 2 times before accepting the best available output.

---

## Multi-LLM Failover

Three completely independent LLM providers are chained as primary → fallback → fallback:

```
Groq (Llama 3.3 70B)  →  Mistral Small  →  Gemini 2.0 Flash
```

Each runs on entirely separate server infrastructure. If Groq is rate-limited or down, the request automatically retries on Mistral, then Gemini — transparently, without any error to the user. All three are configured with `max_tokens=8192` to prevent truncation of large trilingual JSON responses.

---

## LangSmith Observability

Every graph execution is traced in LangSmith, showing:
- Time spent in each node
- Exact prompts and responses for every LLM call
- Which fallback model was used
- Token counts and costs

This is how we identified that OCR (Tesseract) was the dominant latency source at 162s out of 241s total — not the LLM calls — which led to the PDF text bypass optimization.

Required env vars:
```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__your_key
LANGCHAIN_PROJECT=your_project_name
```

---

## Setup — Local Development

**Prerequisites:** Python 3.10+, Tesseract OCR, Poppler

```bash
# Clone
git clone https://github.com/yourusername/medical-report-analyzer
cd medical-report-analyzer

# Install dependencies
pip install -r requirements.txt

# Copy and fill environment variables
cp .env.example .env

# Run
uvicorn app.main:app --reload
```

**`.env` file:**
```env
GROQ_API_KEY=your_key
MISTRAL_API_KEY=your_key
GOOGLE_API_KEY=your_key
LANGCHAIN_API_KEY=ls__your_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=medical-report-analyzer
SECRET_KEY=your_jwt_secret

# Windows only — remove on Linux/Mac/Render
POPPLER_PATH=C:/poppler-xx.xx.x/Library/bin
TESSERACT_PATH=C:/Program Files/Tesseract-OCR/tesseract.exe
```

---

## Deployment — Docker on Render

The app is containerized with Docker and deployed on Render. Key points:

- `POPPLER_PATH` and `TESSERACT_PATH` env vars should be left unset on Render — both tools are installed via `apt-get` in the Dockerfile and available in system PATH
- Database uses PostgreSQL on Render via `DATABASE_URL` env var, SQLite locally
- Set all API keys in Render dashboard under Environment

---

## Environment Variables (Render)

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (primary LLM) |
| `MISTRAL_API_KEY` | Mistral API key (fallback 1) |
| `GOOGLE_API_KEY` | Google AI Studio key (fallback 2) |
| `LANGCHAIN_API_KEY` | LangSmith tracing key |
| `LANGCHAIN_TRACING_V2` | Set to `true` to enable tracing |
| `LANGCHAIN_PROJECT` | LangSmith project name |
| `DATABASE_URL` | PostgreSQL connection URL from Render |
| `SECRET_KEY` | JWT signing secret |

---

## Supported Report Types

| Type | Key Parameters |
|---|---|
| CBC (Complete Blood Count) | Hemoglobin, RBC, WBC, Platelets, PCV, MCV, MCH, MCHC, RDW, Differentials |
| Lipid Panel | Total Cholesterol, LDL, HDL, Triglycerides |
| Thyroid Function | TSH, T3, T4, FT3, FT4 |
| Liver Function | ALT, AST, Bilirubin, Albumin, ALP |
| Kidney Function | Creatinine, BUN, eGFR, Uric Acid |
| Diabetes | HbA1c, Fasting Glucose, Post-Prandial Glucose |
| Urine Analysis | pH, Specific Gravity, Protein, Glucose, Ketones, Nitrite, Leukocyte Esterase, Color, Appearance |

---

## Project Structure

```
├── app/
│   ├── graph.py          # LangGraph pipeline — all nodes and routing
│   ├── main.py           # FastAPI app — endpoints
│   ├── database.py       # SQLAlchemy setup (SQLite/PostgreSQL)
│   ├── models/           # Database models
│   ├── routes/           # Auth, members, reports, trends
│   ├── auth/             # JWT utils and dependencies
│   └── services/         # History context builder
├── frontend/             # React app
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## Built By

Manas — CS Engineering Student
