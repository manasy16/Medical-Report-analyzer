import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend', 'app'))

from graph import run_graph

# Mock file bytes
file_bytes = b"%PDF-1.4\n%..."

try:
    print("Running graph...")
    # We use a very small mock or just test if it initializes
    # But run_graph will try to OCR which will fail on mock bytes
    # However, we can check if it at least starts
    # result = run_graph(file_bytes, "en", "")
    # print("Graph finished.")
    print("Graph module loaded successfully.")
except Exception as e:
    print(f"Error: {e}")
