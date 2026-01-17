import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PrivateRoute } from '@/components/wrappers';
import { papersApi, Paper, PaginationInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Plus,
  FileText,
  Trash2,
  Upload,
  LogOut,
  User,
  Search,
  Loader2,
  Moon,
  Sun,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';
const PAPERS_PER_PAGE = 15;

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevDebouncedSearch = useRef(debouncedSearch);

  const fetchPapers = useCallback(async (search: string, sort: SortOption, page: number) => {
    setIsLoading(true);
    try {
      const data = await papersApi.getAll({
        search: search || undefined,
        sort,
        page,
        limit: PAPERS_PER_PAGE,
      });
      setPapers(data.papers);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to fetch papers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      setCurrentPage(1);
      prevDebouncedSearch.current = debouncedSearch;
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (user) {
      fetchPapers(debouncedSearch, sortBy, currentPage);
    }
  }, [user, debouncedSearch, sortBy, currentPage, fetchPapers]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file');
        return;
      }
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace('.pdf', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle) {
      toast.error('Please provide a title and select a file');
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await papersApi.upload({
        title: uploadTitle,
        fileName: selectedFile.name,
        fileBase64: base64,
      });
      toast.success('Paper uploaded successfully!');
      setUploadOpen(false);
      setUploadTitle('');
      setSelectedFile(null);
      fetchPapers(debouncedSearch, sortBy, currentPage);
    } catch (error) {
      toast.error('Failed to upload paper');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this paper?')) return;

    try {
      await papersApi.delete(id);
      toast.success('Paper deleted');
      fetchPapers(debouncedSearch, sortBy, currentPage);
    } catch (error) {
      toast.error('Failed to delete paper');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const sortLabels: Record<SortOption, string> = {
    'newest': 'Newest first',
    'oldest': 'Oldest first',
    'title-asc': 'Title A-Z',
    'title-desc': 'Title Z-A',
  };

  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total || 0;

  return (
    <PrivateRoute>
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <h1 className="text-lg font-semibold">Researchly Assist</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search papers..."
                className="pl-9 w-60"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden lg:inline">{sortLabels[sortBy]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => handleSortChange(v as SortOption)}>
                  <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="title-asc">Title A-Z</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="title-desc">Title Z-A</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Paper</DialogTitle>
                  <DialogDescription>
                    Add a PDF to your library
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Paper title"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>File</Label>
                    <div
                      className="border border-dashed rounded-md p-6 text-center cursor-pointer hover:border-foreground/30 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      {selectedFile ? (
                        <p className="text-sm">{selectedFile.name}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Click to select a PDF
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading || !selectedFile || !uploadTitle}>
                    {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback className="bg-muted">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback className="bg-muted">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 md:hidden space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search papers..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  {sortLabels[sortBy]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => handleSortChange(v as SortOption)}>
                  <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="title-asc">Title A-Z</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="title-desc">Title Z-A</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {debouncedSearch ? 'No papers found' : 'No papers yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {debouncedSearch
                ? 'Try a different search term'
                : 'Upload your first paper to get started'}
            </p>
            {!debouncedSearch && (
              <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Upload Paper
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {papers.map((paper) => (
              <Link
                key={paper._id}
                to="/paper/$paperId"
                params={{ paperId: paper._id }}
                className="block"
              >
                <Card className="h-full hover:bg-muted/50 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2">
                          {paper.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {new Date(paper.uploadedAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(paper._id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" />
                      <span className="truncate">{paper.fileName}</span>
                    </div>
                    {paper.summary && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {paper.summary.slice(0, 120)}...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-1 text-muted-foreground">...</span>;
                    }
                    return null;
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAPERS_PER_PAGE + 1}-{Math.min(currentPage * PAPERS_PER_PAGE, total)} of {total} papers
            </p>
          </div>
        )}
      </main>
    </div>
    </PrivateRoute>
  );
}
