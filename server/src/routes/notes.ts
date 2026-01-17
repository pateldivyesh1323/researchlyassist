import { Router, Response } from 'express';
import { getOrCreateNote, updateNote } from '../controllers/notes.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const paperId = req.params.paperId as string;
  const { note, error } = await getOrCreateNote(paperId, req.user!.userId);

  if (error || !note) {
    res.status(500).json({ error: error || 'Unknown error' });
    return;
  }

  res.json(note);
});

router.put('/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const paperId = req.params.paperId as string;
  const { content } = req.body;
  const { note, error } = await updateNote(paperId, req.user!.userId, content);

  if (error || !note) {
    res.status(500).json({ error: error || 'Unknown error' });
    return;
  }

  res.json(note);
});

export default router;
