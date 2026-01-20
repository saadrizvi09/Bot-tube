import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { extractVideoId, getVideoDetails, downloadAudio, transcribeWithAssemblyAI, chunkTranscript, getTranscriptWithSupadata, getTranscriptWithLangChain, getTranscriptNoAuth, getTranscriptWithYtDlpSubtitles } from '@/lib/youtube';
import { generateEmbedding } from '@/lib/gemini';
import pLimit from 'p-limit';

const CONCURRENT_EMBEDDING_CALLS = 5; 
const limit = pLimit(CONCURRENT_EMBEDDING_CALLS);

export async function POST(request: NextRequest) {
  let video: any = null;
  
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    console.log('Processing video:', youtubeUrl);

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    console.log('Extracted video ID:', videoId);


    const existingVideo = await db.video.findFirst({
      where: {
        videoId,
        userId: user.userId,
      },
    });

    if (existingVideo) {
      return NextResponse.json({ 
        message: 'Video already processed',
        videoId: existingVideo.id 
      });
    }

    // Get video details
    console.log('Getting video details...');
    let details;
    try {
      details = await getVideoDetails(videoId);
      console.log('Video details retrieved:', details.title);
    } catch (error) {
      console.error('Error getting video details:', error);
      // Use placeholder details instead of failing
      details = {
        title: `YouTube Video ${videoId}`,
        duration: 0,
      };
      console.log('⚠️ Using placeholder video details, will still attempt transcript extraction');
    }

    // Create video record (without transcript initially)
    console.log('Creating video record...');
    try {
      video = await db.video.create({
        data: {
          youtubeUrl,
          videoId,
          title: details.title,
          duration: details.duration || 0,
          userId: user.userId,
        },
      });
    } catch (dbError: any) {
       // Handle unique constraint violation (userId + videoId)
       if (dbError.code === 'P2002') {
         console.log('Video already exists for this user (race condition), fetching existing...');
         const existing = await db.video.findFirst({ 
             where: { 
                 videoId,
                 userId: user.userId
             } 
         });
         
         if (existing) {
             return NextResponse.json({ 
                message: 'Video already processed',
                videoId: existing.id 
             });
         }
       }
       throw dbError;
    }

    console.log('Video record created:', video.id);

    // Get transcript with prioritized fallback chain
    // Priority: Supadata (paid API, most reliable) → LangChain → youtube-transcript → ytdl-core → yt-dlp → AssemblyAI
    console.log('Attempting to get transcript with Supadata...');
    let transcript = await getTranscriptWithSupadata(videoId);

    if (transcript) {
      console.log('Transcript found from Supadata, length:', transcript.length);
    } else {
      console.log('No transcript from Supadata. Trying LangChain...');
      transcript = await getTranscriptWithLangChain(videoId);

      if (transcript) {
        console.log('Transcript found from LangChain, length:', transcript.length);
      } else {
        console.log('No transcript found from LangChain. Trying youtube-transcript...');
        let transcriptResult = await getTranscriptNoAuth(youtubeUrl);
        transcript = transcriptResult.transcript;

        if (transcriptResult.success && transcript) {
          console.log('Transcript found from youtube-transcript, length:', transcript.length);
        } else {
          // Try ytdl-core fallback (works on Vercel with cookies)
          console.log(`No transcript from youtube-transcript. Error: ${transcriptResult.error || 'Unknown error'}. Trying ytdl-core...`);
          
          const { getTranscriptWithYtdlCore } = require('@/lib/youtube');
          const ytdlTranscript = await getTranscriptWithYtdlCore(videoId);
          
          if (ytdlTranscript) {
            transcript = ytdlTranscript;
            console.log('Transcript found via ytdl-core, length:', transcript?.length);
          } else {
          // Try yt-dlp subtitles (only works locally, not on Vercel)
          console.log('ytdl-core transcript also failed. Attempting yt-dlp subtitles...');
          
          try {
            transcript = await getTranscriptWithYtDlpSubtitles(youtubeUrl, videoId);
            if (transcript) {
              console.log('Transcript found from yt-dlp subtitles, length:', transcript.length);
            }
          } catch (e) {
            console.error('Error invoking yt-dlp subtitles:', e);
          }
          
          if (!transcript) {
            console.log('No subtitles from yt-dlp. Falling back to AssemblyAI...');
            
            // Check if we're on Vercel where yt-dlp doesn't work
            if (process.env.VERCEL) {
              console.error('❌ Cannot use AssemblyAI on Vercel - yt-dlp binary not available for audio download');
              console.error('💡 This video has transcripts disabled. Try a different video with transcripts enabled.');
              throw new Error('Transcripts are disabled for this video and AssemblyAI cannot be used on Vercel');
            }
            
            try {
              // Download audio from YouTube (still required for AssemblyAI fallback)
              console.log('Downloading audio...');
              let audioPath;
              try {
                audioPath = await downloadAudio(youtubeUrl);
                console.log('Audio downloaded to:', audioPath);
              } catch (error) {
                console.error('Error downloading audio:', error);
                throw new Error('Failed to download video audio');
              }
              // ... (rest of AssemblyAI logic)
              transcript = await transcribeWithAssemblyAI(audioPath); // Pass audioPath
              console.log('Transcription completed with AssemblyAI, length:', transcript?.length || 0);
              
              if (!transcript || transcript.trim().length === 0) {
                throw new Error('No transcript was generated from AssemblyAI');
              }
            } catch (error:any) {
              console.error('Error transcribing audio with AssemblyAI:', error);
              // Don't delete here - let the outer catch block handle cleanup
              throw new Error('Failed to transcribe video with AssemblyAI: ' + error.message);
            }
          }
        }
      }
    }
    }

    console.log('Chunking transcript...');
    let chunks;
    try {
      if (!transcript || transcript.trim() === '') {
        throw new Error('Transcript is null or empty, cannot proceed with chunking.');
      }
      chunks = chunkTranscript(transcript, 2000); 
      console.log('Created chunks:', chunks.length);
      
      if (!chunks || chunks.length === 0) {
        throw new Error('Failed to create transcript chunks');
      }
    } catch (error) {
      console.error('Error chunking transcript:', error);
      await db.video.delete({ where: { id: video.id } });
      throw new Error('Failed to process transcript');
    }
    
    // Process chunks and generate embeddings in parallel
    console.log('Processing chunks and generating embeddings...');
    
    const embeddingPromises = chunks.map(async (chunk, i) => {
      return limit(async () => {
        try {
          console.log(`Processing chunk ${i + 1}/${chunks.length}`);
          
          // Generate embedding with retry logic
          let embedding;
          let retries = 3;
          
          while (retries > 0) {
            try {
              embedding = await generateEmbedding(chunk.text);
              break;
            } catch (embeddingError: any) {
              retries--;
              console.warn(`Embedding generation failed, retries left: ${retries}`, embeddingError.message);
              
              if (retries === 0) {
                throw embeddingError;
              }
              
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
          }

          // Validate embedding
          if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            throw new Error(`Invalid embedding generated for chunk ${i}`);
          }
          
          return {
            videoId: video.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            startTime: chunk.startTime || 0,
            endTime: chunk.endTime || 0,
            chunkEmbedding: embedding,
          };
        } catch (chunkError: any) {
          console.error(`Error processing chunk ${i}:`, chunkError);
          return null; // Return null for failed chunks to filter out later
        }
      });
    });

    const results = await Promise.all(embeddingPromises);
    const successfulEmbeddings = results.filter(result => result !== null) as { // Filter out nulls
      videoId: string;
      chunkText: string;
      chunkIndex: number;
      startTime: number;
      endTime: number;
      chunkEmbedding: number[];
    }[];

    if (successfulEmbeddings.length === 0) {
      await db.video.delete({ where: { id: video.id } });
      throw new Error('No embeddings were successfully generated.');
    }

    console.log(`Successfully generated ${successfulEmbeddings.length} embeddings. Saving to database...`);

    // Batch insert embeddings into database
    const embeddingInsertPromises = successfulEmbeddings.map(async (embeddingData) => {
      try {
        await db.$executeRaw`
          INSERT INTO "VideoEmbedding" ("id", "videoId", "chunkText", "chunkIndex", "startTime", "endTime", "chunkEmbedding")
          VALUES (gen_random_uuid()::text, ${embeddingData.videoId}, ${embeddingData.chunkText}, ${embeddingData.chunkIndex}, ${embeddingData.startTime}, ${embeddingData.endTime}, ${embeddingData.chunkEmbedding}::vector)
        `;
      } catch (rawError: any) {
        console.error('Failed to save embedding using raw query (batch item):', rawError);
        throw new Error(`Failed to save embedding for chunk ${embeddingData.chunkIndex}: ${rawError.message}`);
      }
    });

    await Promise.all(embeddingInsertPromises);

    // Verify embeddings were created
    const embeddingCount = await db.videoEmbedding.count({
      where: { videoId: video.id }
    });
    
    console.log(`Created ${embeddingCount} embeddings for video ${video.id}`);
    
    if (embeddingCount === 0) {
      await db.video.delete({ where: { id: video.id } });
      throw new Error('No embeddings were created');
    }

    console.log('Video processing completed successfully');

    return NextResponse.json({ 
      message: 'Video processed successfully',
      videoId: video.id,
      embeddingsCreated: embeddingCount,
      title: details.title
    });

  } catch (error: any) {
    console.error('Error processing video:', error);
    
    // Clean up failed video record
    if (video?.id) {
      try {
        await db.video.deleteMany({ where: { id: video.id } });
        console.log('Cleaned up failed video record');
      } catch (deleteError) {
        console.error('Error cleaning up video record:', deleteError);
      }
    }
    
    // Return appropriate error messages
    if (error.message.includes('download')) {
      return NextResponse.json({ 
        error: 'Failed to download video audio. The video may be private or unavailable.' 
      }, { status: 400 });
    }
    
    if (error.message.includes('transcribe')) {
      return NextResponse.json({ 
        error: 'Failed to transcribe video. The audio may be unclear or in an unsupported language.' 
      }, { status: 400 });
    }
    
    if (error.message.includes('rate limit')) {
      return NextResponse.json({ 
        error: 'Too many requests. Please try again in a few minutes.' 
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to process video' 
    }, { status: 500 });
  }
}

// GET endpoint to list user's videos
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videos = await db.video.findMany({
      where: { userId: user.userId },
      include: {
        _count: {
          select: {
            embeddings: true,
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(videos);
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}