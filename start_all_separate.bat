@echo off
title Launch Services (Separate Windows)
cd /d "%~dp0"

echo ===================================================
echo   Launching Flask, FastAPI, and Frontend in separate windows...
echo ===================================================

set PYTHON_EXEC=python
if exist venv\Scripts\python.exe set PYTHON_EXEC="%~dp0venv\Scripts\python.exe"

REM 1. Start Flask Backend (Port 8081)
start "Flask Backend (Port 8081)" cmd /k "%PYTHON_EXEC% server.py"

REM 2. Start FastAPI Interviewer (Port 8000)
start "FastAPI Interviewer (Port 8000)" cmd /k "cd /d "%~dp0interviewer" && %PYTHON_EXEC% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

REM 3. Start React Frontend (Port 3000)
start "React Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm start"

echo All 3 service windows launched!
