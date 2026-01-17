import mongoose, { Schema, Document } from 'mongoose';

export interface IPaper extends Document {
  userId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  summary?: string;
  uploadedAt: Date;
}

const PaperSchema = new Schema<IPaper>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  storagePath: { type: String, required: true },
  summary: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

export const Paper = mongoose.model<IPaper>('Paper', PaperSchema);
