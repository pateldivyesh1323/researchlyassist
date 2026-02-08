import { Router, Response } from 'express';
import { Paper } from '../models/Paper.js';
import { Note } from '../models/Note.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, sort = 'newest', page = '1', limit = '15', tag } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { userId: req.user!.userId };
    
    if (search && typeof search === 'string' && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    if (tag && typeof tag === 'string' && tag.trim()) {
      query.tags = tag.trim();
    }

    let sortOption: Record<string, 1 | -1> = { uploadedAt: -1 };
    switch (sort) {
      case 'oldest':
        sortOption = { uploadedAt: 1 };
        break;
      case 'title-asc':
        sortOption = { title: 1 };
        break;
      case 'title-desc':
        sortOption = { title: -1 };
        break;
      case 'newest':
      default:
        sortOption = { uploadedAt: -1 };
    }

    const [papers, total] = await Promise.all([
      Paper.find(query).sort(sortOption).skip(skip).limit(limitNum),
      Paper.countDocuments(query),
    ]);

    res.json({
      papers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

router.get('/tags', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tags = await Paper.distinct('tags', { userId: req.user!.userId });
    res.json({ tags: tags.filter(Boolean).sort() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }
    res.json(paper);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

router.post('/upload', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, fileName, fileBase64, tags } = req.body;
    
    if (!title || !fileName || !fileBase64) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');

    const folder = `researchly-assist/papers/${req.user!.userId}`;
    const uniqueFileName = `${Date.now()}_${fileName.replace(/\.[^/.]+$/, '')}`;
    const { url: fileUrl, publicId: storagePath } = await uploadToCloudinary(buffer, folder, uniqueFileName);

    const cleanTags = Array.isArray(tags)
      ? tags.map((t: string) => String(t).trim().toLowerCase()).filter((t: string) => t.length > 0)
      : [];

    const paper = new Paper({
      userId: req.user!.userId,
      title,
      fileName,
      fileUrl,
      storagePath,
      tags: [...new Set(cleanTags)],
    });

    await paper.save();
    res.status(201).json(paper);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload paper' });
  }
});

router.patch('/:id/tags', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      res.status(400).json({ error: 'Tags must be an array' });
      return;
    }

    const cleanTags = tags
      .map((t: string) => t.trim().toLowerCase())
      .filter((t: string) => t.length > 0);

    const paper = await Paper.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { tags: cleanTags },
      { new: true }
    );

    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    res.json(paper);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

router.patch('/:id/progress', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lastReadPage, totalPages } = req.body;

    const update: Record<string, number> = {};
    if (typeof lastReadPage === 'number') update.lastReadPage = lastReadPage;
    if (typeof totalPages === 'number') update.totalPages = totalPages;

    const paper = await Paper.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      update,
      { new: true }
    );

    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    res.json(paper);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

router.get('/:id/recommendations', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    const searchQuery = encodeURIComponent(paper.title);
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${searchQuery}&limit=10&fields=title,authors,year,abstract,url,citationCount,externalIds`,
    );

    if (!response.ok) {
      res.status(502).json({ error: 'Failed to fetch recommendations from Semantic Scholar' });
      return;
    }

    const data = await response.json() as { data?: Array<{ paperId: string; title: string; authors?: Array<{ name: string }>; year?: number; abstract?: string; url?: string; citationCount?: number; externalIds?: Record<string, string> }> };
    const recommendations = (data.data || [])
      .filter((p: { title: string }) => p.title.toLowerCase() !== paper.title.toLowerCase())
      .slice(0, 8);

    res.json({ recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user!.userId });
    
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    try {
      await deleteFromCloudinary(paper.storagePath);
    } catch (storageError) {
      console.error('Storage delete error:', storageError);
    }

    await Note.deleteMany({ paperId: req.params.id, userId: req.user!.userId });
    await Paper.deleteOne({ _id: req.params.id });
    res.json({ message: 'Paper deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete paper' });
  }
});

export default router;
