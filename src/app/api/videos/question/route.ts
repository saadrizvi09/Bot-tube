import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateEmbedding, generateResponse } from '@/lib/gemini'; // Corrected import
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, question } = body as { videoId: string; question: string };

    if (!videoId || !question) {
      return NextResponse.json({ error: 'Video ID and question are required' }, { status: 400 });
    }

    console.log(`Processing question for video ${videoId}: "${question}"`);

    const video = await db.video.findUnique({
      where: { id: videoId, userId: user.userId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found or unauthorized' }, { status: 404 });
    }

    // Generate embedding for the question using Gemini's embedding model
    console.log('Generating question embedding...');
    const questionEmbedding = await generateEmbedding(question);
    console.log('Question embedding generated');

    // Find relevant chunks from the video embeddings
    const relevantChunks = await db.$queryRaw`
      SELECT "chunkText", "startTime", "endTime", "chunkIndex",
      1 - ("chunkEmbedding" <=> ${questionEmbedding}::vector) AS similarity
      FROM "VideoEmbedding"
      WHERE 1 - ("chunkEmbedding" <=> ${questionEmbedding}::vector) > 0.7
      AND "videoId" = ${videoId}
      ORDER BY similarity DESC
      LIMIT 12
    `;

    if (Array.isArray(relevantChunks) && relevantChunks.length > 0) {
      console.log(`Found ${relevantChunks.length} chunks with similarity > 0.7`);
      console.log('Top similarity scores:', relevantChunks.map((c: any) => c.similarity));

      // Generate response using Gemini with relevant chunks as context
      const context = relevantChunks.map((c: any) => c.chunkText);
      const answer = await generateResponse(question, context);
      
      const newVideoQuestion = await db.videoQuestion.create({
        data: {
          id: require('crypto').randomUUID(),
          videoId,
          userId: user.userId,
          question,
          answer,
        },
      });

      return NextResponse.json(newVideoQuestion);
    } else {
      console.log('Found 0 chunks with similarity > 0.7');
      console.log('Trying with similarity > 0.3...');
      const lessRelevantChunks = await db.$queryRaw`
        SELECT "chunkText", "startTime", "endTime", "chunkIndex",
        1 - ("chunkEmbedding" <=> ${questionEmbedding}::vector) AS similarity
        FROM "VideoEmbedding"
        WHERE 1 - ("chunkEmbedding" <=> ${questionEmbedding}::vector) > 0.7
        AND "videoId" = ${videoId}
        ORDER BY similarity DESC
        LIMIT 12
      `;

      if (Array.isArray(lessRelevantChunks) && lessRelevantChunks.length > 0) {
        console.log(`Found ${lessRelevantChunks.length} chunks with similarity > 0.3`);
        console.log('Top similarity scores:', lessRelevantChunks.map((c: any) => c.similarity));
        const context = lessRelevantChunks.map((c: any) => c.chunkText);
        const answer = await generateResponse(question, context);
        
        const newVideoQuestion = await db.videoQuestion.create({
          data: {
            id: require('crypto').randomUUID(),
            videoId,
            userId: user.userId,
            question,
            answer,
          },
        });
        return NextResponse.json(newVideoQuestion);

      } else {
        console.log('No similar chunks found, getting top 5 chunks...');
        const topChunks = await db.$queryRaw`
          SELECT "chunkText", "startTime", "endTime", "chunkIndex",
          1 - ("chunkEmbedding" <=> ${questionEmbedding}::vector) AS similarity
          FROM "VideoEmbedding"
          WHERE "videoId" = ${videoId}
          ORDER BY similarity DESC
          LIMIT 5
        `;
        console.log(`Got ${Array.isArray(topChunks) ? topChunks.length : 0} top chunks`);
        if (Array.isArray(topChunks) && topChunks.length > 0) {
          console.log('Top similarity scores:', topChunks.map((c: any) => c.similarity));
          const context = topChunks.map((c: any) => c.chunkText);
          const answer = await generateResponse(question, context);
          
          const newVideoQuestion = await db.videoQuestion.create({
            data: {
              id: require('crypto').randomUUID(),
              videoId,
              userId: user.userId,
              question,
              answer,
            },
          });
          return NextResponse.json(newVideoQuestion);
        } else {
          console.log('No chunks found at all.');
          const answer = "I don't have enough information to answer that question from the video.";
          const newVideoQuestion = await db.videoQuestion.create({
            data: {
              id: require('crypto').randomUUID(),
              videoId,
              userId: user.userId,
              question,
              answer,
            },
          });
          return NextResponse.json(newVideoQuestion);
        }
      }
    }
  } catch (err: any) {
    console.error('Error answering question:', err);
    return NextResponse.json({ error: err?.message || 'Failed to answer question' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoId = req.nextUrl.searchParams.get('videoId');
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const questions = await db.videoQuestion.findMany({
      where: { videoId, userId: user.userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(questions);
  } catch (err: any) {
    console.error('Error fetching questions:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch questions' }, { status: 500 });
  }
}