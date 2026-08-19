import { Body, Controller, Post } from '@nestjs/common';
import { QueryService } from './query.service';

class ExecuteDto {
  sessionId?: string;
  chapterId!: string;
  sql!: string;
  explain?: boolean;
  clozeValues?: Record<string, string>;
}

class SessionDto {
  sessionId?: string;
  chapterId!: string;
}

@Controller('api/query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post('execute')
  async execute(@Body() body: ExecuteDto) {
    const sessionId = body.sessionId || 'default';
    try {
      const data = await this.queryService.execute(sessionId, body.chapterId, body.sql, {
        explain: body.explain,
        clozeValues: body.clozeValues,
      });
      return { data, message: 'OK', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      return {
        data: null,
        message,
        error: { code: 'QUERY_ERROR', detail: message },
      };
    }
  }

  @Post('explain')
  async explain(@Body() body: ExecuteDto) {
    const sessionId = body.sessionId || 'default';
    try {
      const data = await this.queryService.explainOnly(sessionId, body.chapterId, body.sql);
      return { data, message: 'OK', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Explain failed';
      return { data: null, message, error: { code: 'EXPLAIN_ERROR', detail: message } };
    }
  }

  @Post('commit')
  async commit(@Body() body: SessionDto) {
    const sessionId = body.sessionId || 'default';
    try {
      await this.queryService.commit(sessionId);
      return { data: { transactionStatus: 'committed' }, message: 'Transaction committed', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Commit failed';
      return { data: null, message, error: { code: 'COMMIT_ERROR', detail: message } };
    }
  }

  @Post('rollback')
  async rollback(@Body() body: SessionDto) {
    const sessionId = body.sessionId || 'default';
    try {
      await this.queryService.rollback(sessionId);
      return { data: { transactionStatus: 'rolled_back' }, message: 'Transaction rolled back', error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed';
      return { data: null, message, error: { code: 'ROLLBACK_ERROR', detail: message } };
    }
  }
}
