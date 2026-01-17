import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';
import { papersApi, aiApi, notesApi, Paper, Note } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  StickyNote,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute('/paper/$paperId')({
  component: PaperViewPage,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function PaperViewPage() {
  const { paperId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const [summary, setSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/' });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && paperId) {
      fetchPaper();
      fetchNotes();
    }
  }, [user, paperId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const fetchPaper = async () => {
    try {
      const data = await papersApi.getOne(paperId);
      setPaper(data);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      toast.error('Failed to load paper');
      navigate({ to: '/dashboard' });
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const data = await notesApi.get(paperId);
      setNotes(data);
      setNoteContent(data.content);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const { summary: newSummary } = await aiApi.generateSummary(paperId);
      setSummary(newSummary);
      toast.success('Summary generated!');
    } catch (error) {
      toast.error('Failed to generate summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setSendingMessage(true);

    try {
      const { response } = await aiApi.chat(paperId, chatInput, chatMessages);
      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to send message');
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleNoteChange = (value: string) => {
    setNoteContent(value);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1000);
  };

  const saveNotes = async (content: string) => {
    setSavingNotes(true);
    try {
      await notesApi.update(paperId, content);
    } catch (error) {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveNotes(noteContent);
    toast.success('Notes saved!');
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft">
          <BookOpen className="w-16 h-16 text-primary" />
        </div>
      </div>
    );
  }

  if (!paper) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate max-w-md">{paper.title}</h1>
              <p className="text-xs text-muted-foreground">
                {new Date(paper.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[100px] text-center">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale((s) => Math.min(2, s + 0.1))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex justify-center p-4 bg-muted/20">
              <Document
                file={paper.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mb-2" />
                    <p>Failed to load PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  className="shadow-lg"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
          </ScrollArea>
        </div>

        <div className="w-[450px] flex flex-col bg-card">
          <Tabs defaultValue="summary" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
              <TabsTrigger value="summary" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <StickyNote className="w-4 h-4" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {summary ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No summary yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate an AI-powered summary of this paper
                      </p>
                      <Button
                        onClick={handleGenerateSummary}
                        disabled={generatingSummary}
                        className="gap-2"
                      >
                        {generatingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Summary
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {summary && (
                <div className="p-4 border-t">
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {generatingSummary ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Regenerate Summary
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
              <ScrollArea className="flex-1" ref={chatScrollRef}>
                <div className="p-4 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">Chat with your paper</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions and get answers based on the paper content
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {sendingMessage && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-4">
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
                  />
                  <Button type="submit" size="icon" disabled={sendingMessage || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
              <div className="flex-1 p-4">
                <Textarea
                  placeholder="Write your notes here..."
                  className="h-full min-h-[300px] resize-none"
                  value={noteContent}
                  onChange={(e) => handleNoteChange(e.target.value)}
                />
              </div>
              <div className="p-4 border-t flex items-center justify-between">
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
                <Button variant="outline" size="sm" onClick={handleManualSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Now
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
