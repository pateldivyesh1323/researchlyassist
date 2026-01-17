import { Router, Response } from 'express';
import OpenAI from 'openai';
import { Paper } from '../models/Paper.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
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

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a research paper assistant. Provide a comprehensive summary of the following research paper. Include:
1. Main objective/research question
2. Methodology used
3. Key findings
4. Conclusions and implications
5. Limitations mentioned

Format your response in a clear, structured manner using markdown.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: paper.fileName,
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Please analyze this research paper and provide a comprehensive summary.',
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary';

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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a helpful research assistant. You have access to the attached research paper. Answer questions about this paper accurately and helpfully. If the question cannot be answered from the paper content, say so.

Paper Title: ${paper.title}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: {
              filename: paper.fileName,
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
          },
          {
            type: 'text',
            text: 'I have attached a research paper. I will ask questions about it.',
          },
        ],
      },
      {
        role: 'assistant',
        content: 'I have received the research paper. Please go ahead and ask your questions about it.',
      },
      ...(chatHistory || []).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 'Unable to generate response';

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
