import { AssemblyAI } from 'assemblyai';
import { YtDlp, YtDlpConfig } from '@yemreak/yt-dlp';
import fs from 'fs';
import path from 'path';
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core'; 
import { execFile } from 'child_process';
import { promisify } from 'util';

const getTempDir = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp';
  }
  return path.join(process.cwd(), 'temp');
};

const TEMP_DIR = getTempDir();
const ytDlpConfig: YtDlpConfig = { workdir: path.join(TEMP_DIR, 'yt-dlp') };

// Parse Netscape cookies.txt format and convert to Cookie header string
function parseCookiesFile(cookiesPath: string): string {
  try {
    const content = fs.readFileSync(cookiesPath, 'utf-8');
    const lines = content.split('\n');
    const cookies: string[] = [];
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || line.trim() === '') continue;
      
      // Netscape format: domain flag path secure expiration name value
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6];
        cookies.push(`${name}=${value}`);
      }
    }
    
    return cookies.join('; ');
  } catch (error) {
    console.error('Error parsing cookies file:', error);
    return '';
  }
}

// Configure ytdl-core with agent and cookies to bypass bot detection
const ytdlAgent = ytdl.createAgent(undefined, {
  localAddress: undefined,
});

// Cookie file path - look in comment-analyzer folder, project root, or environment variable
const getCookiesPath = () => {
  console.log('🔍 Cookie Detection:');
  console.log('  - Running on Vercel:', !!process.env.VERCEL);
  console.log('  - YOUTUBE_COOKIES env var set:', !!process.env.YOUTUBE_COOKIES);
  console.log('  - YOUTUBE_COOKIES length:', process.env.YOUTUBE_COOKIES?.length || 0);
  
  // On Vercel/serverless, check for environment variable first
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const envCookies = process.env.YOUTUBE_COOKIES;
    if (envCookies) {
      const tmpCookiesPath = path.join(TEMP_DIR, 'cookies.txt');
      try {
        // Write cookies to /tmp on serverless
        if (!fs.existsSync(tmpCookiesPath)) {
          fs.writeFileSync(tmpCookiesPath, envCookies, 'utf-8');
          console.log('✅ Created cookies file from YOUTUBE_COOKIES environment variable at:', tmpCookiesPath);
        } else {
          console.log('✅ Using existing cookies file at:', tmpCookiesPath);
        }
        return tmpCookiesPath;
      } catch (error) {
        console.error('❌ Failed to write cookies from environment variable:', error);
      }
    } else {
      console.error('❌ YOUTUBE_COOKIES environment variable is NOT SET on Vercel!');
      console.error('   👉 Go to Vercel Dashboard → Settings → Environment Variables');
      console.error('   👉 Add YOUTUBE_COOKIES with your cookies.txt content');
    }
  }
  
  // Local development - look for cookies.txt file
  const paths = [
    path.join(process.cwd(), 'comment-analyzer', 'cookies.txt'),
    path.join(process.cwd(), 'cookies.txt'),
  ];
  
  for (const cookiePath of paths) {
    if (fs.existsSync(cookiePath)) {
      console.log('✅ Using local cookies file:', cookiePath);
      return cookiePath;
    }
  }
  
  console.warn('⚠️  No cookies found! YouTube may block requests.');
  return null;
};

const COOKIES_PATH = getCookiesPath();
const COOKIES_HEADER = COOKIES_PATH ? parseCookiesFile(COOKIES_PATH) : '';

if (COOKIES_HEADER) {
  console.log('✅ Successfully parsed YouTube cookies, cookie count:', COOKIES_HEADER.split('; ').length);
} else {
  console.error('❌ No cookies available - YouTube will likely block requests on Vercel!');
}

// Ensure temp directories exist
if (!fs.existsSync(ytDlpConfig.workdir)) {
  fs.mkdirSync(ytDlpConfig.workdir, { recursive: true });
}

const ytDlp = new YtDlp(ytDlpConfig);
const execFileAsync = promisify(execFile);

// Ensure yt-dlp executable is downloaded when the application starts
(async () => {
  try {
    console.log('Ensuring yt-dlp executable is present...');
    await ytDlp.downloadLatestReleaseIfNotExists();
    console.log('yt-dlp executable check complete.');
  } catch (error) {
    console.error('Error ensuring yt-dlp executable presence:', error);
  }
})();

// Extract YouTube video ID from URL
export function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Get transcript without authentication using youtube-transcript package
export async function getTranscriptNoAuth(youtubeUrl: string): Promise<{ success: boolean; transcript: string | null; error?: string }> {
  try {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return { success: false, transcript: null, error: 'Invalid YouTube URL' };
    }

    console.log(`Attempting to fetch transcript for video ${videoId} with youtube-transcript...`);

    const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl);

    if (!transcriptItems || transcriptItems.length === 0) {
      return { success: false, transcript: null, error: 'No transcript found' };
    }

    // Combine all transcript items into a single string
    const transcriptText = transcriptItems.map((item: any) => item.text).join(' ');
    console.log(`Successfully fetched transcript for video ${videoId}, length: ${transcriptText.length}`);

    return { success: true, transcript: transcriptText };
  } catch (error: any) {
    console.log(`⚠️  youtube-transcript: ${error.message || 'No transcript available'}`);
    return { success: false, transcript: null, error: error.message || 'Unknown error' };
  }
}

export async function getVideoDetails(videoId: string) {
  // Try LangChain first
  try {
    const loader = YoutubeLoader.createFromUrl(`https://www.youtube.com/watch?v=${videoId}`, {
      language: "en",
      addVideoInfo: true,
    });

    const docs = await loader.load();

    if (docs.length === 0 || !docs[0] || !docs[0].metadata) {
      throw new Error(`No video details found with LangChain for video ${videoId}.`);
    }

    const metadata = docs[0].metadata;

    return {
      title: metadata.title || 'Untitled Video',
      duration: metadata.duration || 0,
    };
  } catch (langchainError) {
    console.log('⚠️  LangChain failed for video details (expected), using ytdl-core fallback...');
    
    // Fallback to ytdl-core (now using @distube/ytdl-core fork)
    try {
      const ytdlOptions: any = {
        agent: ytdlAgent,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          },
        },
      };
      
      // Add cookies if available
      if (COOKIES_HEADER) {
        ytdlOptions.requestOptions.headers['Cookie'] = COOKIES_HEADER;
        console.log('Using cookies for ytdl-core video details fetch');
      }
      
      const info = await ytdl.getInfo(videoId, ytdlOptions);
      
      return {
        title: info.videoDetails.title || 'Untitled Video',
        duration: parseInt(info.videoDetails.lengthSeconds) || 0,
      };
    } catch (ytdlError) {
      console.error('Error fetching video details from ytdl-core:', ytdlError);
      
      // Graceful degradation - return placeholder details
      // The transcript will still work, which is what matters most
      console.log('⚠️ Using placeholder video details. Video ID:', videoId);
      console.log('💡 Tip: Video details are optional - transcript extraction will still work!');
      
      return {
        title: `YouTube Video ${videoId}`,
        duration: 0,
      };
    }
  }
}

// Download audio from YouTube video
export async function downloadAudio(youtubeUrl: string): Promise<string> {
  try {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const audioDir = path.join(TEMP_DIR, 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const audioPath = path.join(audioDir, `${videoId}.mp3`);

    if (fs.existsSync(audioPath)) {
      console.log('Audio file already exists, using cached version');
      return audioPath;
    }

    console.log('Downloading audio to:', audioPath);

    // Download video using yt-dlp to get the audio
    try {
      const binaryPath = path.join(ytDlpConfig.workdir!, 'yt-dlp.exe');
      const outputTemplate = path.join(audioDir, '%(id)s.%(ext)s');

      console.log('Using yt-dlp binary at:', binaryPath);
      
      const ytdlpArgs = [
        youtubeUrl,
        '-f', 'ba',
        '-o', outputTemplate,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ];
      
      // Add cookies if available
      if (COOKIES_PATH) {
        ytdlpArgs.push('--cookies', COOKIES_PATH);
      }
      
      await execFileAsync(binaryPath, ytdlpArgs, { cwd: ytDlpConfig.workdir });

      // Find the downloaded file
      const files = fs.readdirSync(audioDir);
      const downloadedFile = files.find(f => f.startsWith(videoId));

      if (!downloadedFile) {
        throw new Error('No audio file found after download.');
      }

      const actualAudioPath = path.join(audioDir, downloadedFile);
      console.log('Audio download completed:', actualAudioPath);
      return actualAudioPath;
    } catch (ytDlpError: any) {
      console.error('yt-dlp download error:', ytDlpError.message);
      throw new Error(`Failed to download audio: ${ytDlpError.message}`);
    }

  } catch (error:any) {
    console.error('Error downloading audio:', error);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}



// Get transcript using yt-dlp subtitle download (most reliable - works even when other APIs fail)
export async function getTranscriptWithYtDlpSubtitles(youtubeUrl: string, videoId: string): Promise<string | null> {
  try {
    console.log(`Attempting to fetch subtitles for video ${videoId} using yt-dlp...`);
    
    const subDir = path.join(TEMP_DIR, 'subs');
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    
    const outputTemplate = path.join(subDir, `sub_${videoId}`);
    const binaryPath = path.join(ytDlpConfig.workdir!, 'yt-dlp.exe'); 
    if (!fs.existsSync(binaryPath)) {
      console.log('yt-dlp binary not found, attempting to download...');
      try {
        await ytDlp.downloadLatestReleaseIfNotExists();
      } catch (e) {
        console.error('Failed to download yt-dlp binary:', e);
      }
    }

    if (!fs.existsSync(binaryPath)) {
      console.warn(`yt-dlp binary still not found at ${binaryPath}, skipping subtitle download`);
      return null;
    }
    
    try {
      console.log('Downloading subtitles with yt-dlp...');
      
      const ytdlpArgs = [
        youtubeUrl,
        '--write-auto-sub',
        '--skip-download',
        '--sub-lang', 'en',
        '--output', outputTemplate,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
      ];
      
      // Add cookies if available
      if (COOKIES_PATH) {
        ytdlpArgs.push('--cookies', COOKIES_PATH);
      }
      
      await execFileAsync(binaryPath, ytdlpArgs, { cwd: ytDlpConfig.workdir });
    } catch (execError: any) {
      // Check if it failed or just had no subtitles
      if (execError.stderr?.includes('WARNING') || execError.stdout?.includes('Writing video subtitles')) {
        console.log('Subtitles written despite warnings');
      } else {
        console.warn(`yt-dlp subtitle download had issues: ${execError.message}`);
        // Continue to check if file exists anyway, sometimes it writes before erroring
      }
    }
    
    // Find the downloaded subtitle file
    const files = fs.readdirSync(subDir);
    const subFile = files.find((f) => f.includes(`sub_${videoId}`) && f.endsWith('.vtt'));
    
    if (!subFile) {
      console.warn('No subtitle file found after yt-dlp download at', subDir);
      return null;
    }
    
    const subFilePath = path.join(subDir, subFile);
    let vttContent = fs.readFileSync(subFilePath, 'utf-8');
    
    // Parse VTT format to extract just the text
    // VTT format: timestamps, then text on next line
    const lines = vttContent.split('\n');
    const textParts = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines, WEBVTT header, timestamps (contains -->), and styling tags
      if (line && !line.startsWith('WEBVTT') && !line.includes('-->') && !line.startsWith('Kind:') && 
          !line.startsWith('Language:') && !line.startsWith('NOTE') && !line.includes('<v ')) {
        // Remove any remaining timestamp tags like <00:00:05.160>
        const cleanedLine = line.replace(/<[^>]+>/g, '');
        if (cleanedLine) {
          textParts.push(cleanedLine);
        }
      }
    }
    
    const fullTranscript = textParts.join(' ').trim();
    
    if (fullTranscript.length === 0) {
      console.warn('Parsed subtitle is empty');
      // Clean up
      fs.unlinkSync(subFilePath);
      return null;
    }
    
    console.log(`Successfully fetched subtitles with yt-dlp, length: ${fullTranscript.length}`);
    
    // Clean up the temp file
    fs.unlinkSync(subFilePath);
    
    return fullTranscript;
    
  } catch (error: any) {
    console.log(`⚠️  yt-dlp subtitles failed: ${error.message}`);
    return null;
  }
}

// Get transcript using ytdl-core (fallback method)
export async function getTranscriptWithYtdlCore(videoId: string): Promise<string | null> {
  try {
    console.log(`Attempting to fetch transcript for video ${videoId} with ytdl-core...`);
    
    const ytdlOptions: any = {
      agent: ytdlAgent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      },
    };
    
    // Add cookies if available
    if (COOKIES_HEADER) {
      ytdlOptions.requestOptions.headers['Cookie'] = COOKIES_HEADER;
      console.log('Using cookies for ytdl-core transcript fetch');
    }
    
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, ytdlOptions);
    const tracks = info.player_response.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || tracks.length === 0) {
      console.warn('No caption tracks found with ytdl-core');
      return null;
    }

    // Prioritize English, then auto-generated English, then first available
    const track = tracks.find((t: any) => t.languageCode === 'en') || 
                 tracks.find((t: any) => t.languageCode.startsWith('en')) || 
                 tracks[0];

    if (!track) {
        return null;
    }

    console.log(`Found caption track: ${track.name.simpleText} (${track.languageCode})`);
    
    // Fetch the transcript XML
    const response = await fetch(track.baseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript XML: ${response.status}`);
    }
    
    const xml = await response.text();
    
    // Simple regex to parse XML transcript
    // Matches: <text start="123" dur="456">Content</text>
    const regex = /<text[^>]*>(.*?)<\/text>/g;
    let match;
    const parts = [];
    
    while ((match = regex.exec(xml)) !== null) {
      // Decode HTML entities (basic ones)
      let text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      parts.push(text);
    }
    
    const fullTranscript = parts.join(' ');
    
    if (fullTranscript.length === 0) {
        console.warn('Parsed transcript is empty');
        return null;
    }

    console.log(`Successfully fetched transcript with ytdl-core, length: ${fullTranscript.length}`);
    return fullTranscript;

  } catch (error: any) {
    console.log(`⚠️  ytdl-core transcript failed: ${error.message}`);
    return null;
  }
}

// Get transcript using LangChain (with seamless ytdl-core fallback)
export async function getTranscriptWithLangChain(videoId: string): Promise<string | null> {
  try {
    console.log(`Attempting to fetch transcript for video ${videoId} with LangChain...`);

    const loader = YoutubeLoader.createFromUrl(`https://www.youtube.com/watch?v=${videoId}`, {
      language: "en",
      addVideoInfo: false,
    });

    const docs = await loader.load();

    if (docs.length === 0 || !docs[0] || !docs[0].pageContent) {
      console.warn(`No transcript found with LangChain. triggers fallback.`);
      throw new Error("Empty LangChain result");
    }

    // LangChain's YoutubeLoader returns the entire transcript as pageContent of the first document
    const transcriptText = docs[0].pageContent;
    console.log(`Successfully fetched transcript for video ${videoId} with LangChain, length: ${transcriptText.length}`);
    return transcriptText;

  } catch (error: any) {
    console.log(`⚠️  LangChain loader failed: ${error.message}`);
    
    // Seamless Fallback: Try ytdl-core (currently the most reliable method)
    console.log(`🔄 Recovering with ytdl-core fallback...`);
    try {
        const ytdlTranscript = await getTranscriptWithYtdlCore(videoId);
        if (ytdlTranscript) {
            console.log(`✅ Fallback successful: Retrieved transcript via ytdl-core`);
            return ytdlTranscript;
        }
    } catch (fbError) {
        console.warn(`Fallback to ytdl-core also failed.`);
    }

    console.log(`⚠️  All LangChain wrapper attempts failed for ${videoId}`);
    return null;
  }
}

// Transcribe audio using AssemblyAI
export async function transcribeWithAssemblyAI(audioPath: string) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing AssemblyAI API key in environment variables');
    }

    console.log('Initializing AssemblyAI client...');
    const client = new AssemblyAI({
      apiKey,
    });

    console.log('Starting transcription...');
    
    // Upload and transcribe the audio file
    const transcriptResponse = await client.transcripts.transcribe({
      audio: audioPath,
      speech_model: 'nano',
      language_code: 'en',
      sentiment_analysis: false,
      auto_chapters: false,
      auto_highlights: false,
      speaker_labels: false,
      entity_detection: false,
      iab_categories: false,
      summarization: false,
      word_boost: [], // Add important words if needed
      boost_param: "default",
    });

    console.log('Transcription status:', transcriptResponse.status);

    if (transcriptResponse.status === "error") {
      console.error('AssemblyAI full error response:', transcriptResponse);
      throw new Error(`AssemblyAI Error: ${transcriptResponse.error}`);
    }

    if (!transcriptResponse.text) {
      throw new Error("No text found in transcript from AssemblyAI");
    }

    console.log('Transcription completed successfully');
    
    // Clean up the audio file after successful transcription
    try {
      fs.unlinkSync(audioPath);
      console.log('Cleaned up audio file');
    } catch (cleanupError) {
      console.warn('Could not clean up audio file:', cleanupError);
    }

    // Return the full transcript text
    return transcriptResponse.text;

  } catch (error:any) {
    console.error('Error transcribing audio:', error);
    
    // Clean up audio file on error too
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } catch (cleanupError) {
      console.warn('Could not clean up audio file after error:', cleanupError);
    }
    
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}
export function chunkTranscript(transcript: string, chunkSize: number = 2000) { // Adjusted to 2000 characters per user request.
  // First clean the WEBVTT format by removing timestamps and tags
  let cleanedTranscript = transcript
    .replace(/WEBVTT.*\n\n/, '') // Remove WEBVTT header
    .replace(/<00:\d{2}:\d{2}\.\d{3}><c> /g, '') // Remove timestamps like <00:00:05.123><c>
    .replace(/<\/c>/g, '') // Remove closing tags like </c>
    .replace(/<c>.*?<\/c>/g, '') // Remove any remaining tags like <c.color> or <c> (if not caught by timestamp removal)
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  // --- Start of Repetition Removal ---
  // This loop iteratively removes immediate repetitions of words or phrases.
  // It continues until no more repetitions of the defined pattern are found,
  // effectively collapsing "A A A" to "A".
  let oldTranscript: string;
  do {
    oldTranscript = cleanedTranscript;
   
    cleanedTranscript = cleanedTranscript.replace(/(\b(?:[^\s]+\s+){0,14}?[^\s]+\b)\s+\1/g, '$1');

    // After each replacement, collapse multiple spaces again to ensure clean boundaries
    // and trim any leading/trailing spaces that might result from replacements.
    cleanedTranscript = cleanedTranscript.replace(/\s+/g, ' ').trim();
  } while (cleanedTranscript !== oldTranscript); // Loop until no more changes occur in the string
  // --- End of Repetition Removal ---

  const chunks: {
    text: string;
    startTime: number;
    endTime: number;
    index: number;
  }[] = [];

  // Split cleaned transcript into sentences using the original logic provided
  const sentences = cleanedTranscript.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();

    // If the sentence is empty after trimming (e.g., from multiple separators), skip it
    if (sentence.length === 0) {
      continue;
    }

    
    // `currentChunk.length >= chunkSize` ensures a chunk is pushed if it's already at or over the target size.
    if (currentChunk.length > 0 && (currentChunk.length + sentence.length + 2 > chunkSize * 1.2)) {
      chunks.push({
        text: currentChunk.trim(),
        startTime: 0,
        endTime: 0,
        index: chunkIndex++,
      });
      currentChunk = sentence; // Start a new chunk with the current sentence
    } else {
      // Add the current sentence to the current chunk.
      // Add a period and space as a separator if it's not the very first part of the current chunk.
      currentChunk += (currentChunk.length > 0 ? '. ' : '') + sentence;
    }
  }

  // After the loop, add any remaining text as the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      startTime: 0,
      endTime: 0,
      index: chunkIndex,
    });
  }
  console.log(`Created ${chunks.length} chunks from transcript`);
  return chunks;
}

// Alternative function  to get transcript with word-level timestamps
export async function getTranscriptWithTimestamps(youtubeUrl: string) {
  try {
    const audioPath = await downloadAudio(youtubeUrl);
    
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing AssemblyAI API key in environment variables');
    }

    const client = new AssemblyAI({
      apiKey,
    });

    const transcriptResponse = await client.transcripts.transcribe({
      audio: audioPath,
      language_detection: true, // Enable automatic language detection
    });

    if (transcriptResponse.status === "error") {
      throw new Error(`AssemblyAI Error: ${transcriptResponse.error}`);
    }

    if (!transcriptResponse.words) {
      throw new Error("No words found in transcript from AssemblyAI");
    }

    // Clean up audio file
    try {
      fs.unlinkSync(audioPath);
    } catch (cleanupError) {
      console.warn('Could not clean up audio file:', cleanupError);
    }

    // Transform AssemblyAI words into transcript format
    const transcript = transcriptResponse.words.map(word => ({
      text: word.text ?? '',
      offset: word.start / 1000, // Convert ms to seconds
      duration: (word.end - word.start) / 1000,
    }));

    let totalDuration = 0;
    if (transcript.length > 0) {
      const lastEntry = transcript[transcript.length - 1]!;
      totalDuration = Math.ceil(lastEntry.offset + lastEntry.duration);
    }
    
    return {
      transcript,
      duration: totalDuration,
    };
  } catch (error) {
    console.error('Error fetching transcript with timestamps:', error);
    throw error;
  }
}