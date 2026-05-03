import os
import subprocess
import urllib.request
import zipfile
import shutil

def setup_wsl_wrapper():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    wrapper_dir = os.path.join(base_dir, "backend", "wsl_wrapper")
    os.makedirs(wrapper_dir, exist_ok=True)
    
    zip_path = os.path.join(wrapper_dir, "wrapper.zip")
    url = "https://github.com/WorldObservationLog/wrapper/releases/download/wrapper.x86_64.latest/Wrapper.x86_64.latest.zip"
    
    if not os.path.exists(os.path.join(wrapper_dir, "wrapper")):
        print("Downloading Wrapper for WSL...")
        try:
            urllib.request.urlretrieve(url, zip_path)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(wrapper_dir)
            os.remove(zip_path)
            print("Wrapper downloaded.")
        except Exception as e:
            print(f"Error downloading wrapper: {e}")
            return
            
    # Set execution permissions using WSL
    # Convert windows path to wsl path
    wsl_path = wrapper_dir.replace('\\', '/').replace('C:', '/mnt/c').replace('F:', '/mnt/f')
    subprocess.run(["wsl", "-e", "bash", "-c", f"chmod +x {wsl_path}/wrapper"])
    
    # Create a helper script
    run_script = os.path.join(base_dir, "run_wsl_wrapper.bat")
    with open(run_script, "w") as f:
        f.write(f"""@echo off
set /p APPLE_ID="Enter your Apple ID: "
set /p APPLE_PW="Enter your Apple ID Password: "
echo Starting Wrapper in WSL...
wsl -e bash -c "cd {wsl_path} && ./wrapper -L \\"%APPLE_ID%:%APPLE_PW%\\" -H 0.0.0.0"
pause
""")
    print("Setup complete. You can run the wrapper via 'run_wsl_wrapper.bat'.")

if __name__ == "__main__":
    setup_wsl_wrapper()
