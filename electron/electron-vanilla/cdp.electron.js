const CDP = require('chrome-remote-interface');

function wait2dead() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1e8);
  });
}
const connect2Node = async () => {
  CDP(
    {
      target: 'ws://127.0.0.1:9292/5a945021-b6a1-4d2d-9ac8-8e4c7546a91e',
    },
    async (client) => {
      const { Debugger, Console, Runtime } = client;
      try {
        Runtime.consoleAPICalled((params) => {
          console.log(`xedlog rt ->`, params);
        });
        Runtime.executionContextCreated((context) => {
          console.log(`xedlog context ->`, context);
        });
        client.on('Runtime.consoleAPICalled', (p) => {
          console.log('called ->', p);
        });
        await Runtime.runIfWaitingForDebugger();
        await Runtime.enable();
        await Promise.all([Debugger.enable(), Console.enable()]);
        await wait2dead();
      } catch (err) {
        console.error(err);
      } finally {
        client.close();
      }
    }
  ).on('error', (err) => {
    console.error(err);
  });
};

connect2Node();
