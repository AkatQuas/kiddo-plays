import { Module, HttpModule, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThirdPartyService } from './third-party.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      maxRedirects: 5,
      timeout: 100000,
    })
  ],
  providers: [ThirdPartyService],
  exports: [ThirdPartyService],
})
export class WrappedHttpModule { }
