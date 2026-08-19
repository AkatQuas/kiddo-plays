import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { ChaptersModule } from '../chapters/chapters.module';

@Module({
  imports: [ChaptersModule],
  controllers: [SessionController],
})
export class SessionModule {}
