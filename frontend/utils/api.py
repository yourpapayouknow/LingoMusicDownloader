import requests
import logging

BASE_URL = "http://127.0.0.1:8000/api"

def submit_download(url: str):
    """Submit an Apple Music URL to the backend for downloading."""
    try:
        response = requests.post(f"{BASE_URL}/download", json={"url": url})
        if response.status_code == 200:
            return True, "Download submitted successfully!"
        else:
            error_detail = response.json().get("detail", "Unknown error")
            return False, f"Failed: {error_detail}"
    except requests.exceptions.ConnectionError:
        return False, "Could not connect to the backend server. Is it running?"
    except Exception as e:
        return False, f"Error: {e}"

def get_status():
    """Fetch the current download status from the backend."""
    try:
        response = requests.get(f"{BASE_URL}/status")
        if response.status_code == 200:
            return True, response.json()
        return False, {}
    except requests.exceptions.ConnectionError:
        return False, {"error": "Backend offline"}
    except Exception as e:
        return False, {"error": str(e)}
