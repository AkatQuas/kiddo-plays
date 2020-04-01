import { Test, TestingModule } from '@nestjs/testing';
import { MyLogger } from './my-logger.service';

describe('MyLoggerService', () => {
  let service: MyLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyLogger],
    }).compile();

    service = module.get<MyLogger>(MyLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
