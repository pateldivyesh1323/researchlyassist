import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { papersApi, Paper } from '@/lib/api';
import { useNotes, useAISummary, useAIChat } from '@/lib/websocket';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Sparkles,
  MessageSquare,
  StickyNote,
  Send,
  Loader2,
  ZoomIn,
  ZoomOut,
  FileText,
  Save,
  Moon,
  Sun,
  GripVertical,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PanelTab = 'summary' | 'chat' | 'notes';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function PaperViewPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as PanelTab) || 'summary';
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (!paperId) {
    return null;
  }

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);

  const [summary, setSummary] = useState<string>('');
  const [streamingSummary, setStreamingSummary] = useState<string>('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streamingResponse, setStreamingResponse] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatHistoryFetchedRef = useRef(false);

  const [noteContent, setNoteContent] = useState('');
  const [debouncedNoteContent] = useDebounce(noteContent, 2000);
  const hasUserModified = useRef(false);
  const notesFetchedRef = useRef(false);
  const pdfScrollRef = useRef<HTMLDivElement>(null);

  const [panelWidth, setPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const MIN_PANEL_WIDTH = 280;
  const MAX_PANEL_WIDTH = 700;

  const { fetchNotes, updateNotes, isSaving: savingNotes, isConnected: notesConnected } = useNotes({
    paperId,
    onContent: (content) => {
      if (!notesFetchedRef.current) {
        setNoteContent(content);
        notesFetchedRef.current = true;
      }
    },
    onError: (error) => {
      toast.error(error.error);
    },
  });

  const { generateSummary, isGenerating: generatingSummary } = useAISummary({
    paperId,
    onChunk: (chunk) => {
      setStreamingSummary((prev) => prev + chunk);
    },
    onComplete: (completeSummary) => {
      setSummary(completeSummary);
      setStreamingSummary('');
      toast.success('Summary generated!');
    },
    onError: (error) => {
      setStreamingSummary('');
      toast.error(error);
    },
  });

  const { sendMessage: sendChatMessage, fetchHistory: fetchChatHistory, clearHistory: clearChatHistory, isSending: sendingMessage, isConnected: chatConnected } = useAIChat({
    paperId,
    onChunk: (chunk) => {
      setStreamingResponse((prev) => prev + chunk);
    },
    onComplete: (response) => {
      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      setChatMessages((prev) => [...prev, assistantMessage]);
      setStreamingResponse('');
    },
    onHistoryLoaded: (messages) => {
      setChatMessages(messages.map((m) => ({ role: m.role, content: m.content })));
    },
    onCleared: () => {
      setChatMessages([]);
      toast.success('Chat history cleared');
    },
    onError: (error) => {
      toast.error(error);
      setChatMessages((prev) => prev.slice(0, -1));
      setStreamingResponse('');
    },
  });

  const updateSearchParams = (params: { tab?: PanelTab }) => {
    if (params.tab) {
      setSearchParams({ tab: params.tab }, { replace: true });
    }
  };

  useEffect(() => {
    if (user && paperId) {
      fetchPaper();
    }
  }, [user, paperId]);

  useEffect(() => {
    if (notesConnected && !notesFetchedRef.current) {
      fetchNotes();
    }
  }, [notesConnected, fetchNotes]);

  useEffect(() => {
    if (chatConnected && !chatHistoryFetchedRef.current) {
      fetchChatHistory();
      chatHistoryFetchedRef.current = true;
    }
  }, [chatConnected, fetchChatHistory]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, streamingResponse]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    
    if (newWidth >= MIN_PANEL_WIDTH && newWidth <= MAX_PANEL_WIDTH) {
      setPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const fetchPaper = async () => {
    try {
      const data = await papersApi.getOne(paperId);
      setPaper(data);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      toast.error('Failed to load paper');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = () => {
    setStreamingSummary('');
    setSummary('');
    generateSummary();
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setStreamingResponse('');
    
    sendChatMessage(chatInput);
  };

  const handleClearChat = () => {
    clearChatHistory();
  };

  useEffect(() => {
    if (hasUserModified.current && notesFetchedRef.current) {
      updateNotes(debouncedNoteContent);
    }
  }, [debouncedNoteContent, updateNotes]);

  const handleManualSave = () => {
    hasUserModified.current = false;
    updateNotes(noteContent);
    toast.success('Notes saved!');
  };

  const handleEditorChange = (value: string | undefined) => {
    hasUserModified.current = true;
    setNoteContent(value || '');
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const displaySummary = streamingSummary || summary;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!paper) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="shrink-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-2 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-medium truncate max-w-md">{paper.title}</h1>
            <p className="text-xs text-muted-foreground">
              {new Date(paper.uploadedAt).toLocaleDateString()}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b">
            <span className="text-xs text-muted-foreground">
              {numPages > 0 ? `${numPages} pages` : 'Loading...'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div 
            ref={pdfScrollRef}
            className="flex-1 overflow-auto"
          >
            <div className="flex flex-col items-center gap-4 p-4 bg-muted/30 min-h-full">
              <Document
                file={paper.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mb-2" />
                    <p className="text-sm">Failed to load PDF</p>
                  </div>
                }
              >
                {Array.from(new Array(numPages), (_, index) => (
                  <div key={`page_${index + 1}`} className="shadow-sm mb-4">
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)}
                      canvasBackground="white"
                    />
                  </div>
                ))}
              </Document>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 w-1 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group transition-colors"
          onMouseDown={handleResizeStart}
        >
          <div className="w-4 h-8 flex items-center justify-center rounded bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>

        <div 
          className="flex flex-col bg-background overflow-hidden"
          style={{ width: panelWidth }}
        >
          <Tabs 
            value={tab} 
            onValueChange={(value) => updateSearchParams({ tab: value as PanelTab })}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="shrink-0 grid w-full grid-cols-3 rounded-none border-b h-10">
              <TabsTrigger value="summary" className="gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 text-xs">
                <StickyNote className="w-3.5 h-3.5" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {displaySummary ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 border-b">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Summary</span>
                        {generatingSummary && (
                          <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                        )}
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h1]:font-semibold [&>h2]:font-medium [&>h3]:font-medium [&>p]:text-[13px] [&>ul]:text-[13px] [&>ol]:text-[13px] [&>li]:text-[13px]">
                        <ReactMarkdown>{displaySummary}</ReactMarkdown>
                        {generatingSummary && (
                          <span className="inline-block w-1.5 h-3.5 bg-muted-foreground/50 animate-pulse ml-0.5 rounded-sm" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-sm mb-1">No summary yet</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Generate an AI-powered summary of this paper
                      </p>
                      <Button
                        onClick={handleGenerateSummary}
                        disabled={generatingSummary}
                        size="sm"
                        className="gap-2"
                      >
                        {generatingSummary ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Summary
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {(summary || streamingSummary) && !generatingSummary && (
                <div className="p-3 border-t">
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="w-3 h-3" />
                    Regenerate summary
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              {chatMessages.length > 0 && (
                <div className="shrink-0 flex items-center justify-end px-3 py-1.5 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1.5"
                    onClick={handleClearChat}
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear chat
                  </Button>
                </div>
              )}
              <ScrollArea className="flex-1" ref={chatScrollRef}>
                <div className="p-4 space-y-3">
                  {chatMessages.length === 0 && !streamingResponse ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                      <h3 className="font-medium mb-1">Chat with your paper</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions about the content
                      </p>
                    </div>
                  ) : (
                    <>
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                              <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white">
                                <Sparkles className="w-3.5 h-3.5" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-linear-to-br from-muted/80 to-muted border border-border/50 rounded-tl-sm shadow-sm'
                            }`}
                          >
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            ) : (
                              <p className="text-sm">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {streamingResponse && (
                        <div className="flex gap-2 justify-start">
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                            <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white">
                              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="max-w-[85%] rounded-xl rounded-tl-sm px-3.5 py-2.5 bg-linear-to-br from-muted/80 to-muted border border-border/50 shadow-sm">
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{streamingResponse}</ReactMarkdown>
                              <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 rounded-sm" />
                            </div>
                          </div>
                        </div>
                      )}
                      {sendingMessage && !streamingResponse && (
                        <div className="flex gap-2 justify-start">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white">
                              <Sparkles className="w-3.5 h-3.5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-linear-to-br from-muted/80 to-muted border border-border/50 rounded-xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Ask about this paper..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={sendingMessage}
                    className="h-9"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9" disabled={sendingMessage || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-hidden" data-color-mode={theme}>
                <MDEditor
                  value={noteContent}
                  onChange={handleEditorChange}
                  height="100%"
                  preview="live"
                  hideToolbar={false}
                  enableScroll={true}
                  textareaProps={{
                    placeholder: 'Write your notes in Markdown...',
                  }}
                />
              </div>
              <div className="p-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {savingNotes ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Auto-saved'
                  )}
                </span>
                <Button variant="outline" size="sm" onClick={handleManualSave} className="gap-1.5 h-7 text-xs">
                  <Save className="w-3.5 h-3.5" />
                  Save
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
