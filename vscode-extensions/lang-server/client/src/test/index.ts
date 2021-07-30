import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  mocha.timeout(1e5);

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    glob('**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} test failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}
