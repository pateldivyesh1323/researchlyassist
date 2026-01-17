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

export interface NotesContentResponse {
  paperId: string;
  content: string;
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
  chatHistory: { role: string; content: string }[];
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
}

export interface ServerToClientEvents {
  'notes:saved': (payload: NotesSavedResponse) => void;
  'notes:error': (payload: NotesErrorResponse) => void;
  'notes:content': (payload: NotesContentResponse) => void;
  'ai:summary:chunk': (payload: AISummaryChunkResponse) => void;
  'ai:summary:complete': (payload: AISummaryCompleteResponse) => void;
  'ai:summary:error': (payload: AIErrorResponse) => void;
  'ai:chat:chunk': (payload: AIChatChunkResponse) => void;
  'ai:chat:complete': (payload: AIChatCompleteResponse) => void;
  'ai:chat:error': (payload: AIErrorResponse) => void;
}
