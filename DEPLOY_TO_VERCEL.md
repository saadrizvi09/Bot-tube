# Deploy to Vercel with YouTube Cookies

## ⚠️ You're Getting Bot Errors - Here's the Fix

### Step 1: Add Cookies to Vercel (Required!)

You already have `cookies.txt` locally. Now add it to Vercel:

1. **Copy your cookies.txt content**
   - Open `c:\YT-Bot\ytbot\cookies.txt`
   - Select all (Ctrl+A) and copy (Ctrl+C)

2. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project (ytbot)

3. **Add Environment Variable**
   - Go to: **Settings** → **Environment Variables**
   - Click **Add New**
   - Fill in:
     - **Name**: `YOUTUBE_COOKIES`
     - **Value**: Paste your entire cookies.txt content
     - **Environments**: Check all (Production, Preview, Development)
   - Click **Save**

4. **Redeploy**
   ```powershell
   git add .
   git commit -m "Fix: Add cookie support for YouTube bot bypass"
   git push
   ```
   
   OR click **Redeploy** in Vercel dashboard

### Step 2: Verify It's Working

After redeployment, check Vercel logs for these messages:
- ✅ `Successfully loaded YouTube cookies for bot bypass`
- ✅ `Using cookies for ytdl-core video details fetch`

If you still see "Sign in to confirm you're not a bot", the cookies aren't loading.

### Troubleshooting

**Still getting bot errors after adding YOUTUBE_COOKIES?**

1. **Verify the environment variable is set:**
   - Go to Vercel → Settings → Environment Variables
   - Confirm `YOUTUBE_COOKIES` exists and has content

2. **Check the format:**
   - Must be the raw content of cookies.txt
   - Should start with: `# Netscape HTTP Cookie File`
   - Should have multiple lines with tabs

3. **Redeploy after setting env var:**
   - Changes don't apply until you redeploy
   - Push a new commit or use "Redeploy" button

4. **Check Vercel Function Logs:**
   - Go to Vercel → Deployments → Latest → Functions
   - Click on a function invocation
   - Look for "Successfully loaded YouTube cookies" message

5. **Cookies might be expired:**
   - YouTube cookies expire after ~6 months
   - Re-export fresh cookies from your browser
   - Update the `YOUTUBE_COOKIES` env var

### Testing Locally

Your local setup should already work since you have `cookies.txt` in the project root:

```powershell
# Start dev server
npm run dev

# Try processing a video
# Should see: "Successfully loaded YouTube cookies for bot bypass"
```

### What Changed

The latest code updates:
1. ✅ Parses Netscape cookies.txt format
2. ✅ Converts cookies to HTTP Cookie header
3. ✅ Passes cookies to ytdl-core requests
4. ✅ Uses cookies with yt-dlp via --cookies flag
5. ✅ Loads from `YOUTUBE_COOKIES` env var on Vercel

### Security Reminder

- ✅ `cookies.txt` is in `.gitignore` - won't be committed
- ⚠️ Don't share your `YOUTUBE_COOKIES` env var
- ⚠️ Rotate cookies every 6 months
- ✅ Only team members with Vercel access can see env vars

---

## Quick Commands

```powershell
# Test locally
npm run dev

# Deploy to Vercel
git add .
git commit -m "Update"
git push

# View Vercel logs
# Go to: https://vercel.com/your-project/deployments
```
