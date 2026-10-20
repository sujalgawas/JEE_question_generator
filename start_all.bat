@echo off
title Launch All Services
cd /d "%~dp0"

echo ===================================================
echo   Starting Flask, FastAPI Interviewer, and Frontend
echo ===================================================

if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe run_all.py
) else (
    python run_all.py
)

pause
