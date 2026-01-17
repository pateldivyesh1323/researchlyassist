import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { GoogleAICacheManager } from '@google/generative-ai/server';
import { Paper } from '../models/Paper.js';
import { ChatSession, IChatMessage } from '../models/ChatSession.js';

const getGeminiClient = () => {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
};

const getCacheManager = () => {
  return new GoogleAICacheManager(process.env.GEMINI_API_KEY!);
};

const fetchPdfAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

const CACHE_TTL_SECONDS = 3600;

const SUMMARY_PROMPT = `You are a research paper assistant. Provide a comprehensive summary of the following research paper. Include:
1. Main objective/research question
2. Methodology used
3. Key findings
4. Conclusions and implications
5. Limitations mentioned

Format your response in a clear, structured manner using markdown.

Please analyze this research paper and provide a comprehensive summary.`;

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export const getPaperForAI = async (paperId: string, userId: string) => {
  const paper = await Paper.findOne({ _id: paperId, userId });

  if (!paper) {
    return { error: 'Paper not found', paper: null, pdfBase64: null };
  }

  if (!paper.fileUrl) {
    return { error: 'Paper has no PDF file', paper: null, pdfBase64: null };
  }

  const pdfBase64 = await fetchPdfAsBase64(paper.fileUrl);
  return { error: null, paper, pdfBase64 };
};

const getOrCreateChatSession = async (paperId: string, userId: string) => {
  let session = await ChatSession.findOne({ paperId, userId });
  if (!session) {
    session = await ChatSession.create({ paperId, userId, messages: [] });
  }
  return session;
};

const tryCreateCache = async (
  paperTitle: string,
  pdfBase64: string
): Promise<string | null> => {
  try {
    const cacheManager = getCacheManager();
    const cache = await cacheManager.create({
      model: 'models/gemini-2.0-flash-001',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              text: 'I have attached a research paper. I will ask questions about it.',
            },
          ],
        },
        {
          role: 'model',
          parts: [{ text: 'I have received the research paper. Please go ahead and ask your questions about it.' }],
        },
      ],
      systemInstruction: `You are a helpful research assistant. You have access to the attached research paper. Answer questions about this paper accurately and helpfully. If the question cannot be answered from the paper content, say so.

Paper Title: ${paperTitle}`,
      ttlSeconds: CACHE_TTL_SECONDS,
    });

    return cache.name || null;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('too small')) {
      console.log('Document too small for caching, using non-cached approach');
      return null;
    }
    throw error;
  }
};

const getOrCreateCache = async (
  paperId: string,
  userId: string,
  paperTitle: string,
  pdfBase64: string
): Promise<{ cacheName: string | null; session: InstanceType<typeof ChatSession> }> => {
  const session = await getOrCreateChatSession(paperId, userId);

  if (session.geminiCacheName && session.cacheExpiresAt && session.cacheExpiresAt > new Date()) {
    try {
      const cacheManager = getCacheManager();
      await cacheManager.get(session.geminiCacheName);
      return { cacheName: session.geminiCacheName, session };
    } catch {
      session.geminiCacheName = null;
      session.cacheExpiresAt = null;
    }
  }

  const cacheName = await tryCreateCache(paperTitle, pdfBase64);
  
  if (cacheName) {
    session.geminiCacheName = cacheName;
    session.cacheExpiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);
    await session.save();
  }

  return { cacheName, session };
};

export const generateSummaryStream = async (
  paperId: string,
  userId: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper, pdfBase64 } = await getPaperForAI(paperId, userId);

    if (error || !paper || !pdfBase64) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContentStream([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: SUMMARY_PROMPT },
    ]);

    let fullSummary = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullSummary += chunkText;
      callbacks.onChunk(chunkText);
    }

    paper.summary = fullSummary;
    await paper.save();

    callbacks.onComplete(fullSummary);
  } catch (error) {
    console.error('Summary generation error:', error);
    callbacks.onError('Failed to generate summary');
  }
};

export const chatWithPaperStream = async (
  paperId: string,
  userId: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper, pdfBase64 } = await getPaperForAI(paperId, userId);

    if (error || !paper || !pdfBase64) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    const { cacheName, session } = await getOrCreateCache(paperId, userId, paper.title, pdfBase64);
    const genAI = getGeminiClient();

    let chat;

    if (cacheName) {
      const cacheManager = getCacheManager();
      const cache = await cacheManager.get(cacheName);
      const model = genAI.getGenerativeModelFromCachedContent(cache);

      const history: Content[] = session.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      } as Content));

      chat = model.startChat({ history });
    } else {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are a helpful research assistant. You have access to the attached research paper. Answer questions about this paper accurately and helpfully. If the question cannot be answered from the paper content, say so.

Paper Title: ${paper.title}`,
      });

      const history: Content[] = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              text: 'I have attached a research paper. I will ask questions about it.',
            },
          ],
        },
        {
          role: 'model',
          parts: [{ text: 'I have received the research paper. Please go ahead and ask your questions about it.' }],
        },
        ...session.messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        } as Content)),
      ];

      chat = model.startChat({ history });
    }

    const result = await chat.sendMessageStream(message);

    let fullResponse = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      callbacks.onChunk(chunkText);
    }

    session.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: fullResponse, timestamp: new Date() }
    );
    await session.save();

    callbacks.onComplete(fullResponse);
  } catch (error) {
    console.error('Chat error:', error);
    callbacks.onError('Failed to process chat message');
  }
};

export const getChatHistory = async (
  paperId: string,
  userId: string
): Promise<{ messages: IChatMessage[] } | { error: string }> => {
  try {
    const session = await ChatSession.findOne({ paperId, userId });
    return { messages: session?.messages || [] };
  } catch (error) {
    console.error('Get chat history error:', error);
    return { error: 'Failed to get chat history' };
  }
};

export const clearChatHistory = async (
  paperId: string,
  userId: string
): Promise<{ success: boolean } | { error: string }> => {
  try {
    const cacheManager = getCacheManager();
    const session = await ChatSession.findOne({ paperId, userId });
    
    if (session?.geminiCacheName) {
      try {
        await cacheManager.delete(session.geminiCacheName);
      } catch {
      }
    }
    
    await ChatSession.deleteOne({ paperId, userId });
    return { success: true };
  } catch (error) {
    console.error('Clear chat history error:', error);
    return { error: 'Failed to clear chat history' };
  }
};
