import sys
import os
import shutil
import subprocess
import threading
from pathlib import Path

RESET = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"

ROOT_DIR = Path(__file__).resolve().parent

def get_python_executable():
    venv_windows = ROOT_DIR / "venv" / "Scripts" / "python.exe"
    venv_posix = ROOT_DIR / "venv" / "bin" / "python"
    
    if venv_windows.exists():
        return str(venv_windows)
    if venv_posix.exists():
        return str(venv_posix)
    return sys.executable


def get_npm_command():
    if sys.platform.startswith("win"):
        npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
        return npm_cmd or "npm.cmd"
    return shutil.which("npm") or "npm"


def stream_logs(proc, prefix, color):
    try:
        for line in iter(proc.stdout.readline, ""):
            if not line:
                break
            print(f"{color}{BOLD}[{prefix}]{RESET} {line.rstrip()}", flush=True)
    except Exception:
        pass


def kill_proc_tree(proc):
    if proc is None:
        return
    try:
        import psutil
        parent = psutil.Process(proc.pid)
        for child in parent.children(recursive=True):
            try:
                child.terminate()
            except Exception:
                pass
        parent.terminate()
        parent.wait(timeout=3)
    except Exception:
        try:
            if sys.platform.startswith("win"):
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            else:
                proc.terminate()
        except Exception:
            pass


def main():
    python_exe = get_python_executable()
    npm_cmd = get_npm_command()

    print(f"\n{BOLD}{MAGENTA}===================================================={RESET}")
    print(f"{BOLD}{MAGENTA}     🚀  Starting All Development Services          {RESET}")
    print(f"{BOLD}{MAGENTA}===================================================={RESET}")
    print(f"  • {CYAN}Flask Backend{RESET}      : http://localhost:8081")
    print(f"  • {MAGENTA}FastAPI Interviewer{RESET}: http://localhost:8000")
    print(f"  • {GREEN}React Frontend{RESET}     : http://localhost:3000")
    print(f"  • Using Python     : {python_exe}")
    print(f"  • Using npm        : {npm_cmd}")
    print(f"{BOLD}{YELLOW}Press Ctrl+C at any time to gracefully stop all services.{RESET}\n")

    services = [
        {
            "name": "Flask",
            "color": CYAN,
            "cwd": ROOT_DIR,
            "cmd": [python_exe, "server.py"],
            "env": {**os.environ, "FLASK_ENV": "development", "PYTHONUNBUFFERED": "1"}
        },
        {
            "name": "FastAPI",
            "color": MAGENTA,
            "cwd": ROOT_DIR / "interviewer",
            "cmd": [python_exe, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            "env": {**os.environ, "PYTHONUNBUFFERED": "1"}
        },
        {
            "name": "Frontend",
            "color": GREEN,
            "cwd": ROOT_DIR / "frontend",
            "cmd": [npm_cmd, "start"],
            "env": {**os.environ, "BROWSER": "none"}
        }
    ]

    running_procs = []

    try:
        for s in services:
            print(f"{s['color']}Starting {s['name']} in {s['cwd']}...{RESET}")
            proc = subprocess.Popen(
                s["cmd"],
                cwd=str(s["cwd"]),
                env=s["env"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                shell=(s["name"] == "Frontend" and sys.platform.startswith("win"))
            )
            running_procs.append(proc)

            thread = threading.Thread(
                target=stream_logs,
                args=(proc, s["name"], s["color"]),
                daemon=True
            )
            thread.start()

        for proc in running_procs:
            proc.wait()

    except KeyboardInterrupt:
        print(f"\n{BOLD}{YELLOW}Shutdown signal received (Ctrl+C). Terminating all services...{RESET}")
    finally:
        for proc in running_procs:
            kill_proc_tree(proc)
        print(f"{BOLD}{GREEN}All services successfully stopped. Bye! 👋{RESET}")


if __name__ == "__main__":
    main()
