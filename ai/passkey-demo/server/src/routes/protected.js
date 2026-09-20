import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendOk } from '../utils/response.js';

const router = Router();

router.get('/data', requireAuth, (req, res) => {
  return sendOk(res, {
    message: 'This is protected data only visible to authenticated users.',
    fetchedAt: new Date().toISOString(),
  });
});

export default router;
