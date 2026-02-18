@echo off
echo Starting YouTube Comment Analyzer API (Local Development)
echo.

cd /d "%~dp0"

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

REM Download NLTK data
echo Downloading NLTK data...
python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

REM Start the server
echo.
echo Starting server on http://localhost:7860
echo Press Ctrl+C to stop
echo.
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
