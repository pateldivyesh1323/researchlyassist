import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { Paper } from '../models/Paper.js';

const getGeminiClient = () => {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
};

const fetchPdfAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

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
  chatHistory: { role: string; content: string }[],
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper, pdfBase64 } = await getPaperForAI(paperId, userId);

    if (error || !paper || !pdfBase64) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
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
      ...(chatHistory || []).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      } as Content)),
    ];

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(message);

    let fullResponse = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      callbacks.onChunk(chunkText);
    }

    callbacks.onComplete(fullResponse);
  } catch (error) {
    console.error('Chat error:', error);
    callbacks.onError('Failed to process chat message');
  }
};
