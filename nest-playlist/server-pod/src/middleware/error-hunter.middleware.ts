import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';

export async function errorHunter(req: Request, res: Response, next: () => Promise<any>) {
  try {
    Logger.log('Error Hunter Start: ' + process.hrtime());
    await Promise.resolve().then(() => {
      Logger.log('Error Hunter waited: ' + process.hrtime());
    })
    await next();
  } catch (e) {
    Logger.error(e);
  }
}
