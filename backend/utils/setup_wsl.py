import os
import subprocess
import urllib.request
import zipfile


def check_wsl_installed() -> bool:
    """Return True if WSL is installed and accessible on this system."""
    try:
        subprocess.run(
            ["wsl", "--status"],
            capture_output=True,
            timeout=15,
        )
        return True
    except FileNotFoundError:
        return False
    except subprocess.TimeoutExpired:
        return True  # Command exists, just slow


def prompt_install_wsl() -> None:
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
    base_dir = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    wrapper_dir = os.path.join(base_dir, "backend", "wsl_wrapper")
    os.makedirs(wrapper_dir, exist_ok=True)

    wrapper_binary = os.path.join(wrapper_dir, "wrapper")
    session_marker = os.path.join(wrapper_dir, ".session_ready")

    # Convert Windows path → WSL path  (e.g. F:\Foo\Bar → /mnt/f/Foo/Bar)
    drive = wrapper_dir[0].lower()
    wsl_path = f"/mnt/{drive}/" + wrapper_dir[3:].replace("\\", "/")

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
    print("Setting execute permissions via WSL...")
    subprocess.run(
        ["wsl", "-e", "bash", "-c", f"chmod +x '{wsl_path}/wrapper'"],
        capture_output=True,
    )
    print("[OK] Permissions set.")

    # ── Step 5: Apple ID login ─────────────────────────────────
    # Always perform login in the setup script — the user is explicitly
    # setting up the Wrapper and expects to authenticate here.
    print()
    print("=" * 60)
    print("  Apple ID Login")
    print("=" * 60)
    print("  The Wrapper needs to authenticate with Apple Music.")
    print("  All output from the Wrapper will appear below.")
    print("  If a 2FA prompt appears, follow the on-screen instructions.")
    print()
    print("  NOTE: After a successful login the Wrapper will start")
    print("        serving on ports 10020/20020/30020.")
    print("        Press Ctrl+C once you see it running to stop it.")
    print("        Your login session will be saved for future use.")
    print("=" * 60)
    print()

    apple_id = input("  Enter your Apple ID (email): ").strip()
    apple_pw = input("  Enter your Apple ID password: ").strip()

    print()
    print("  Starting Wrapper — output below:")
    print("-" * 60)

    login_cmd = (
        f"cd '{wsl_path}' && ./wrapper -L '{apple_id}:{apple_pw}' -H 0.0.0.0"
    )
    try:
        # Run WITHOUT capturing output: stdin/stdout/stderr are inherited from
        # this terminal so the user sees all output and can respond to 2FA.
        subprocess.run(["wsl", "-e", "bash", "-c", login_cmd])
    except KeyboardInterrupt:
        # User pressed Ctrl+C after confirming the Wrapper is running — expected.
        pass

    print()
    print("-" * 60)

    # ── Step 6: Mark session as ready ─────────────────────────
    # Write a marker file so launch.ps1 knows login has been completed.
    try:
        with open(session_marker, "w") as f:
            f.write("session_ready")
        print("[OK] Session marker saved.")
    except Exception as e:
        print(f"[WARN] Could not write session marker: {e}")

    print()
    print("=" * 60)
    print("  Setup complete!")
    print("  Run 'launch.ps1' or the Desktop shortcut to start the app.")
    print("=" * 60)
    input("  Press Enter to exit...")


if __name__ == "__main__":
    setup_wsl_wrapper()
