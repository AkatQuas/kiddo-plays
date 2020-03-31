import { Request, Response } from 'express';

/**
 *  using the functional middleware
 */

export function pureLogger(req: Request, res: Response, next: Function) {
  console.log('Pure logger ...');
  next();
}
