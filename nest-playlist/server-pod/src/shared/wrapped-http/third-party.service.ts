import { Injectable, HttpService, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ThirdPartyService {
  @Inject()
  private httpService: HttpService;

  private baseUrl: string = '';

  constructor(
    private configService: ConfigService,
  ) {
    const config = this.configService.get('third-party');
    this.baseUrl = config.baseUrl;
  }

  async getSomeData() {
    const response = await this.httpService.get(
      `${this.baseUrl}/api/data/path`,
      {
        params: { keyword: 'test', }
      }
    ).toPromise();

    return response.data;
  }
}
