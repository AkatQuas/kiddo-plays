import { Module } from '@nestjs/common';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { ChapterInitService } from './chapter-init.service';

@Module({
  controllers: [ChaptersController],
  providers: [ChaptersService, ChapterInitService],
  exports: [ChaptersService, ChapterInitService],
})
export class ChaptersModule {}
