@echo off
REM YT-Bot Full Stack Development Server
REM Starts both Comment Analyzer API and Next.js Frontend
REM ======================================================

echo ========================================
echo  YT-Bot Development Environment
echo ========================================
echo.
echo Starting services...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.10+ from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Python and Node.js found
echo.

REM Start Comment Analyzer API in a new window
echo [1/2] Starting Comment Analyzer API...
REM Load YOUTUBE_API_KEY from .env for the comment analyzer
for /f "tokens=1,* delims==" %%a in ('findstr /b "YOUTUBE_API_KEY" .env') do set "%%a=%%b"
REM Strip any surrounding quotes from the key
set YOUTUBE_API_KEY=%YOUTUBE_API_KEY:"=%

start "Comment Analyzer API - http://localhost:7860" cmd /k "set YOUTUBE_API_KEY=%YOUTUBE_API_KEY% && cd comment-analyzer && (if not exist venv (echo Creating virtual environment... && python -m venv venv)) && call venv\Scripts\activate && python setup_check.py && echo. && echo ========================================== && echo  Comment Analyzer API Server && echo  Running at: http://localhost:7860 && echo  API Docs: http://localhost:7860/docs && echo ========================================== && echo. && uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload"

REM Wait a bit for the API to start
timeout /t 3 /nobreak >nul

REM Start Next.js Frontend in a new window
echo [2/2] Starting Next.js Frontend...
start "Next.js Frontend - http://localhost:3000" cmd /k "echo Installing dependencies... && npm install && echo. && echo ========================================== && echo  Next.js Development Server && echo  Running at: http://localhost:3000 && echo  Comments Page: http://localhost:3000/comments && echo ========================================== && echo. && npm run dev"

echo.
echo ========================================
echo  Both services are starting!
echo ========================================
echo.
echo Comment Analyzer API: http://localhost:7860
echo API Documentation:    http://localhost:7860/docs
echo Next.js Frontend:     http://localhost:3000
echo Comments Page:        http://localhost:3000/comments
echo.
echo Two terminal windows have been opened.
echo Close those windows to stop the servers.
echo.
pause
