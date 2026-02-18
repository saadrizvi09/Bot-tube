@echo off
REM Start Comment Analyzer API only (no frontend)
REM ================================================

echo ========================================
echo  Comment Analyzer API Server
echo ========================================
echo.

cd /d "%~dp0\comment-analyzer"

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.10+ from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate

REM Run setup check (installs dependencies only if needed)
python setup_check.py

REM Start the server
echo.
echo ==========================================
echo  API Server: http://localhost:7860
echo  API Docs:   http://localhost:7860/docs
echo ==========================================
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
