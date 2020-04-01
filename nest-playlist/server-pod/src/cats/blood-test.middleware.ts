import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'express';
import { Response } from 'express-serve-static-core';

@Injectable()
export class BloodTestMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    console.log('doing blood test for cats');
    next();
  }
}
