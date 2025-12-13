import { AssemblyAI } from 'assemblyai';
import { YtDlp, YtDlpConfig } from '@yemreak/yt-dlp';
import fs from 'fs';
import path from 'path';
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { YoutubeTranscript } from 'youtube-transcript';
import { Innertube } from 'youtubei.js';

const ytDlpConfig: YtDlpConfig = { workdir: '/tmp/yt-dlp' }; // Changed to use /tmp for Vercel deployment
const ytDlp = new YtDlp(ytDlpConfig);

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
    console.error(`Error fetching transcript with youtube-transcript:`, error);
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
    console.warn('LangChain failed to get video details, trying youtubei.js...', langchainError);
    
    // Fallback to youtubei.js
    try {
      const youtube = await Innertube.create();
      const info = await youtube.getInfo(videoId);
      
      return {
        title: info.basic_info.title || 'Untitled Video',
        duration: info.basic_info.duration || 0,
      };
    } catch (youtubeijsError) {
      console.error('Error fetching video details from youtubei.js:', youtubeijsError);
      throw new Error('Failed to get video details from all sources');
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

    const tempDir = '/tmp'; // Use /tmp for temporary storage on Vercel
    // No need to create directory, /tmp is guaranteed to exist on Vercel

    const audioPath = `${tempDir}/${videoId}.mp3`;

    if (fs.existsSync(audioPath)) {
      console.log('Audio file already exists, using cached version');
      return audioPath;
    }

    console.log('Downloading audio to:', audioPath);

    // Download video using yt-dlp to get the audio
    try {
      const downloadedPaths = await ytDlp.download({
        url: youtubeUrl,
        format: 'ba',
      });

      if (downloadedPaths.length === 0) {
        throw new Error('No audio file was downloaded by yt-dlp.');
      }

      // The downloaded file name might not be exactly `${videoId}.mp3`, it can include title etc.
      // We need to find the correct audio file path in the temp directory.
      // For now, we'll assume the first downloaded path is the audio file we want.
      const actualAudioPath = downloadedPaths[0];

      console.log('Audio download completed');
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



// Get transcript using LangChain
export async function getTranscriptWithLangChain(videoId: string): Promise<string | null> {
  try {
    console.log(`Attempting to fetch transcript for video ${videoId} with LangChain...`);

    const loader = YoutubeLoader.createFromUrl(`https://www.youtube.com/watch?v=${videoId}`, {
      language: "en",
      addVideoInfo: true,
    });

    const docs = await loader.load();

    if (docs.length === 0 || !docs[0] || !docs[0].pageContent) {
      console.warn(`No transcript found with LangChain for video ${videoId}.`);
      return null;
    }

    // LangChain's YoutubeLoader returns the entire transcript as pageContent of the first document
    const transcriptText = docs[0].pageContent;
    console.log(`Successfully fetched transcript for video ${videoId} with LangChain, length: ${transcriptText.length}`);
    return transcriptText;
  } catch (error: any) {
    console.error(`Error fetching transcript with LangChain for video ${videoId}:`, error);
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
      language_detection: true, // Enable automatic language detection
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
    // Regex to find a sequence of 1 to 15 "word-like" tokens (non-whitespace characters)
    // followed by one or more spaces, and then the exact same sequence.
    //
    // Breakdown of the regex:
    // (\b(?:[^\s]+\s+){0,14}?[^\s]+\b)
    //   - \b: Word boundary, ensures we match whole words/phrases.
    //   - (?: ... ): A non-capturing group.
    //   - [^\s]+\s+: Matches one or more non-whitespace characters (a "word")
    //                followed by one or more whitespace characters.
    //   - {0,14}?: This repeats the "word + space" pattern 0 to 14 times,
    //              making the phrase 1 to 15 words long. The `?` makes it non-greedy,
    //              so it matches the shortest possible repeating unit first.
    //   - [^\s]+\b: Matches the last word of the phrase, followed by a word boundary.
    // This entire first part is captured as Group 1 `(...)`.
    //
    // \s+\1: Matches one or more spaces followed by the exact content of Group 1 (the repeated phrase).
    //
    // The `g` flag ensures all occurrences in the string are replaced.
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