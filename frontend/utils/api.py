import requests
import logging

BASE_URL = "http://127.0.0.1:8000/api"

def submit_download(url: str, codec: str = "aac-legacy", video_resolution: str = "1080p", use_wrapper: bool = False):
    """Submit an Apple Music URL to the backend for downloading."""
    try:
        payload = {
            "url": url,
            "codec": codec,
            "video_resolution": video_resolution,
            "use_wrapper": use_wrapper
        }
        response = requests.post(f"{BASE_URL}/download", json=payload)
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

def search_apple_music(term: str):
    """Search Apple Music."""
    try:
        response = requests.get(f"{BASE_URL}/search", params={"term": term})
        if response.status_code == 200:
            return True, response.json().get("results", {})
        else:
            error_detail = response.json().get("detail", "Unknown error")
            return False, error_detail
    except requests.exceptions.ConnectionError:
        return False, "Could not connect to the backend server."
    except Exception as e:
        return False, f"Error: {e}"
