import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
  userId: string;
  paperId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>({
  userId: { type: String, required: true, index: true },
  paperId: { type: String, required: true, index: true },
  content: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

NoteSchema.index({ userId: 1, paperId: 1 }, { unique: true });

export const Note = mongoose.model<INote>('Note', NoteSchema);
