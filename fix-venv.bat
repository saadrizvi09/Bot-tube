@echo off
REM Fix Virtual Environment - Recreate it properly
REM ===============================================

echo ========================================
echo  Virtual Environment Fix
echo ========================================
echo.

cd /d "%~dp0\comment-analyzer"

echo This will recreate your virtual environment to fix the installation issue.
echo.
pause

REM Deactivate if active (ignore errors)
call deactivate 2>nul

REM Remove old venv
if exist "venv" (
    echo Removing old virtual environment...
    rmdir /s /q venv
    echo Old venv removed.
    echo.
)

REM Create fresh venv
echo Creating new virtual environment...
python -m venv venv --clear
echo.

REM Activate new venv
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Verify we're in the venv
echo Checking virtual environment...
python -c "import sys; print('Python location:', sys.executable); print('In venv:', hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix))"
echo.

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
echo.

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt
echo.

REM Download NLTK data
echo Downloading NLTK VADER lexicon...
python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"
echo.

REM Verify installation
echo.
echo ========================================
echo Verifying installation...
echo ========================================
python -c "import fastapi; import uvicorn; import googleapiclient; import vaderSentiment; import nltk; print('✅ All packages installed successfully!'); print('Package locations:'); import site; print('  Site-packages:', site.getsitepackages()[0])"
echo.

echo ========================================
echo  Fix Complete!
echo ========================================
echo.
echo Your virtual environment is now properly configured.
echo You can now use:
echo   - .\dev.bat (to run everything)
echo   - .\start-api.bat (to run just the API)
echo.
pause
