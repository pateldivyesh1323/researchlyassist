import { Socket } from 'socket.io';

export interface AuthenticatedUser {
  userId: string;
  firebaseUid: string;
  email: string;
}

export interface AuthenticatedSocket extends Socket {
  user: AuthenticatedUser;
}

export interface NotesUpdatePayload {
  paperId: string;
  content: string;
}

export interface NotesSavedResponse {
  paperId: string;
  success: boolean;
  updatedAt: string;
}

export interface NotesErrorResponse {
  paperId: string;
  error: string;
}

export interface AISummaryRequestPayload {
  paperId: string;
}

export interface AISummaryChunkResponse {
  paperId: string;
  chunk: string;
  done: boolean;
}

export interface AISummaryCompleteResponse {
  paperId: string;
  summary: string;
}

export interface AIChatRequestPayload {
  paperId: string;
  message: string;
}

export interface AIChatHistoryRequestPayload {
  paperId: string;
}

export interface AIChatClearRequestPayload {
  paperId: string;
}

export interface AIChatHistoryResponse {
  paperId: string;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
}

export interface AIChatClearedResponse {
  paperId: string;
  success: boolean;
}

export interface AIChatChunkResponse {
  paperId: string;
  chunk: string;
  done: boolean;
}

export interface AIChatCompleteResponse {
  paperId: string;
  response: string;
}

export interface AIErrorResponse {
  paperId: string;
  error: string;
}

export interface ClientToServerEvents {
  'notes:update': (payload: NotesUpdatePayload) => void;
  'notes:get': (payload: { paperId: string }) => void;
  'ai:summary': (payload: AISummaryRequestPayload) => void;
  'ai:chat': (payload: AIChatRequestPayload) => void;
  'ai:chat:history': (payload: AIChatHistoryRequestPayload) => void;
  'ai:chat:clear': (payload: AIChatClearRequestPayload) => void;
}

export interface ServerToClientEvents {
  'notes:saved': (payload: NotesSavedResponse) => void;
  'notes:error': (payload: NotesErrorResponse) => void;
  'notes:content': (payload: { paperId: string; content: string }) => void;
  'ai:summary:chunk': (payload: AISummaryChunkResponse) => void;
  'ai:summary:complete': (payload: AISummaryCompleteResponse) => void;
  'ai:summary:error': (payload: AIErrorResponse) => void;
  'ai:chat:chunk': (payload: AIChatChunkResponse) => void;
  'ai:chat:complete': (payload: AIChatCompleteResponse) => void;
  'ai:chat:error': (payload: AIErrorResponse) => void;
  'ai:chat:history:response': (payload: AIChatHistoryResponse) => void;
  'ai:chat:cleared': (payload: AIChatClearedResponse) => void;
}
