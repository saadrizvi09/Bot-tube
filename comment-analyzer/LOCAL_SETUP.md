# 🚀 Local Development Setup Guide

## Prerequisites

- **Python 3.10+** ([Download here](https://www.python.org/downloads/))
- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Git** (if you want to clone/push changes)
- **YouTube Data API Key** (see main README for setup instructions)

---

## Quick Start (Windows) - Easiest Way!

### Run Everything with One Command

From the **root folder** (`ytbot`), simply run:

```powershell
.\dev.bat
```

This will automatically:
- ✅ Create virtual environments if needed (first time only)
- ✅ Install dependencies if missing (smart check - won't reinstall if already installed!)
- ✅ Download NLTK data if needed (first time only)
- ✅ Start the Comment Analyzer API at `http://localhost:7860`
- ✅ Start the Next.js frontend at `http://localhost:3000`

**After the first run**, it will start **instantly** because all dependencies are already installed!

### Run Only the Comment Analyzer API

If you just want to run the API without the frontend:

```powershell
.\start-api.bat
```

Then visit: **http://localhost:7860/docs** for the interactive API documentation!

---

## 🔧 How It Works

The setup process is **smart and efficient**:

1. **First Run**: Installs everything (~1-2 minutes)
   - Creates Python virtual environment
   - Installs all Python packages
   - Downloads NLTK VADER lexicon
   - Installs Node.js dependencies

2. **Subsequent Runs**: Starts almost instantly!
   - Checks if packages are installed (quick check)
   - Only installs if something is missing
   - No redundant downloads or installations

---

## 🩹 Quick Fix for Current Issue

**Problem**: Your virtual environment is not properly isolated. Packages are being installed to your system Python (`C:\Users\acer\AppData\Local\Programs\Python\Python311\`) instead of the virtual environment.

**Solution**: Run the fix script from the root folder:

```powershell
cd C:\YT-Bot\ytbot
.\fix-venv.bat
```

This will:
- Remove the broken virtual environment
- Create a new, properly isolated one
- Install all dependencies correctly
- Download NLTK data
- Verify everything works

**After running the fix**, you can use `.\dev.bat` or `.\start-api.bat` normally!

---

## Manual Setup (If Needed)

```powershell
# 1. Navigate to the comment-analyzer folder
cd comment-analyzer

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
venv\Scripts\activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Download NLTK data
python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

# 6. Start the server
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```

---

## Quick Start (Linux/Mac)

```bash
# 1. Navigate to the comment-analyzer folder
cd comment-analyzer

# 2. Create virtual environment
python3 -m venv venv

# 3. Activate virtual environment
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Download NLTK data
python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

# 6. Start the server
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```

---

## Environment Variables

Make sure you have a `.env` file in the `comment-analyzer` folder with:

```env
YOUTUBE_API_KEY=your-youtube-api-key-here
DEBUG=False
```

✅ This has been created for you with your existing API key!

---

## Testing the API

### 1. Health Check
```bash
curl http://localhost:7860/health
```

### 2. Analyze Comments (PowerShell)
```powershell
$body = @{
    video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    max_comments = 20
    include_replies = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7860/analyze" -Method POST -Body $body -ContentType "application/json"
```

### 3. Using the Interactive Docs
Visit http://localhost:7860/docs and use the built-in API tester!

---

## Connecting Your Frontend

The main app's `.env` file has been updated to use `http://localhost:7860`:

```env
NEXT_PUBLIC_COMMENT_ANALYZER_URL=http://localhost:7860
```

Now your Next.js app (at `http://localhost:3000`) will use your local comment analyzer!

---

## Running Both Services Separately

If you prefer to run them in the same terminal window or need more control:
```powershell
cd comment-analyzer
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```

### Terminal 2 - Main Next.js App:
```powershell
npm run dev
```

Then visit: http://localhost:3000/comments

---

## Troubleshooting

### Port Already in Use
```powershell
# Find what's using port 7860
netstat -ano | findstr :7860

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Module Not Found Errors
```powershell
# Make sure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

### YouTube API Quota Exceeded
- Free tier: 10,000 units/day
- Each analysis uses ~1 unit
- Reset happens at midnight Pacific Time
- Monitor usage: https://console.cloud.google.com/apis/dashboard

---

## Development Tips

- **Auto-reload**: The `--reload` flag watches for file changes
- **Logs**: Check the terminal for request logs and errors
- **API Docs**: http://localhost:7860/docs has interactive testing
- **CORS**: Currently allows all origins (see `app/main.py` to restrict)

---

## Next Steps

1. ✅ Run `run_local.bat` to start the API
2. ✅ Test it at http://localhost:7860/docs
3. ✅ Start your Next.js app with `npm run dev`
4. ✅ Visit http://localhost:3000/comments to see it work!
