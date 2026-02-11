import json
import subprocess
import sys
import os

# Set working directory to project root (parent of this script's directory)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)

def load_config():
    # Config is expected to be in deploy/deploy.json or deploy.json
    possible_paths = ['deploy/deploy.json', 'deploy.json']
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
    print(f"Error: deploy.json not found in {os.getcwd()}")
    sys.exit(1)

def run_command(command):
    print(f"Running: {command}")
    try:
        subprocess.run(command, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        sys.exit(1)

def main():
    config = load_config()

    remote_host = config['remote_host']
    remote_user = config['remote_user']
    remote_dir = config['remote_dir']
    key_path = config['wsl_key_path']

    remote = f"{remote_user}@{remote_host}"
    ssh_opts = f"-o StrictHostKeyChecking=no -i {key_path}"
    
    print(f"--- Deployment Target: {remote}:{remote_dir} ---")

    # Workaround for WSL permissions on NTFS mounts: Copy key to tmp and chmod
    import shutil
    import atexit
    
    tmp_key_path = f"/tmp/deploy_key_{os.getpid()}"
    print(f"--- Setting up temporary SSH key at {tmp_key_path} ---")
    
    try:
        shutil.copy(key_path, tmp_key_path)
        os.chmod(tmp_key_path, 0o600)
    except Exception as e:
        print(f"Error preparing SSH key: {e}")
        # Try to clean up if partial failure
        if os.path.exists(tmp_key_path):
            os.remove(tmp_key_path)
        sys.exit(1)

    # Register cleanup
    def cleanup_key():
        if os.path.exists(tmp_key_path):
            os.remove(tmp_key_path)
    atexit.register(cleanup_key)

    ssh_opts = f"-o StrictHostKeyChecking=no -i {tmp_key_path}"

    print("\n--- 1. Prepare Remote Directory ---")
    run_command(f"ssh {ssh_opts} {remote} \"mkdir -p {remote_dir}\"")

    print("\n--- 2. Sync Minimum Necessary Files ---")
    # Exclude build artifacts, git history, and other unnecessary files
    excludes = [
        "--exclude '.git'",
        "--exclude '.github'",
        "--exclude '.idea'",
        "--exclude '.vscode'",
        "--exclude 'node_modules'",
        "--exclude 'dist'",
        "--exclude '.parcel-cache'",
        "--exclude '.cache'",
        "--exclude 'coverage'",
        "--exclude 'deploy'", # The deployment scripts themselves aren't needed on remote
        "--exclude 'deploy.json'",
        "--exclude 'deploy.sh'",
        "--exclude 'test'",
        "--exclude 'LICENSE*'",
        "--exclude '*.md'",
        "--exclude '.gitignore'",
        "--exclude '.eslintrc.cjs'",
        "--exclude '*.log'",
        "--exclude '.DS_Store'",
        "--exclude 'data'" # Protect data directory from being deleted by rsync
    ]
    exclude_str = " ".join(excludes)
    
    # Use rsync to transfer files
    # -a: archive mode (preserves permissions, etc)
    # -v: verbose
    # -z: compress
    # --delete: remove files on remote that are not in local
    # Note: We do NOT use --delete-excluded to avoid risking data loss if filters aren't perfect.
    # We instead explicitly remove unwanted files that might have been transferred previously.
    rsync_cmd = f"rsync -avz --delete {exclude_str} -e \"ssh {ssh_opts}\" ./ {remote}:{remote_dir}/"
    run_command(rsync_cmd)

    print("\n--- 2.5. Cleanup Unnecessary Files on Remote ---")
    # Explicitly remove files that should not be there (cleanup from previous runs)
    cleanup_files = [
        "deploy", "deploy.json", "deploy.sh", "test", 
        "LICENSE*", "*.md", ".gitignore", ".eslintrc.cjs"
    ]
    cleanup_cmd = f"cd {remote_dir} && rm -rf {' '.join(cleanup_files)}"
    run_command(f"ssh {ssh_opts} {remote} \"{cleanup_cmd}\"")

    print("\n--- 3. Build and Start Application on Remote ---")
    remote_cmds = [
        f"cd {remote_dir}",
        # Build and start the containers
        "docker compose down",
        "docker compose up -d --build",
        "docker system prune -f"
    ]
    
    run_command(f"ssh {ssh_opts} {remote} \"{' && '.join(remote_cmds)}\"")

    print("\n--- Deployment Complete ---")


if __name__ == "__main__":
    main()
