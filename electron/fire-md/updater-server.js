const express = require('express');
const fs = require('fs');
const path = require('path');

function main() {
  const port = process.env.PORT || 8090;
  const app = express();
  app.use(express.static('public'));

  /**
   * might be the data queried from database
   */
  const latestRelease = '1.2.0';

  app.get('/', (request, response) => {
    response.send('Hello 42, this is updater-server.');
  });

  /**
   * server response with an HTTP 204 response,
   *   -> Electron knows it's running the latest version
   *
   * server response an HTTP 200 JSON formatted response with the URL of the new release
   *   -> Electron autoupdater starts to work
   */
  app.get('/releases/:platform', (request, response) => {
    const { currentVersion } = request.query;

    if (currentVersion === latestRelease) {
      response.status(204);
      response.send();
      return;
    }

    const { platform } = request.params;

    const data = {
      version: latestRelease,
      url: '',
    };
    switch (platform) {
      case 'darwin':
        data.url = '';
        break;
      case 'win32':
        data.url = '';
        break;
      case 'linux':
        data.url = '';
        break;
      default:
        break;
    }

    if (data.url) {
      response.json(data);
      return;
    }

    response.status(404).end();
  });

  const listener = app.listen(port, () => {
    console.log(`UpdaterServer running at ${port}`);
  });
}

main();
