import { generateSummaryStream, chatWithPaperStream } from '../../controllers/ai.js';
import {
  AuthenticatedSocket,
  AISummaryRequestPayload,
  AIChatRequestPayload,
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
    const { paperId, message, chatHistory } = payload;

    await chatWithPaperStream(paperId, userId, message, chatHistory, {
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
};
