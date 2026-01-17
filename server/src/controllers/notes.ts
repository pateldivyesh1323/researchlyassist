import { Note } from '../models/Note.js';

export interface NoteData {
  _id: string;
  userId: string;
  paperId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getOrCreateNote = async (
  paperId: string,
  userId: string
): Promise<{ note: NoteData | null; error: string | null }> => {
  try {
    let note = await Note.findOne({ paperId, userId });

    if (!note) {
      note = new Note({
        userId,
        paperId,
        content: '',
      });
      await note.save();
    }

    return { note: note.toObject() as NoteData, error: null };
  } catch (error) {
    console.error('Get note error:', error);
    return { note: null, error: 'Failed to fetch notes' };
  }
};

export const updateNote = async (
  paperId: string,
  userId: string,
  content: string
): Promise<{ note: NoteData | null; error: string | null }> => {
  try {
    const note = await Note.findOneAndUpdate(
      { paperId, userId },
      { content, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    return { note: note?.toObject() as NoteData, error: null };
  } catch (error) {
    console.error('Update note error:', error);
    return { note: null, error: 'Failed to update notes' };
  }
};
