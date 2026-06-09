# ============================================================
# MEDICAL REPORT ANALYZER — graph.py
# Fixed version: safety gate, critic bug, error handling,
# env-based paths, extraction failure routing
# ============================================================

import os
import re
import json
import logging
import io
from typing import TypedDict, Optional

from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_mistralai import ChatMistralAI
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_core.prompts import ChatPromptTemplate

# -- Tool Paths --


import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
from dotenv import load_dotenv
from pathlib import Path

# ── Load .env ────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


# ── Logger (replaces silent except blocks) ──────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Read paths from .env (None = already in system PATH) ────
POPPLER_PATH   = os.getenv("POPPLER_PATH")   or None
TESSERACT_PATH = os.getenv("TESSERACT_PATH") or None

# Tell Tesseract where its executable is (only if provided)
if TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

# ── Reference ranges — one entry per report type ─────────────
REFERENCE_RANGES = {
    "cbc": """
- Hemoglobin : 12.0–17.5 g/dL (varies by sex)
- RBC        : 4.1–5.9 million/µL
- WBC        : 4,000–11,000 /µL
- Platelets  : 1,50,000–4,00,000 /µL
""",
    "lipid": """
- Total Cholesterol : < 200 mg/dL
- LDL Cholesterol   : < 100 mg/dL
- HDL Cholesterol   : > 60 mg/dL
- Triglycerides     : < 150 mg/dL
""",
    "thyroid": """
- TSH : 0.4–4.0 mIU/L
- T3  : 80–200 ng/dL
- T4  : 5.0–12.0 µg/dL
- FT3 : 2.3–4.2 pg/mL
- FT4 : 0.8–1.8 ng/dL
""",
    "liver": """
- ALT (SGPT)  : 7–56 U/L
- AST (SGOT)  : 10–40 U/L
- Bilirubin   : 0.1–1.2 mg/dL
- Albumin     : 3.4–5.4 g/dL
- ALP         : 44–147 U/L
""",
    "kidney": """
- Creatinine : 0.6–1.2 mg/dL
- BUN (Urea) : 7–25 mg/dL
- eGFR       : > 60 mL/min/1.73m²
- Uric Acid  : 2.4–7.0 mg/dL
""",
    "diabetes": """
- Fasting Blood Glucose : 70–100 mg/dL
- HbA1c                 : < 5.7% (normal)
- Post-Prandial Glucose : < 140 mg/dL
""",
    "urine": """
- Specific Gravity : 1.005–1.030
- pH               : 4.5–8.0
- Protein          : Negative
- Glucose          : Negative
- Ketones          : Negative
- Bilirubin        : Negative
- Nitrite          : Negative
- Leukocyte Esterase : Negative
- Color            : Pale yellow to Amber
- Appearance       : Clear or Transparent
""",
    "unknown": "No specific reference ranges. Use general clinical knowledge."
}

# ── LLM setup ────────────────────────────────────────────────
# ── LLM setup — 3 models across 3 different servers ──────────

# Primary: Groq (Llama 3.3 70B) — completely different server
_groq = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    max_tokens=4096,
    api_key=os.getenv("GROQ_API_KEY")
)

# Fallback 1: Mistral AI — third independent server
_mistral = ChatMistralAI(
    model="mistral-small-latest",
    temperature=0,
    api_key=os.getenv("MISTRAL_API_KEY")
)

# Fallback 2: Google AI Studio (Gemini)
_gemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0
)

# Chain them — Groq primary, then Mistral, then Gemini
llm = _groq.with_fallbacks([_mistral, _gemini])

# ── Retry wrapper — handles temporary 503 spikes ─────────────
@retry(
    wait=wait_exponential(multiplier=1, min=1, max=5),
    stop=stop_after_attempt(4),
    reraise=True
)
def call_llm_with_retry(chain, inputs: dict):
    return chain.invoke(inputs)


# ============================================================
# STATE
# ============================================================

class State(TypedDict):
    file             : bytes
    raw_text         : str
    cleaned_text     : str
    report_type      : str
    extracted_data   : dict
    extraction_failed: bool          # True if LLM/parse failed
    validation_errors: list
    confidence       : float
    is_critical      : bool          # Set by safety_gate_node
    llm_output       : dict
    critic_output    : dict
    retries          : int
    language         : str           # Target language for output
    history_context  : str           # Context from previous reports


# ============================================================
# HELPER — strip markdown fences Gemini sometimes adds
# ============================================================

def parse_llm_json(raw: str, node_name: str) -> Optional[dict]:
    """
    Safely parse JSON from LLM response.
    Strips ```json ... ``` fences if present.
    Handles invalid Unicode escape sequences from non-Gemini models.
    Returns None on failure (caller must handle it).
    """
    try:
        text = raw.strip()
        # Remove markdown fences — handles both complete and truncated responses
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE).strip()
        
        # Fix invalid escape sequences produced by Groq/Mistral
        # e.g. \व becomes \\व so json.loads doesn't choke
        text = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)
        
        result = json.loads(text)
        if not isinstance(result, dict):
            raise ValueError("Expected a JSON object (dict)")
        return result
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("[%s] JSON parse failed: %s | Raw output: %.200s", node_name, e, raw)
        return None

# ============================================================
# NODE 1 — OCR
# ============================================================

def ocr_node(state: State):
    file_bytes = state["file"]
    print(f"[OCR] POPPLER_PATH = {POPPLER_PATH}")
    print(f"[OCR] File size = {len(file_bytes)} bytes")
    text = ""
    try:
        images = convert_from_bytes(file_bytes, poppler_path=POPPLER_PATH, dpi=150)
        print(f"[OCR] Pages converted: {len(images)}")
        for img in images:
            config = r"--oem 3 --psm 6"
            page_text = pytesseract.image_to_string(img, config=config)
            print(f"[OCR] Page text length: {len(page_text)}")
            text += page_text
    except Exception as e:
        print(f"[OCR] PDF conversion failed: {e}")
        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image, config=r"--oem 3 --psm 6")
            print(f"[OCR] Image fallback text length: {len(text)}")
        except Exception as e2:
            print(f"[OCR] Image fallback also failed: {e2}")
            text = ""
    print(f"[OCR] Total text extracted: {len(text)} chars")
    return {"raw_text": text}


# ============================================================
# NODE 2 — TEXT CLEANER
# ============================================================

def cleaner_node(state: State):
    """
    Collapse extra whitespace so the LLM gets cleaner input.
    """
    cleaned = " ".join(state["raw_text"].split())
    return {"cleaned_text": cleaned}


# ============================================================
# NODE 2b — DETECT TYPE + EXTRACT (merged, single LLM call)
# ============================================================

VALID_REPORT_TYPES = {"cbc", "lipid", "thyroid", "liver", "kidney", "diabetes", "urine", "unknown"}

def detect_and_extract_node(state: State):
    """
    Replaces the old report_type_detector_node + extraction_node.
    One single LLM call that:
      1. Identifies the report type
      2. Extracts ALL parameters present in the text

    Returns both report_type and extracted_data in one shot,
    saving one full Groq round trip (~10-15 seconds).

    Output JSON shape:
    {
      "report_type": "cbc",
      "parameters": {
        "hemoglobin": {"value": 12.5, "unit": "g/dL"},
        "pcv":        {"value": 57.5, "unit": "%"},
        ...
      }
    }
    """
    prompt = ChatPromptTemplate.from_template("""
You are a medical document parser. Read the report text below and do TWO things in one response.

Text:
{input}

TASK 1 — Identify the report type.
Choose EXACTLY one of:
- "cbc"      → Complete Blood Count (hemoglobin, WBC, RBC, platelets, PCV, MCV, MCH, MCHC, RDW, differentials)
- "lipid"    → Lipid Panel (cholesterol, LDL, HDL, triglycerides)
- "thyroid"  → Thyroid Function (TSH, T3, T4, FT3, FT4)
- "liver"    → Liver Function Tests (ALT, AST, bilirubin, albumin, ALP)
- "kidney"   → Kidney / Renal Function (creatinine, BUN, eGFR, uric acid)
- "diabetes" → Diabetes / Blood Sugar (HbA1c, fasting glucose, post-prandial glucose)
- "urine"    → Urine Analysis (pH, protein, glucose, specific gravity, color, appearance, nitrite, ketones, bilirubin, leukocyte esterase)
- "unknown"  → Cannot determine

TASK 2 — Extract EVERY parameter that appears in the text.
Rules for extraction:
- Extract ALL parameters present — do not skip any, even if they appear normal
- For quantitative values (numbers), use a JSON number type
- For qualitative values (like urine color, appearance, or "3+" protein), use a string
- If a value is missing from the text, set value to null
- Do NOT invent or guess values
- Use snake_case for parameter names (e.g., "total_cholesterol", "pcv", "urine_color")

Return ONLY a valid JSON object, no explanation, no markdown fences:
{{
  "report_type": "one of the types above",
  "parameters": {{
    "parameter_name": {{"value": number or string or null, "unit": "unit string or null"}},
    "parameter_name": {{"value": number or string or null, "unit": "unit string or null"}}
  }}
}}
""")

    chain = prompt | llm
    response = call_llm_with_retry(chain, {"input": state["cleaned_text"]})

    result = parse_llm_json(response.content, "detect_and_extract_node")

    # ── Parse failure → flag it, downstream will route to report_failure
    if result is None:
        logger.error("[detect_and_extract_node] LLM returned unparseable JSON")
        return {
            "report_type"     : "unknown",
            "extracted_data"  : {},
            "extraction_failed": True
        }

    # ── Validate report_type — default to unknown if LLM hallucinated
    report_type = result.get("report_type", "unknown")
    if report_type not in VALID_REPORT_TYPES:
        logger.warning("[detect_and_extract_node] Invalid report_type '%s' — defaulting to unknown", report_type)
        report_type = "unknown"

    # ── Extract the parameters dict — default to empty if missing
    parameters = result.get("parameters", {})
    if not isinstance(parameters, dict):
        logger.warning("[detect_and_extract_node] 'parameters' is not a dict — treating as empty")
        parameters = {}

    # ── If we got a type but zero params, still flag as failed
    if not parameters:
        logger.warning("[detect_and_extract_node] No parameters extracted")
        return {
            "report_type"     : report_type,
            "extracted_data"  : {},
            "extraction_failed": True
        }

    logger.info("[detect_and_extract_node] type=%s | params=%d", report_type, len(parameters))
    return {
        "report_type"     : report_type,
        "extracted_data"  : parameters,
        "extraction_failed": False
    }


# ============================================================
# NODE 4 — VALIDATION
# ============================================================

def validation_node(state: State):
    """
    Generic sanity check — makes sure extracted values are
    positive real numbers. Works for any report type.
    """
    data   = state["extracted_data"]
    errors = []

    for param_name, param_data in data.items():
        if not isinstance(param_data, dict):
            continue
        value = param_data.get("value")
        if value is not None:
            # Check if it's a number or string
            if not isinstance(value, (int, float, str)):
                errors.append(f"{param_name} value is not a valid type (number or string): {value}")
            # If it's a number, check for negative values
            elif isinstance(value, (int, float)) and value < 0:
                errors.append(f"{param_name} has an impossible negative value: {value}")

    if errors:
        logger.warning("[validation_node] Errors: %s", errors)

    return {"validation_errors": errors}


# ============================================================
# NODE 5 — SAFETY GATE
# ============================================================

# Critical thresholds per report type
CRITICAL_THRESHOLDS = {
    "cbc": [
        ("hemoglobin", "lt", 7),       # hb < 7 is critical
        ("platelets",  "lt", 50000),   # platelets < 50k is critical
        ("wbc",        "gt", 50000),   # very high WBC = possible leukemia
    ],
    "lipid": [
        ("total_cholesterol", "gt", 300),  # very high cholesterol
        ("triglycerides",     "gt", 500),  # risk of pancreatitis
    ],
    "thyroid": [
        ("tsh", "lt", 0.1),   # severely suppressed TSH
        ("tsh", "gt", 10.0),  # severely elevated TSH
    ],
    "liver": [
        ("alt",       "gt", 300),   # severe liver damage
        ("ast",       "gt", 300),
        ("bilirubin", "gt", 10),    # severe jaundice
    ],
    "kidney": [
        ("creatinine", "gt", 5.0),  # severe kidney failure
        ("egfr",       "lt", 15),   # stage 5 CKD
    ],
    "diabetes": [
        ("fasting_blood_glucose", "gt", 400),  # hyperglycemic crisis
        ("hba1c",                 "gt", 12),
    ],
    "urine": [
        ("protein", "gt", 3),  # 3+ or higher
        ("ketones", "gt", 2),  # Large ketones
        ("urine_color", "eq", "Red"),  # Hematuria hint
        ("urine_color", "eq", "Brown"), # Potential liver/muscle issues
    ],
    "unknown": []
}

def safety_gate_node(state: State):
    data        = state["extracted_data"]
    report_type = state.get("report_type", "unknown")
    thresholds  = CRITICAL_THRESHOLDS.get(report_type, [])
    is_critical = False

    for param_name, operator, threshold in thresholds:
        param = data.get(param_name, {})
        value = param.get("value") if isinstance(param, dict) else None
        if value is None:
            continue
            
        # Numeric checks
        if isinstance(value, (int, float)) and isinstance(threshold, (int, float)):
            if operator == "lt" and value < threshold:
                logger.warning("[safety_gate] CRITICAL: %s = %s (< %s)", param_name, value, threshold)
                is_critical = True
                break
            if operator == "gt" and value > threshold:
                logger.warning("[safety_gate] CRITICAL: %s = %s (> %s)", param_name, value, threshold)
                is_critical = True
                break
        
        # String checks (equality)
        elif isinstance(value, str) and operator == "eq":
            if value.lower() == str(threshold).lower():
                logger.warning("[safety_gate] CRITICAL: %s = %s (matches %s)", param_name, value, threshold)
                is_critical = True
                break
        
        # Special case: Qualitative "3+" or "4+" for protein/ketones
        elif isinstance(value, str) and operator == "gt" and "+" in value:
            try:
                plus_count = value.count("+")
                if plus_count >= threshold:
                    logger.warning("[safety_gate] CRITICAL: %s = %s (>= %s+)", param_name, value, threshold)
                    is_critical = True
                    break
            except:
                pass

    return {"is_critical": is_critical}


# ============================================================
# NODE 6a — CONFIDENCE SCORER (non-critical path)
# ============================================================

def confidence_node(state: State):
    """
    Simple confidence score — lower if validation found errors.
    """
    confidence = 90.0 if not state["validation_errors"] else 60.0
    return {"confidence": confidence}


# ============================================================
# NODE 6b — BLOCKED (critical path)
# ============================================================

def blocked_node(state: State):
    """
    Returned when the report has critical values.
    No medical advice — only a calm doctor referral.
    """
    output = {
        "summary": {
            "en": "Some values in your report may need medical attention. Please consult a qualified doctor at the earliest.",
            "hi": "आपकी रिपोर्ट में कुछ मानों पर चिकित्सा ध्यान देने की आवश्यकता हो सकती है। कृपया जल्द से जल्द किसी योग्य डॉक्टर से परामर्श लें।",
            "hinglish": "Aapki report mein kuch values ko medical attention ki zaroorat ho sakti hai. Please jaldi se jaldi kisi qualified doctor se consult karein."
        },
        "risk_level"      : "critical",
        "parameters"      : [],
        "diet_suggestions": {"en": [], "hi": [], "hinglish": []}   # Always empty for critical reports
    }
    return {"llm_output": output, "confidence": 0.0}


# ============================================================
# NODE 7 — REPORT FAILURE (extraction failed path)
# ============================================================

def report_failure_node(state: State):
    """
    Returned when OCR or extraction produced no usable data.
    Gives the user a clear message instead of a blank screen.
    """
    output = {
        "summary": {
            "en": "We were unable to read the values from your report. Please try uploading a clearer image or a text-based PDF.",
            "hi": "हम आपकी रिपोर्ट से मानों को पढ़ने में असमर्थ रहे। कृपया एक स्पष्ट छवि या पाठ-आधारित PDF अपलोड करने का प्रयास करें।",
            "hinglish": "Hum aapki report se values read nahi kar paye. Please ek clearer image ya text-based PDF upload karne ka try karein."
        },
        "risk_level"      : "unknown",
        "parameters"      : [],
        "diet_suggestions": {"en": [], "hi": [], "hinglish": []}
    }
    return {"llm_output": output}


# ============================================================
# NODE 8 — PRIMARY ANALYZER LLM (non-critical path only)
# ============================================================

def analyzer_node(state: State):
    """
    Generates summary + risk level + diet suggestions.
    Improved:
    - Summary now names every abnormal parameter with its actual value
    - Parameters array is forced to cover ALL extracted keys, not just "important" ones
    """
    prompt = ChatPromptTemplate.from_template("""
You are a calm, helpful medical assistant. Your job is to explain a medical report
to a patient in simple, friendly language. Never use scary or alarming words.
Never suggest any medication, drug, or supplement — only natural diet and lifestyle advice.

Medical report values (you received these from the report):
{data}

Standard reference ranges for this report type:
{ranges}

{history_context}

Task:
Analyze the report values above and generate a response with these exact fields:

1. summary
   An object with 3 keys: "en", "hi", "hinglish".
   Each must be 2-3 calm, friendly sentences.
   IMPORTANT: The summary MUST specifically mention every parameter that is outside
   its normal range — by name, with its actual value, and whether it is high or low.
   Example of a good summary: "Your PCV is slightly high at 57.5% and your Hemoglobin
   is slightly below the normal range at 12.5 g/dL. Your WBC, RBC, and Platelets are
   all within normal limits. Overall your report looks mostly normal with a couple of
   values worth keeping an eye on."
   If history is available, also mention the overall trend (improving/worsening/stable).

2. risk_level
   One of: normal | borderline | mild | critical

3. parameters
   An array of parameter objects.
   *** CRITICAL RULE: You MUST include one object for EVERY single key present in the
   "Medical report values" JSON above. Do NOT skip any parameter, even if its value
   is normal. If the report has 14 parameters, this array must have 14 objects. ***
   Each object must have:
   - parameter_name : the exact snake_case key from the report values JSON
   - status         : one of — normal | high | low | abnormal
                      (use "abnormal" for qualitative values that are not normal,
                       e.g. "Red" urine color or "Cloudy" appearance)
   - explanation    : object with keys "en", "hi", "hinglish" — explain in simple words:
                      (a) what this parameter measures
                      (b) what the patient's value means vs the reference range
                      (c) if history is available, mention the trend for this parameter
   - nutrition_guide: object with keys "en", "hi", "hinglish" — give specific, natural
                      diet or lifestyle tips to help this parameter. No medications.

4. diet_suggestions
   Object with keys "en", "hi", "hinglish", each a list of general safe dietary tips.
   Set all three to empty lists [] if risk_level is critical or mild.

Rules:
- Write all translations for "en", "hi", and "hinglish" in every field.
- Never use alarming, scary, or medical-jargon-heavy language.
- Never suggest any medication, pill, or supplement.
- For Hindi and Hinglish text, write directly in Unicode — no backslash escape sequences.
- Return ONLY a valid JSON object. No markdown fences, no explanation outside the JSON.
""")

    chain = prompt | llm
    response = call_llm_with_retry(chain, {
        "data"           : json.dumps(state["extracted_data"], indent=2),
        "ranges"         : REFERENCE_RANGES.get(state.get("report_type", "unknown"), REFERENCE_RANGES["unknown"]),
        "history_context": state.get("history_context", "")
    })

    output = parse_llm_json(response.content, "analyzer_node")

    if output is None:
        output = {
            "summary"         : {"en": "Analysis could not be completed. Please consult a doctor.", "hi": "विश्लेषण पूरा नहीं हो सका। कृपया डॉक्टर से सलाह लें।", "hinglish": "Analysis complete nahi ho saka. Please doctor se consult karein."},
            "risk_level"      : "unknown",
            "parameters"      : [],
            "diet_suggestions": {"en": [], "hi": [], "hinglish": []}
        }

    return {"llm_output": output}


# ============================================================
# NODE 9 — CRITIC LLM
# ============================================================

def critic_node(state: State):
    """
    Reviews the analyzer output for consistency and safety.
    Both {data} and {output} are now correctly declared in the template
    — this was the bug in the original version.
    """
    prompt = ChatPromptTemplate.from_template("""
You are a strict medical output reviewer.

Medical report data:
{data}

Generated analysis:
{output}

Check the following:
1. Is risk_level consistent with the actual numeric values?
2. Are global diet_suggestions empty lists when risk_level is critical or mild?
3. Is the tone calm — no panic, no alarming words?
4. Are all text fields objects with exactly 3 keys: "en", "hi", "hinglish"?

Return ONLY a valid JSON object, no markdown fences:
{{
  "is_valid": true or false,
  "safe"    : true or false,
  "issues"  : ["list any problems here, or empty list if none"]
}}
""")

    chain = prompt | llm
    response = call_llm_with_retry(chain, {
        "data"  : json.dumps(state["extracted_data"], indent=2),
        "output": json.dumps(state["llm_output"],     indent=2)
    })

    critic = parse_llm_json(response.content, "critic_node")

    if critic is None:
        critic = {
            "is_valid": False,
            "safe"    : False,
            "issues"  : ["Critic response could not be parsed"]
        }

    return {"critic_output": critic}


# ============================================================
# NODE 10 — FIX LLM
# ============================================================

def fix_node(state: State):
    """
    Attempts to correct the analyzer output based on critic issues.
    Tells the LLM to only fix the listed problems — keep the rest.
    """
    prompt = ChatPromptTemplate.from_template("""
The following analysis has some issues that need fixing.

Current analysis:
{output}

Problems to fix:
{issues}

Rules:
- Fix ONLY the listed problems — do not change anything else
- Keep the same JSON structure
- Return ONLY a valid JSON object, no markdown fences.
- - Write Hindi text directly in Unicode. Do NOT use backslash escape sequences inside string values.
""")

    chain = prompt | llm
    response = call_llm_with_retry(chain, {
        "output": json.dumps(state["llm_output"],              indent=2),
        "issues": json.dumps(state["critic_output"]["issues"], indent=2)
    })

    fixed = parse_llm_json(response.content, "fix_node")

    if fixed is None:
        # Keep the original if fix also fails
        fixed = state["llm_output"]
        logger.warning("[fix_node] Fix LLM failed — keeping original output")

    return {
        "llm_output": fixed,
        "retries"   : state["retries"] + 1
    }


# ============================================================
# ROUTING FUNCTIONS
# ============================================================

def route_after_extraction(state: State) -> str:
    """
    After extraction + validation, decide what to do next.
    - extraction_failed → report_failure  (no usable data)
    - else              → safety_gate     (check for critical values)
    """
    if state.get("extraction_failed") or not state.get("extracted_data"):
        return "report_failure"
    return "safety_gate"


def route_after_safety_gate(state: State) -> str:
    """
    After safety check, decide which analysis path to take.
    - is_critical=True  → blocked  (doctor referral only)
    - is_critical=False → confidence → analyze
    """
    if state["is_critical"]:
        return "blocked"
    return "confidence"


def route_after_critic(state: State) -> str:
    """
    After critic review, decide whether to finish or retry.
    - Valid + safe          → pass (done)
    - Issues but retries<2  → retry fix
    - Too many retries      → end anyway (avoid infinite loop)
    """
    critic = state["critic_output"]

    if critic["is_valid"] and critic["safe"]:
        return "pass"

    if state["retries"] < 2:
        return "retry"

    logger.warning("[critic] Max retries reached — ending with best available output")
    return "end"


# ============================================================
# BUILD LANGGRAPH
# ============================================================

builder = StateGraph(State)

# -- Register all nodes --
builder.add_node("ocr",                 ocr_node)
builder.add_node("clean",               cleaner_node)
builder.add_node("detect_and_extract",  detect_and_extract_node)   # merged node
builder.add_node("validate",            validation_node)
builder.add_node("safety_gate",         safety_gate_node)
builder.add_node("confidence",          confidence_node)
builder.add_node("blocked",             blocked_node)
builder.add_node("report_failure",      report_failure_node)
builder.add_node("analyze",             analyzer_node)
builder.add_node("critic",              critic_node)
builder.add_node("fix",                 fix_node)

# -- Entry point --
builder.set_entry_point("ocr")

# -- Linear edges --
builder.add_edge("ocr",                "clean")
builder.add_edge("clean",              "detect_and_extract")   # was: clean→detect_type→extract
builder.add_edge("detect_and_extract", "validate")

# -- After validation: route based on extraction success --
builder.add_conditional_edges(
    "validate",
    route_after_extraction,
    {
        "report_failure": "report_failure",
        "safety_gate"   : "safety_gate"
    }
)

# -- After safety gate: route based on critical flag --
builder.add_conditional_edges(
    "safety_gate",
    route_after_safety_gate,
    {
        "blocked"   : "blocked",
        "confidence": "confidence"
    }
)

# -- Non-critical path continues to analysis --
builder.add_edge("confidence", "analyze")
builder.add_edge("analyze", END)

# -- After critic: pass / retry / end --
builder.add_conditional_edges(
    "critic",
    route_after_critic,
    {
        "pass" : END,
        "retry": "fix",
        "end"  : END
    }
)

# -- Fix loops back to critic --
builder.add_edge("fix", "critic")

# -- Terminal nodes go straight to END --
builder.add_edge("blocked",        END)
builder.add_edge("report_failure", END)

# -- Compile --
graph = builder.compile()

print(graph)


# ============================================================
# RUN FUNCTION (called by FastAPI)
# ============================================================

def run_graph(file_bytes: bytes, language: str = "en", history_context: str = "") -> dict:
    """
    Entry point for FastAPI.
    Initialises state and invokes the graph.
    Returns the final state dict.
    """
    initial_state = {
        "file"             : file_bytes,
        "raw_text"         : "",
        "cleaned_text"     : "",
        "report_type"      : "unknown",
        "extracted_data"   : {},
        "extraction_failed": False,
        "validation_errors": [],
        "confidence"       : 0.0,
        "is_critical"      : False,
        "llm_output"       : {},
        "critic_output"    : {},
        "retries"          : 0,
        "language"         : language,
        "history_context"  : history_context
    }

    result = graph.invoke(initial_state)
    return result