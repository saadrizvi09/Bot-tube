#!/bin/bash
echo "Starting YouTube Comment Analyzer API (Local Development)"
echo

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -q

# Download NLTK data
echo "Downloading NLTK data..."
python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

# Start the server
echo
echo "Starting server on http://localhost:7860"
echo "Press Ctrl+C to stop"
echo
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
