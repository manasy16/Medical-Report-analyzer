# ============================================================
# BLOOD REPORT ANALYZER — graph.py
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
from langchain_core.prompts import ChatPromptTemplate

import os
os.environ["POPPLER_PATH"]   = "C:/poppler-25.12.0/Library/bin"
os.environ["TESSERACT_PATH"] = "C:/Program Files/Tesseract-OCR/tesseract.exe"
 
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
from dotenv import load_dotenv
 
# ── Load .env ────────────────────────────────────────────────
load_dotenv()

print("=" * 50)
print(f"POPPLER_PATH  : {os.getenv('POPPLER_PATH')}")
print(f"TESSERACT_PATH: {os.getenv('TESSERACT_PATH')}")
print("=" * 50)

 
# ── Logger (replaces silent except blocks) ──────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
 
# ── Read paths from .env (None = already in system PATH) ────
POPPLER_PATH  = os.getenv("POPPLER_PATH")  or None
TESSERACT_PATH = os.getenv("TESSERACT_PATH") or None
 
# Tell Tesseract where its executable is (only if provided)
if TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
 
# ── Reference ranges used by the analyzer prompt ────────────
# Keeping these here so you can easily adjust them
REFERENCE_RANGES = """
- Hemoglobin : 12.0–17.5 g/dL  (varies by sex)
- RBC        : 4.1–5.9  million/µL
- WBC        : 4,000–11,000 /µL
- Platelets  : 1,50,000–4,00,000 /µL
"""
 
# ── LLM setup ────────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0
)
 
 
# ============================================================
# STATE
# ============================================================
 
class State(TypedDict):
    file             : bytes
    raw_text         : str
    cleaned_text     : str
    extracted_data   : dict
    extraction_failed: bool          # True if LLM/parse failed
    validation_errors: list
    confidence       : float
    is_critical      : bool          # Set by safety_gate_node
    llm_output       : dict
    critic_output    : dict
    retries          : int
 
 
# ============================================================
# HELPER — strip markdown fences Gemini sometimes adds
# ============================================================
 
def parse_llm_json(raw: str, node_name: str) -> Optional[dict]:
    """
    Safely parse JSON from LLM response.
    Strips ```json ... ``` fences if present.
    Returns None on failure (caller must handle it).
    """
    try:
        text = raw.strip()
        # Remove markdown fences like ```json ... ```
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
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
        images = convert_from_bytes(file_bytes, poppler_path=POPPLER_PATH)
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
# NODE 3 — STRUCTURED EXTRACTION (LLM)
# ============================================================
 
def extraction_node(state: State):
    """
    Ask the LLM to pull out blood values as structured JSON.
    Sets extraction_failed=True if parsing breaks — downstream
    nodes check this flag before proceeding.
    """
    prompt = ChatPromptTemplate.from_template("""
Extract blood report values from the text below.
 
Text:
{input}
 
Rules:
- Return ONLY a valid JSON object — no explanation, no markdown fences
- If a value is not present in the text, set it to null
- Do NOT guess or invent values
 
Required format:
{{
  "hemoglobin" : {{"value": number or null, "unit": "g/dL"}},
  "rbc"        : {{"value": number or null, "unit": "million/µL"}},
  "wbc"        : {{"value": number or null, "unit": "/µL"}},
  "platelets"  : {{"value": number or null, "unit": "/µL"}}
}}
""")
 
    chain = prompt | llm
    response = chain.invoke({"input": state["cleaned_text"]})
 
    data = parse_llm_json(response.content, "extraction_node")
 
    if data is None:
        # Extraction failed — flag it so we can route to failure node
        return {
            "extracted_data"   : {},
            "extraction_failed": True
        }
 
    return {
        "extracted_data"   : data,
        "extraction_failed": False
    }
 
 
# ============================================================
# NODE 4 — VALIDATION
# ============================================================
 
def validation_node(state: State):
    """
    Rule-based sanity checks on extracted values.
    Catches obviously impossible numbers before the LLM sees them.
    """
    data   = state["extracted_data"]
    errors = []
 
    hb = data.get("hemoglobin", {}).get("value")
    if hb is not None and not (0 < hb < 25):
        errors.append(f"Hemoglobin value {hb} is outside possible range (0–25 g/dL)")
 
    wbc = data.get("wbc", {}).get("value")
    if wbc is not None and not (0 < wbc < 100_000):
        errors.append(f"WBC value {wbc} is outside possible range")
 
    platelets = data.get("platelets", {}).get("value")
    if platelets is not None and not (0 < platelets < 1_500_000):
        errors.append(f"Platelets value {platelets} is outside possible range")
 
    if errors:
        logger.warning("[validation_node] Errors: %s", errors)
 
    return {"validation_errors": errors}
 
 
# ============================================================
# NODE 5 — SAFETY GATE  ← NEW (was post-graph, now in-graph)
# ============================================================
 
def safety_gate_node(state: State):
    """
    Checks if any value is in the critical/dangerous range.
    Sets is_critical=True — the graph routes to a blocked node
    instead of the analyzer, so NO diet advice is ever generated
    for critical reports.
    """
    data = state["extracted_data"]
 
    hb        = data.get("hemoglobin", {}).get("value")
    platelets = data.get("platelets",  {}).get("value")
 
    # Hemoglobin below 7 or platelets below 50,000 = critical
    is_critical = (
        (hb        is not None and hb        < 7)      or
        (platelets is not None and platelets < 50_000)
    )
 
    if is_critical:
        logger.warning("[safety_gate_node] CRITICAL values detected — blocking advice")
 
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
        "summary"         : (
            "Some values in your report may need medical attention. "
            "Please consult a qualified doctor at the earliest."
        ),
        "risk_level"      : "critical",
        "diet_suggestions": []   # Always empty for critical reports
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
        "summary"         : (
            "We were unable to read the values from your report. "
            "Please try uploading a clearer image or a text-based PDF."
        ),
        "risk_level"      : "unknown",
        "diet_suggestions": []
    }
    return {"llm_output": output}
 
 
# ============================================================
# NODE 8 — PRIMARY ANALYZER LLM (non-critical path only)
# ============================================================
 
def analyzer_node(state: State):
    """
    Generates summary + risk level + diet suggestions.
    Only reached when is_critical=False.
    Reference ranges are injected so the LLM doesn't guess.
    """
    prompt = ChatPromptTemplate.from_template("""
You are a calm, helpful medical assistant.
 
Blood report values:
{data}
 
Standard reference ranges:
{ranges}
 
Generate a response with these fields:
- summary         : 2–3 sentences, simple language, no panic
- risk_level      : one of — normal | borderline | mild | critical
- diet_suggestions: list of safe general suggestions (empty list if risk is high)
 
Rules:
- If risk_level is critical or mild, set diet_suggestions to []
- Never use alarming language
- If anything looks concerning, recommend seeing a doctor
 
Return ONLY a valid JSON object, no markdown fences.
""")
 
    chain = prompt | llm
    response = chain.invoke({
        "data"  : json.dumps(state["extracted_data"], indent=2),
        "ranges": REFERENCE_RANGES
    })
 
    output = parse_llm_json(response.content, "analyzer_node")
 
    if output is None:
        output = {
            "summary"         : "Analysis could not be completed. Please consult a doctor.",
            "risk_level"      : "unknown",
            "diet_suggestions": []
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
 
Blood report data:
{data}
 
Generated analysis:
{output}
 
Check the following:
1. Is risk_level consistent with the actual numeric values?
2. Are diet_suggestions empty when risk_level is critical or mild?
3. Is the tone calm — no panic, no alarming words?
 
Return ONLY a valid JSON object, no markdown fences:
{{
  "is_valid": true or false,
  "safe"    : true or false,
  "issues"  : ["list any problems here, or empty list if none"]
}}
""")
 
    chain = prompt | llm
    response = chain.invoke({
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
- Return ONLY a valid JSON object, no markdown fences
""")
 
    chain = prompt | llm
    response = chain.invoke({
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
builder.add_node("ocr",            ocr_node)
builder.add_node("clean",          cleaner_node)
builder.add_node("extract",        extraction_node)
builder.add_node("validate",       validation_node)
builder.add_node("safety_gate",    safety_gate_node)
builder.add_node("confidence",     confidence_node)
builder.add_node("blocked",        blocked_node)
builder.add_node("report_failure", report_failure_node)
builder.add_node("analyze",        analyzer_node)
builder.add_node("critic",         critic_node)
builder.add_node("fix",            fix_node)
 
# -- Entry point --
builder.set_entry_point("ocr")
 
# -- Linear edges --
builder.add_edge("ocr",   "clean")
builder.add_edge("clean", "extract")
builder.add_edge("extract", "validate")
 
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
builder.add_edge("analyze",    "critic")
 
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
 
def run_graph(file_bytes: bytes) -> dict:
    """
    Entry point for FastAPI.
    Initialises state and invokes the graph.
    Returns the final state dict.
    """
    initial_state = {
        "file"            : file_bytes,
        "raw_text"        : "",
        "cleaned_text"    : "",
        "extracted_data"  : {},
        "extraction_failed": False,
        "validation_errors": [],
        "confidence"      : 0.0,
        "is_critical"     : False,
        "llm_output"      : {},
        "critic_output"   : {},
        "retries"         : 0
    }
 
    result = graph.invoke(initial_state)
    return result