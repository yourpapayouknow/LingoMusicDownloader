import os
import subprocess
import urllib.request
import zipfile
import sys


def check_wsl_installed() -> bool:
    """Return True if WSL is installed and accessible on this system."""
    try:
        result = subprocess.run(
            ["wsl", "--status"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        # wsl --status returns 0 even on WSL 1; any non-FileNotFoundError means it exists
        return True
    except FileNotFoundError:
        return False
    except subprocess.TimeoutExpired:
        return True  # Command exists, just slow to respond


def prompt_install_wsl() -> None:
    """Print WSL installation instructions and exit."""
    print()
    print("=" * 60)
    print("  ERROR: WSL2 is not installed on this system.")
    print("=" * 60)
    print()
    print("  WSL2 is required to run the Apple Music Wrapper.")
    print("  Please install it by following these steps:")
    print()
    print("  1. Open PowerShell as Administrator.")
    print("  2. Run:  wsl --install")
    print("  3. Restart your computer when prompted.")
    print("  4. Run this script again after restarting.")
    print()
    input("  Press Enter to exit...")


def setup_wsl_wrapper() -> None:
    # ── Step 1: Verify WSL is available ───────────────────────
    if not check_wsl_installed():
        prompt_install_wsl()
        return

    print("[OK] WSL is available.")

    # ── Step 2: Resolve paths ──────────────────────────────────
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    wrapper_dir = os.path.join(base_dir, "backend", "wsl_wrapper")
    os.makedirs(wrapper_dir, exist_ok=True)

    wrapper_binary = os.path.join(wrapper_dir, "wrapper")

    # ── Step 3: Download wrapper binary if missing ─────────────
    if not os.path.exists(wrapper_binary):
        print("Downloading Wrapper binary for WSL...")
        url = (
            "https://github.com/WorldObservationLog/wrapper/releases/download/"
            "wrapper.x86_64.latest/Wrapper.x86_64.latest.zip"
        )
        zip_path = os.path.join(wrapper_dir, "wrapper.zip")
        try:
            urllib.request.urlretrieve(url, zip_path)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(wrapper_dir)
            os.remove(zip_path)
            print("[OK] Wrapper downloaded successfully.")
        except Exception as e:
            print(f"[ERROR] Failed to download wrapper: {e}")
            return
    else:
        print("[OK] Wrapper binary already exists, skipping download.")

    # ── Step 4: Set execute permission via WSL ─────────────────
    # Convert Windows path → WSL path  (e.g. F:\Foo\Bar → /mnt/f/Foo/Bar)
    drive = wrapper_dir[0].lower()
    wsl_path = f"/mnt/{drive}/" + wrapper_dir[3:].replace("\\", "/")

    print("Setting execute permissions via WSL...")
    subprocess.run(["wsl", "-e", "bash", "-c", f"chmod +x '{wsl_path}/wrapper'"])
    print(f"[OK] Permissions set.")

    # ── Step 5: First-run login ────────────────────────────────
    rootfs_dir = os.path.join(wrapper_dir, "rootfs")
    is_first_run = (
        not os.path.exists(rootfs_dir)
        or not any(os.scandir(rootfs_dir))
    )

    if is_first_run:
        print()
        print("=" * 60)
        print("  First-time setup: Apple ID login required.")
        print("=" * 60)
        print("  The Wrapper needs to authenticate with Apple Music.")
        print("  A 2FA prompt may appear — complete it in the terminal.")
        print()
        apple_id = input("  Enter your Apple ID (email): ").strip()
        apple_pw = input("  Enter your Apple ID password: ").strip()
        print()
        print("  Logging in... (complete any 2FA prompt below)")
        login_cmd = f"cd '{wsl_path}' && ./wrapper -L '{apple_id}:{apple_pw}' -H 0.0.0.0"
        subprocess.run(["wsl", "-e", "bash", "-c", login_cmd])
    else:
        print("[OK] Session data found. No login needed.")

    print()
    print("=" * 60)
    print("  Setup complete!")
    print("  Run 'launch.ps1' or the Desktop shortcut to start the app.")
    print("=" * 60)
    input("  Press Enter to exit...")


if __name__ == "__main__":
    setup_wsl_wrapper()
