import { get } from 'http';

function applyRoom() {
  return new Promise((resolve, reject) => {
    const req = get(
      'http://localhost:10100/battle-room/apply?version=2',
      (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', (chunk) => {
          resolve(Buffer.concat(chunks).toString());
        });

        res.on('error', (error) => {
          reject(error);
        });
      }
    );

    req.end();
  });
}

applyRoom().then((r) => {
  console.log('result', r);
});
