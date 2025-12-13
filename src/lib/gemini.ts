import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import pLimit from 'p-limit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Create a rate limiter to stay within 100 requests/minute (Gemini Embedding free tier)
export const rateLimiter = {
  requests: [] as number[],
  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);
    return this.requests.length < 100;
  },
  async waitForSlot() {
    while (!(await this.checkLimit())) {
      await new Promise(resolve => setTimeout(resolve, 600)); // Wait 0.6 seconds for the next slot
    }
    this.requests.push(Date.now());
  }
};

// Create a p-limit instance to limit concurrent requests
const limit = pLimit(1);

// Get the Gemini model
export const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });
};

export const getEmbeddingModel = () => {
  return genAI.getGenerativeModel({ model: 'text-embedding-004' });
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  return limit(async () => {
    try {
      await rateLimiter.waitForSlot();
      const model = getEmbeddingModel();
      const result = await model.embedContent(text);
      
      // Check if embedding values exist
      if (!result.embedding || !result.embedding.values) {
        throw new Error('No embedding values returned from API');
      }
      
      return result.embedding.values;
    } catch (error: any) {
      console.error('Embedding generation error:', {
        message: error.message,
        status: error.status,
        text: text.substring(0, 100) + '...' // First 100 chars for debugging
      });
      
      // Re-throw with more context
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  });
};

// Generate response with rate limiting
const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.message.includes('503 Service Unavailable')) {
      console.warn(`Retrying after ${delay}ms due to 503 error...`);
      await new Promise(res => setTimeout(res, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateResponse = async (
  prompt: string,
  context: string[],
  maxOutputTokens = 2048
): Promise<string> => {
  return limit(async () => {
    try {
      await rateLimiter.waitForSlot();
      const model = getGeminiModel();
      
      const systemPrompt = `You are a helpful assistant that answers questions about YouTube videos based on their transcript. 
      Answer the question based ONLY on the context provided. Provide complete, comprehensive answers without mentioning the transcript.
      If the answer is not in the context, say "I don't have enough information to answer that question."
      Give detailed explanations when appropriate, but stay focused on answering the question.`;
      
      const contextText = context.join('\n\n');
      
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: 'Here is the transcript context:\n' + contextText }],
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I will answer questions based only on this transcript context.' }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: maxOutputTokens,
          candidateCount: 1,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const result = await retry(() => chat.sendMessage(prompt));
      const response = result.response;
      
      // Log finish reason for debugging
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        console.warn('Response may be incomplete. Finish reason:', finishReason);
      }
      
      // Check if response was blocked or incomplete
      if (!response || !response.text()) {
        console.error('Empty or blocked response from Gemini');
        console.error('Finish reason:', finishReason);
        console.error('Safety ratings:', response.candidates?.[0]?.safetyRatings);
        throw new Error('Response generation failed or was blocked');
      }
      
      const responseText = response.text();
      console.log(`Generated response length: ${responseText.length} characters`);
      
      return responseText;
    } catch (error: any) {
      console.error('Response generation error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  });
};

// FIX 4: Add a test function to verify API key
export const testGeminiConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing Gemini API connection...');
    console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length);
    
    // Test with a simple embedding
    const testResult = await generateEmbedding('Hello world');
    console.log('Test embedding successful, length:', testResult.length);
    return true;
  } catch (error: any) {
    console.error('Gemini API test failed:', error.message);
    return false;
  }
};