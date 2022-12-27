import { BroadcastChannel, isMainThread, Worker } from 'node:worker_threads';

const target = process.argv[2];
const bc = new BroadcastChannel('job');
/**  @type {Worker[]} */
const workers = [];

if (isMainThread) {
  bc.onmessage = (event) => {
    console.debug('\x1B[97;42;1m --- found --- \x1B[m', '\n', event.data);
    bc.close();
    workers.forEach((w) => w.terminate());
  };
  const total = 4;
  for (let index = 0; index < total; index++) {
    workers.push(
      new Worker('./lib/worker.mjs', {
        workerData: {
          match: target,
          START: 100000,
          MAX: 100000000,
          total,
          index,
        },
      })
    );
  }
}
