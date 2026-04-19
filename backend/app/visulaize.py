# ============================================================
# VISUALIZE LANGGRAPH — visualize_graph.py
# Run this file directly: python visualize_graph.py
# Works outside Jupyter — opens graph in your browser
# ============================================================
 
from graph import graph   # import your compiled graph
 
# ── Option 1: Print Mermaid diagram code in terminal ────────
print("=" * 60)
print("MERMAID DIAGRAM CODE")
print("Paste this at https://mermaid.live to see the graph")
print("=" * 60)
print(graph.get_graph().draw_mermaid())
 
 
# ── Option 2: Save as PNG image (needs pip install pygraphviz OR playwright) ──
# Uncomment the method that works for you
 
# --- Method A: PNG via Mermaid + Playwright ---
# pip install playwright && playwright install chromium
try:
    png_bytes = graph.get_graph().draw_mermaid_png()
    with open("graph.png", "wb") as f:
        f.write(png_bytes)
    print("\n graph.png saved — open it to see the diagram")
except Exception as e:
    print(f"\n PNG export failed ({e})")
    print("Run: pip install playwright && playwright install chromium")
 
 
# ── Option 3: Open Mermaid diagram directly in browser ──────
import webbrowser, urllib.parse
 
mermaid_code = graph.get_graph().draw_mermaid()
 
# Mermaid.live accepts the diagram as a base64-encoded URL param
import base64, json
 
state = {"code": mermaid_code, "mermaid": {"theme": "default"}}
encoded = base64.urlsafe_b64encode(
    json.dumps(state).encode()
).decode()
 
url = f"https://mermaid.live/edit#{encoded}"
print("\nOpening graph in browser...")
webbrowser.open(url)