import { Controller, Get, Param } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { ChapterInitService } from './chapter-init.service';

@Controller('api/chapters')
export class ChaptersController {
  constructor(
    private readonly chaptersService: ChaptersService,
    private readonly chapterInitService: ChapterInitService,
  ) {}

  @Get()
  list() {
    const data = this.chaptersService.getAllChapters();
    return { data, message: 'OK', error: null };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const chapter = this.chaptersService.getChapterById(id);
    if (!chapter) {
      return { data: null, message: 'Chapter not found', error: { code: 'NOT_FOUND' } };
    }
    await this.chapterInitService.ensureChapterInitialized('default', id);
    return { data: chapter, message: 'OK', error: null };
  }
}
