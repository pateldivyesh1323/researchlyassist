import { useEffect, useCallback, useRef, useState } from 'react';
import { socketManager, TypedSocket } from './socket';
import type {
  NotesSavedResponse,
  NotesErrorResponse,
  NotesContentResponse,
  AISummaryChunkResponse,
  AISummaryCompleteResponse,
  AIChatChunkResponse,
  AIChatCompleteResponse,
  AIChatHistoryResponse,
  AIChatClearedResponse,
  AIDefineChunkResponse,
  AIDefineCompleteResponse,
  AIErrorResponse,
} from './types';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<TypedSocket | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        const sock = await socketManager.connect();
        if (mounted) {
          setSocket(sock);
          setIsConnected(true);
        }
      } catch (error) {
        if (mounted) {
          setIsConnected(false);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  return { socket, isConnected };
};

interface UseNotesOptions {
  paperId: string;
  onContent?: (content: string) => void;
  onSaved?: (response: NotesSavedResponse) => void;
  onError?: (error: NotesErrorResponse) => void;
}

export const useNotes = ({ paperId, onContent, onSaved, onError }: UseNotesOptions) => {
  const { socket, isConnected } = useSocket();
  const [isSaving, setIsSaving] = useState(false);
  const onContentRef = useRef(onContent);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onContentRef.current = onContent;
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
  }, [onContent, onSaved, onError]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleContent = (response: NotesContentResponse) => {
      if (response.paperId === paperId) {
        onContentRef.current?.(response.content);
      }
    };

    const handleSaved = (response: NotesSavedResponse) => {
      if (response.paperId === paperId) {
        setIsSaving(false);
        onSavedRef.current?.(response);
      }
    };

    const handleError = (response: NotesErrorResponse) => {
      if (response.paperId === paperId) {
        setIsSaving(false);
        onErrorRef.current?.(response);
      }
    };

    socket.on('notes:content', handleContent);
    socket.on('notes:saved', handleSaved);
    socket.on('notes:error', handleError);

    return () => {
      socket.off('notes:content', handleContent);
      socket.off('notes:saved', handleSaved);
      socket.off('notes:error', handleError);
    };
  }, [socket, isConnected, paperId]);

  const fetchNotes = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('notes:get', { paperId });
    }
  }, [socket, isConnected, paperId]);

  const updateNotes = useCallback(
    (content: string) => {
      if (socket && isConnected) {
        setIsSaving(true);
        socket.emit('notes:update', { paperId, content });
      }
    },
    [socket, isConnected, paperId]
  );

  return { fetchNotes, updateNotes, isSaving, isConnected };
};

interface UseAISummaryOptions {
  paperId: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (summary: string) => void;
  onError?: (error: string) => void;
}

export const useAISummary = ({ paperId, onChunk, onComplete, onError }: UseAISummaryOptions) => {
  const { socket, isConnected } = useSocket();
  const [isGenerating, setIsGenerating] = useState(false);
  const onChunkRef = useRef(onChunk);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onChunkRef.current = onChunk;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onChunk, onComplete, onError]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleChunk = (response: AISummaryChunkResponse) => {
      if (response.paperId === paperId) {
        onChunkRef.current?.(response.chunk);
      }
    };

    const handleComplete = (response: AISummaryCompleteResponse) => {
      if (response.paperId === paperId) {
        setIsGenerating(false);
        onCompleteRef.current?.(response.summary);
      }
    };

    const handleError = (response: AIErrorResponse) => {
      if (response.paperId === paperId) {
        setIsGenerating(false);
        onErrorRef.current?.(response.error);
      }
    };

    socket.on('ai:summary:chunk', handleChunk);
    socket.on('ai:summary:complete', handleComplete);
    socket.on('ai:summary:error', handleError);

    return () => {
      socket.off('ai:summary:chunk', handleChunk);
      socket.off('ai:summary:complete', handleComplete);
      socket.off('ai:summary:error', handleError);
    };
  }, [socket, isConnected, paperId]);

  const generateSummary = useCallback(() => {
    if (socket && isConnected) {
      setIsGenerating(true);
      socket.emit('ai:summary', { paperId });
    }
  }, [socket, isConnected, paperId]);

  return { generateSummary, isGenerating, isConnected };
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface UseAIChatOptions {
  paperId: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (response: string) => void;
  onHistoryLoaded?: (messages: ChatMessage[]) => void;
  onCleared?: () => void;
  onError?: (error: string) => void;
}

export const useAIChat = ({ paperId, onChunk, onComplete, onHistoryLoaded, onCleared, onError }: UseAIChatOptions) => {
  const { socket, isConnected } = useSocket();
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const onChunkRef = useRef(onChunk);
  const onCompleteRef = useRef(onComplete);
  const onHistoryLoadedRef = useRef(onHistoryLoaded);
  const onClearedRef = useRef(onCleared);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onChunkRef.current = onChunk;
    onCompleteRef.current = onComplete;
    onHistoryLoadedRef.current = onHistoryLoaded;
    onClearedRef.current = onCleared;
    onErrorRef.current = onError;
  }, [onChunk, onComplete, onHistoryLoaded, onCleared, onError]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleChunk = (response: AIChatChunkResponse) => {
      if (response.paperId === paperId) {
        onChunkRef.current?.(response.chunk);
      }
    };

    const handleComplete = (response: AIChatCompleteResponse) => {
      if (response.paperId === paperId) {
        setIsSending(false);
        onCompleteRef.current?.(response.response);
      }
    };

    const handleHistoryResponse = (response: AIChatHistoryResponse) => {
      if (response.paperId === paperId) {
        setIsLoadingHistory(false);
        onHistoryLoadedRef.current?.(response.messages);
      }
    };

    const handleCleared = (response: AIChatClearedResponse) => {
      if (response.paperId === paperId && response.success) {
        onClearedRef.current?.();
      }
    };

    const handleError = (response: AIErrorResponse) => {
      if (response.paperId === paperId) {
        setIsSending(false);
        setIsLoadingHistory(false);
        onErrorRef.current?.(response.error);
      }
    };

    socket.on('ai:chat:chunk', handleChunk);
    socket.on('ai:chat:complete', handleComplete);
    socket.on('ai:chat:history:response', handleHistoryResponse);
    socket.on('ai:chat:cleared', handleCleared);
    socket.on('ai:chat:error', handleError);

    return () => {
      socket.off('ai:chat:chunk', handleChunk);
      socket.off('ai:chat:complete', handleComplete);
      socket.off('ai:chat:history:response', handleHistoryResponse);
      socket.off('ai:chat:cleared', handleCleared);
      socket.off('ai:chat:error', handleError);
    };
  }, [socket, isConnected, paperId]);

  const sendMessage = useCallback(
    (message: string) => {
      if (socket && isConnected) {
        setIsSending(true);
        socket.emit('ai:chat', { paperId, message });
      }
    },
    [socket, isConnected, paperId]
  );

  const fetchHistory = useCallback(() => {
    if (socket && isConnected) {
      setIsLoadingHistory(true);
      socket.emit('ai:chat:history', { paperId });
    }
  }, [socket, isConnected, paperId]);

  const clearHistory = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('ai:chat:clear', { paperId });
    }
  }, [socket, isConnected, paperId]);

  return { sendMessage, fetchHistory, clearHistory, isSending, isLoadingHistory, isConnected };
};

interface UseAIDefineOptions {
  paperId: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (definition: string, term: string) => void;
  onError?: (error: string) => void;
}

export const useAIDefine = ({ paperId, onChunk, onComplete, onError }: UseAIDefineOptions) => {
  const { socket, isConnected } = useSocket();
  const [isDefining, setIsDefining] = useState(false);
  const onChunkRef = useRef(onChunk);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onChunkRef.current = onChunk;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onChunk, onComplete, onError]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleChunk = (response: AIDefineChunkResponse) => {
      if (response.paperId === paperId) {
        onChunkRef.current?.(response.chunk);
      }
    };

    const handleComplete = (response: AIDefineCompleteResponse) => {
      if (response.paperId === paperId) {
        setIsDefining(false);
        onCompleteRef.current?.(response.definition, response.term);
      }
    };

    const handleError = (response: AIErrorResponse) => {
      if (response.paperId === paperId) {
        setIsDefining(false);
        onErrorRef.current?.(response.error);
      }
    };

    socket.on('ai:define:chunk', handleChunk);
    socket.on('ai:define:complete', handleComplete);
    socket.on('ai:define:error', handleError);

    return () => {
      socket.off('ai:define:chunk', handleChunk);
      socket.off('ai:define:complete', handleComplete);
      socket.off('ai:define:error', handleError);
    };
  }, [socket, isConnected, paperId]);

  const defineTerm = useCallback(
    (term: string, context?: string) => {
      if (socket && isConnected) {
        setIsDefining(true);
        socket.emit('ai:define', { paperId, term, context });
      }
    },
    [socket, isConnected, paperId]
  );

  return { defineTerm, isDefining, isConnected };
};
