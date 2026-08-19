import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './modules/database/database.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { QueryModule } from './modules/query/query.module';
import { SessionModule } from './modules/session/session.module';
import { MigrationModule } from './modules/migration/migration.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ChaptersModule,
    QueryModule,
    SessionModule,
    MigrationModule,
    WebsocketModule,
  ],
})
export class AppModule {}
