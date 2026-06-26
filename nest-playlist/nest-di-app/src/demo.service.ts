import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy
} from '@nestjs/common';

@Injectable()
export class DemoService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(DemoService.name); // 自动填充上下文
  private timer: NodeJS.Timeout;

  constructor() {
    // 模拟长驻资源：定时器、数据库连接、redis client
    this.timer = setInterval(() => {
      console.log('服务运行中...');
    }, 1000);
  }

  sayHello(name: string) {
    return `Hello ${name}, DI works without http!`;
  }

  // 模块销毁时执行
  async onModuleDestroy() {
    this.logger.log('[DemoService] 触发 OnModuleDestroy');
    // 清理本地定时器、临时流
    if (this.timer) clearInterval(this.timer);
  }

  // 应用整体关闭最终钩子（可接收关闭信号）
  async onApplicationShutdown(signal?: string) {
    // e.g. "SIGINT"
    this.logger.log(`[DemoService] 应用关闭，信号：${signal}`);
  }
}
