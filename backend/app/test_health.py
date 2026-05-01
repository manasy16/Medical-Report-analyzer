import requests

try:
    resp = requests.get("http://127.0.0.1:8000/health")
    print(f"Status: {resp.status_code}")
    print(f"Body: {resp.json()}")
except Exception as e:
    print(f"Error: {e}")
