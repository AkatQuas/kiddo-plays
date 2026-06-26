import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { BizService } from './biz.service';
import { DemoService } from './demo.service';

async function bootstrap() {
  // 关键：createApplicationContext 创建无HTTP的DI容器
  const appContext = await NestFactory.createApplicationContext(AppModule);

  // 监听系统退出信号
  process.on('SIGINT', async () => {
    console.log('\n捕获 Ctrl+C，开始销毁资源...');
    await appContext.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n捕获进程终止信号，开始销毁资源...');
    await appContext.close();
    process.exit(0);
  });

  // 从容器获取实例（支持泛型）
  const demoSvc = appContext.get(DemoService);
  console.log(demoSvc.sayHello('test'));

  const biz = appContext.get(BizService);
  biz.runTask();

  // 销毁容器，释放资源（数据库连接等）
  await appContext.close();
}

bootstrap();
