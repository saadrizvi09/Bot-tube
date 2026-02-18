import { AssemblyAI } from 'assemblyai';
import { YtDlp, YtDlpConfig } from '@yemreak/yt-dlp';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Supadata } from '@supadata/js';

const getTempDir = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp';
  }
  return path.join(process.cwd(), 'temp');
};

const TEMP_DIR = getTempDir();
const ytDlpConfig: YtDlpConfig = { workdir: path.join(TEMP_DIR, 'yt-dlp') };

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



export async function getVideoDetails(videoId: string) {
  try {
    // Use Supadata to get video details
    const apiKey = process.env.SUPADATA_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️  SUPADATA_API_KEY not set, using placeholder video details');
      return {
        title: `YouTube Video ${videoId}`,
        duration: 0,
      };
    }
    
    const supadata = new Supadata({ apiKey });
    const details = await supadata.metadata({
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
    
    // Extract duration from media if it's a video
    const duration = details.media.type === 'video' ? details.media.duration : 0;
    
    return {
      title: details.title || `YouTube Video ${videoId}`,
      duration,
    };
  } catch (error) {
    console.error('Error fetching video details:', error);
    console.log('⚠️ Using placeholder video details');
    
    return {
      title: `YouTube Video ${videoId}`,
      duration: 0,
    };
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





// Get transcript using Supadata API (most reliable, works on Vercel)
export async function getTranscriptWithSupadata(videoId: string): Promise<string | null> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️  SUPADATA_API_KEY not set in environment variables, skipping Supadata');
      console.log('💡 To use Supadata: Get API key from https://dash.supadata.ai and add to .env.local or Vercel env vars');
      return null;
    }
    
    console.log(`Attempting to fetch transcript for video ${videoId} with Supadata...`);
    console.log('🔑 Supadata API key found, length:', apiKey.length);
    
    // Initialize Supadata client
    const supadata = new Supadata({ apiKey });
    
    // Get transcript - request plain text format
    const transcriptResult = await supadata.youtube.transcript({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      text: true, // Return plain text instead of timestamped chunks
      lang: 'en', // Prefer English, falls back to first available
    });
    
    console.log('📦 Supadata response type:', typeof transcriptResult);
    console.log('📦 Supadata response keys:', transcriptResult ? Object.keys(transcriptResult) : 'null');
    console.log('📦 Full Supadata response:', JSON.stringify(transcriptResult, null, 2).substring(0, 500));
    
    // Check if we got a transcript directly or need to poll for job
    if ('jobId' in transcriptResult) {
      // Large video - need to poll for results
      console.log(`⏳ Supadata returned job ID: ${transcriptResult.jobId}, polling for results...`);
      
      // Poll up to 30 seconds with 2 second intervals
      let attempts = 15;
      while (attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const jobResult = await supadata.transcript.getJobStatus(transcriptResult.jobId as string);
        
        if (jobResult.status === 'completed') {
          // Get the result data
          const resultData = (jobResult as any).result || (jobResult as any).data;
          
          const transcriptText = typeof resultData === 'string' 
            ? resultData
            : Array.isArray(resultData)
            ? resultData.map((seg: any) => seg.text || '').join(' ')
            : '';
          
          if (transcriptText.length > 0) {
            console.log(`✅ Successfully fetched transcript with Supadata (async), length: ${transcriptText.length}`);
            return transcriptText;
          }
        } else if (jobResult.status === 'failed') {
          console.log(`⚠️  Supadata job failed: ${(jobResult as any).error}`);
          return null;
        }
        
        attempts--;
      }
      
      console.log('⚠️  Supadata job timeout - took too long');
      return null;
    }
    
    // Direct response - extract transcript text
    let transcriptText = '';
    
    if (typeof transcriptResult === 'string') {
      transcriptText = transcriptResult;
    } else if (transcriptResult && 'content' in transcriptResult) {
      // Supadata returns transcript in 'content' field
      const content = (transcriptResult as any).content;
      if (typeof content === 'string') {
        transcriptText = content;
      } else if (Array.isArray(content)) {
        transcriptText = content.map((seg: any) => seg.text || seg.content || '').join(' ');
      }
    } else if (transcriptResult && 'transcript' in transcriptResult) {
      const transcript = (transcriptResult as any).transcript;
      if (typeof transcript === 'string') {
        transcriptText = transcript;
      } else if (Array.isArray(transcript)) {
        transcriptText = transcript.map((seg: any) => seg.text || seg.content || '').join(' ');
      }
    } else if (Array.isArray(transcriptResult)) {
      transcriptText = (transcriptResult as any[]).map((seg: any) => seg.text || seg.content || '').join(' ');
    }
    
    transcriptText = transcriptText.trim();
    
    if (transcriptText.length > 0) {
      console.log(`✅ Successfully fetched transcript with Supadata, length: ${transcriptText.length}`);
      return transcriptText;
    }
    
    console.log('⚠️  Supadata returned empty transcript');
    return null;
    
  } catch (error: any) {
    // Handle Supadata SDK errors
    if (error.error) {
      console.log(`⚠️  Supadata error: ${error.error} - ${error.message}`);
      if (error.documentationUrl) {
        console.log(`📚 See: ${error.documentationUrl}`);
      }
    } else {
      console.log(`⚠️  Supadata transcript failed: ${error.message}`);
    }
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