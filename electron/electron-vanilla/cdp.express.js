const CDP = require('chrome-remote-interface');

function wait2dead() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1e8);
  });
}
const connect2Node = async () => {
  CDP(
    {
      target: 'ws://127.0.0.1:9229/a5c8eb05-6aef-424d-a7a4-6be728093ea4',
    },
    async (client) => {
      const { Debugger, Console, Runtime } = client;
      try {
        client.on('Runtime.consoleAPICalled', (p) => {
          console.log(p.args);
        });
        await Runtime.runIfWaitingForDebugger();
        await Runtime.enable();
        await Debugger.enable({
          maxScriptsCacheSize: 10000000,
        });
        await Console.enable();
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
