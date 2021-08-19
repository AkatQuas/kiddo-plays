const CDP = require('chrome-remote-interface');

function wait2dead() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 1e8);
  });
}

async function connect2Browser() {
  let client;
  try {
    const client = await CDP({
      target:
        'ws://localhost:8282/devtools/page/08AFD414EF98C3DCCD883290083CB19F',
    });
    const { Runtime, Page, Debugger } = client;
    client.on('Runtime.consoleAPICalled', (params) => {
      console.log(`xedlog params ->`, params);
    });
    await Promise.all([
      Debugger.enable({
        maxScriptsCacheSize: 10000000,
      }),
      Page.enable(),
      Runtime.enable(),
    ]);
    await wait2dead();
  } catch (err) {
    console.error(err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

connect2Browser();

async function main() {
  await CDP.Activate(
    {
      host: '127.0.0.1',
      port: '8282',
      id: '73cf9af3-a638-4465-a2c4-ff25f662f99d',
    },
    (err) => {
      if (!err) {
        console.log('target is activated');
      }
    }
  );
  client.on('event', (message) => {
    console.log(message);
  });

  const { Runtime, Page } = client;
  Runtime.enable();
  Page.enable();
  debugger;
  const data = await Runtime.evaluate({
    expression: 'document.documentElement.outerHTML',
  });
  console.log(data.result.value);
}

// main();
