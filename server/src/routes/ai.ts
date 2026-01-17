import { Router, Response } from 'express';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { Paper } from '../models/Paper.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const getGeminiClient = () => {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
};

const fetchPdfAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
};

router.post('/summary/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.paperId, userId: req.user!.uid });
    
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    if (!paper.fileUrl) {
      res.status(400).json({ error: 'Paper has no PDF file' });
      return;
    }

    const pdfBase64 = await fetchPdfAsBase64(paper.fileUrl);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      {
        text: `You are a research paper assistant. Provide a comprehensive summary of the following research paper. Include:
1. Main objective/research question
2. Methodology used
3. Key findings
4. Conclusions and implications
5. Limitations mentioned

Format your response in a clear, structured manner using markdown.

Please analyze this research paper and provide a comprehensive summary.`,
      },
    ]);

    const summary = result.response.text() || 'Unable to generate summary';

    paper.summary = summary;
    await paper.save();

    res.json({ summary });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

router.post('/chat/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, chatHistory } = req.body;
    
    const paper = await Paper.findOne({ _id: req.params.paperId, userId: req.user!.uid });
    
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    if (!paper.fileUrl) {
      res.status(400).json({ error: 'Paper has no PDF file' });
      return;
    }

    const pdfBase64 = await fetchPdfAsBase64(paper.fileUrl);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
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
      ...(chatHistory || []).map((msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      } as Content)),
    ];

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);

    const response = result.response.text() || 'Unable to generate response';

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
