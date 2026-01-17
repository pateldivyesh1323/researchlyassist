import { Router, Response } from 'express';
import { Paper } from '../models/Paper.js';
import { Note } from '../models/Note.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, sort = 'newest', page = '1', limit = '15' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { userId: req.user!.userId };
    
    if (search && typeof search === 'string' && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
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
    const { title, fileName, fileBase64 } = req.body;
    
    if (!title || !fileName || !fileBase64) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');

    const folder = `researchly-assist/papers/${req.user!.userId}`;
    const uniqueFileName = `${Date.now()}_${fileName.replace(/\.[^/.]+$/, '')}`;
    const { url: fileUrl, publicId: storagePath } = await uploadToCloudinary(buffer, folder, uniqueFileName);

    const paper = new Paper({
      userId: req.user!.userId,
      title,
      fileName,
      fileUrl,
      storagePath,
    });

    await paper.save();
    res.status(201).json(paper);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload paper' });
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
