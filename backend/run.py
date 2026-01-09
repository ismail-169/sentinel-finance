
import sys
import os
import subprocess
import argparse
from pathlib import Path

BACKEND_DIR = Path(__file__).parent

def run_api(host="0.0.0.0", port=8000, reload=False):
    cmd = [
        sys.executable, "-m", "uvicorn",
        "api:app",
        "--host", host,
        "--port", str(port)
    ]
    if reload:
        cmd.append("--reload")
    
    print(f"Starting API server on {host}:{port}")
    subprocess.run(cmd, cwd=BACKEND_DIR)

def run_watchdog():
    print("Starting watchdog service")
    subprocess.run([sys.executable, "watchdog.py"], cwd=BACKEND_DIR)

def run_tests(verbose=False):
    cmd = [sys.executable, "-m", "pytest", "test_backend.py"]
    if verbose:
        cmd.append("-v")
    print("Running tests")
    subprocess.run(cmd, cwd=BACKEND_DIR)

def init_database():
    print("Initializing database")
    subprocess.run([sys.executable, "-c", "from database import init_db; init_db(); print('Done')"], cwd=BACKEND_DIR)

def generate_secrets():
    import secrets as sec
    print("\nGenerated Secrets (add to .env):\n")
    print(f"API_SECRET={sec.token_hex(32)}")
    print(f"JWT_SECRET={sec.token_hex(32)}")
    
    try:
        from cryptography.fernet import Fernet
        print(f"DB_ENCRYPTION_KEY={Fernet.generate_key().decode()}")
    except ImportError:
        print("# Install cryptography for DB_ENCRYPTION_KEY")

def check_health():
    import urllib.request
    import json
    
    try:
        with urllib.request.urlopen("http://localhost:8000/health", timeout=5) as response:
            data = json.loads(response.read().decode())
            print("API Status:", data.get("status"))
            print("Blockchain:", "Connected" if data.get("blockchain_connected") else "Disconnected")
            print("Contract:", "Loaded" if data.get("contract_loaded") else "Not Loaded")
    except Exception as e:
        print(f"Health check failed: {e}")

def backup_database(output_path=None):
    from datetime import datetime
    from database import backup_database as db_backup
    
    if not output_path:
        output_path = f"sentinel_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    
    if db_backup(output_path):
        print(f"Database backed up to: {output_path}")
    else:
        print("Backup failed")

def main():
    parser = argparse.ArgumentParser(description="Sentinel Finance Backend Manager")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    api_parser = subparsers.add_parser("api", help="Run the API server")
    api_parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    api_parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    api_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    subparsers.add_parser("watchdog", help="Run the watchdog service")
    
    test_parser = subparsers.add_parser("test", help="Run tests")
    test_parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    
    subparsers.add_parser("init", help="Initialize database")
    subparsers.add_parser("secrets", help="Generate new secrets")
    subparsers.add_parser("health", help="Check API health")
    
    backup_parser = subparsers.add_parser("backup", help="Backup database")
    backup_parser.add_argument("-o", "--output", help="Output file path")
    
    args = parser.parse_args()
    
    if args.command == "api":
        run_api(args.host, args.port, args.reload)
    elif args.command == "watchdog":
        run_watchdog()
    elif args.command == "test":
        run_tests(args.verbose)
    elif args.command == "init":
        init_database()
    elif args.command == "secrets":
        generate_secrets()
    elif args.command == "health":
        check_health()
    elif args.command == "backup":
        backup_database(args.output)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()