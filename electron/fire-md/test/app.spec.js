const assert = require('assert');
const path = require('path');
const electronPath = require('electron');
const { Application } = require('spectron');

const app = new Application({
  path: electronPath,
  env: {
    NODE_ENV: 'production',
  },
  args: [path.join(__dirname, '..')],
  webdriverOptions: {
    deprecationWarnings: false,
  },
});

app
  .start()
  .then(() => {
    return app.client.waitUntil(() => {
      console.log(`running wait promise`);
      return app.webContents
        ? app.webContents.isLoading()
        : Promise.resolve(false);
    });
  })
  .then(async () => {
    const visible = app.browserWindow.isVisible();
    assert.strictEqual(visible, true);
  })
  .then(async () => {
    const title = await app.client.getTitle();
    assert.strictEqual(title, 'Fire MD');
  })
  .catch((error) => {
    console.error('Test failed: ', error.message);
    console.error(error);
  });
