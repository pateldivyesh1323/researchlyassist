import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  paperId: mongoose.Types.ObjectId;
  userId: string;
  isIndexed: boolean;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
    userId: { type: String, required: true, index: true },
    isIndexed: { type: Boolean, default: false },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ paperId: 1, userId: 1 }, { unique: true });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
