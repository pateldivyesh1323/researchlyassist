import { getOrCreateNote, updateNote } from '../../controllers/notes.js';
import { AuthenticatedSocket, NotesUpdatePayload } from '../types.js';

export const registerNotesHandlers = (socket: AuthenticatedSocket): void => {
  const userId = socket.user.userId;

  socket.on('notes:get', async (payload: { paperId: string }) => {
    const { paperId } = payload;
    const { note, error } = await getOrCreateNote(paperId, userId);

    if (error || !note) {
      socket.emit('notes:error', { paperId, error: error || 'Unknown error' });
      return;
    }

    socket.emit('notes:content', {
      paperId,
      content: note.content,
    });
  });

  socket.on('notes:update', async (payload: NotesUpdatePayload) => {
    const { paperId, content } = payload;
    const { error } = await updateNote(paperId, userId, content);

    if (error) {
      socket.emit('notes:error', { paperId, error });
      return;
    }

    socket.emit('notes:saved', {
      paperId,
      success: true,
      updatedAt: new Date().toISOString(),
    });
  });
};
