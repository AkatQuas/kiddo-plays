import { Controller, Post, Body } from '@nestjs/common';
import { ChapterInitService } from '../chapters/chapter-init.service';

class ResetDto {
  sessionId?: string;
  chapterId!: string;
}

@Controller('api/session')
export class SessionController {
  constructor(private readonly chapterInit: ChapterInitService) {}

  @Post('reset')
  async reset(@Body() body: ResetDto) {
    const sessionId = body.sessionId || 'default';
    try {
      await this.chapterInit.ensureChapterInitialized(sessionId, body.chapterId);
      await this.chapterInit.resetChapter(sessionId);
      return { data: { reset: true }, message: 'Chapter data reset', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      return { data: null, message, error: { code: 'RESET_ERROR', detail: message } };
    }
  }
}
