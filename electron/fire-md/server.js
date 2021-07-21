const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const uuid = require('uuid/v4');
const writeFile = require('write-file');
const path = require('path');
const http = require('http');

function main() {
  const port = process.env.PROT || 8080;
  const crashesPath = path.join(__dirname, 'crashes');
  const exceptionsPath = path.join(__dirname, 'uncaughtexceptions');

  const app = express();
  const server = http.createServer(app);

  app.use(bodyParser.urlencoded({ extended: false }));

  const upload = multer({
    dest: crashesPath,
  }).single('upload_file_minidump');

  app.get('/', (request, response) => {
    response.send('Hello 42, this is server.');
  });
  app.post('/crashreports', upload, (request, response) => {
    const body = {
      ...request.body,
      filename: request.file.filename,
      date: new Date(),
    };
    const filePath = `${request.file.path}.json`;
    const report = JSON.stringify(body);
    writeFile(filePath, report, (error) => {
      if (error) {
        console.error('Error saving', report);
      }
      console.log(`Crash saved at "${filePath}"`, report);
    });
    response.end();
  });

  app.post('/uncaughtexceptions', (request, response) => {
    const filePath = path.join(exceptionsPath, `${uuid()}.json`);
    const report = JSON.stringify({
      ...request.body,
      date: new Date(),
    });
    writeFile(filePath, report, (error) => {
      if (error) {
        console.error('Error Saving ', report);
        return;
      }
      console.log('Exception Saved', filePath, report);
    });
    response.end();
  });

  server.listen(port, () => {
    console.log(`Crash report server running at Port ${port}`);
  });
}

main();
