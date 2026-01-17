import { generateSummaryStream, chatWithPaperStream, getChatHistory, clearChatHistory } from '../../controllers/ai.js';
import {
  AuthenticatedSocket,
  AISummaryRequestPayload,
  AIChatRequestPayload,
  AIChatHistoryRequestPayload,
  AIChatClearRequestPayload,
} from '../types.js';

export const registerAIHandlers = (socket: AuthenticatedSocket): void => {
  const userId = socket.user.userId;

  socket.on('ai:summary', async (payload: AISummaryRequestPayload) => {
    const { paperId } = payload;

    await generateSummaryStream(paperId, userId, {
      onChunk: (chunk) => {
        socket.emit('ai:summary:chunk', {
          paperId,
          chunk,
          done: false,
        });
      },
      onComplete: (summary) => {
        socket.emit('ai:summary:complete', {
          paperId,
          summary,
        });
      },
      onError: (error) => {
        socket.emit('ai:summary:error', {
          paperId,
          error,
        });
      },
    });
  });

  socket.on('ai:chat', async (payload: AIChatRequestPayload) => {
    const { paperId, message } = payload;

    await chatWithPaperStream(paperId, userId, message, {
      onChunk: (chunk) => {
        socket.emit('ai:chat:chunk', {
          paperId,
          chunk,
          done: false,
        });
      },
      onComplete: (response) => {
        socket.emit('ai:chat:complete', {
          paperId,
          response,
        });
      },
      onError: (error) => {
        socket.emit('ai:chat:error', {
          paperId,
          error,
        });
      },
    });
  });

  socket.on('ai:chat:history', async (payload: AIChatHistoryRequestPayload) => {
    const { paperId } = payload;
    const result = await getChatHistory(paperId, userId);

    if ('error' in result) {
      socket.emit('ai:chat:error', { paperId, error: result.error });
    } else {
      socket.emit('ai:chat:history:response', {
        paperId,
        messages: result.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
      });
    }
  });

  socket.on('ai:chat:clear', async (payload: AIChatClearRequestPayload) => {
    const { paperId } = payload;
    const result = await clearChatHistory(paperId, userId);

    if ('error' in result) {
      socket.emit('ai:chat:error', { paperId, error: result.error });
    } else {
      socket.emit('ai:chat:cleared', { paperId, success: true });
    }
  });
};
