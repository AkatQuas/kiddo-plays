import { trace } from '@opentelemetry/api';
import { initTracing } from './tracing.mjs';

const sleep = (t) =>
  new Promise((resolve, reject) => {
    setTimeout(resolve, t);
  });

// Wait for SDK to be ready before starting
const sdk = await initTracing({
  serviceName: 'my-node-app',
});
console.log('OpenTelemetry SDK initialized');

// 获取追踪器
const tracer = trace.getTracer('simple-nested-tracer');

// 洋葱式 3 层嵌套追踪函数
// 层级：
// 1. 外层：main-operation
// 2. 中层：process
// 3. 内层：validate + compute
const generateOnionTrace = async () => {
  // 第 1 层：最外层
  await tracer.startActiveSpan('main-operation', async (rootSpan) => {
    rootSpan.setAttribute('layer', '1-outer-onion');

    // 第 2 层：中间层
    await tracer.startActiveSpan('data-process', async (processSpan) => {
      processSpan.setAttribute('layer', '2-middle-onion');

      // 第 3 层：内层 1
      await tracer.startActiveSpan('data-validate', async (validateSpan) => {
        validateSpan.setAttribute('layer', '3-inner-onion');
        await sleep(10);
        validateSpan.end();
      });

      // 第 3 层：内层 2
      await tracer.startActiveSpan('data-compute', async (computeSpan) => {
        computeSpan.setAttribute('layer', '3-inner-onion');
        await sleep(20);
        computeSpan.end();
      });

      await sleep(30);
      processSpan.end();
    });

    await sleep(40);
    rootSpan.end();
    console.log('✅ 3 层洋葱追踪已生成并发送！');
  });
};

// 直接执行
await generateOnionTrace();

// Wait for traces to be sent before exiting
await sleep(1000);

// Shutdown SDK to flush remaining traces
await sdk.shutdown().catch(e => {
  console.debug('\x1B[97;101;1m --- shutdown error --- \x1B[m', '\n', e);
});
console.log('Done');
