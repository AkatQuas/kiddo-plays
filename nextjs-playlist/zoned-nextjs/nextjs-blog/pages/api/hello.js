import cors from '../../lib/middleware/cors';
import runMiddleware from '../../lib/middleware/index';

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

export default async function handler(req, res) {
  // Run the middleware
  await runMiddleware(req, res, cors);
  res.statusCode = 200;
  res.json({ name: 'John Doe' });
}
