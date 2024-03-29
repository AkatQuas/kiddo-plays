const assert = require('assert');
const path = require('path');
const fs = require('fs');
const littleByte = require('../lib/index').default;

async function fileExists(name) {
  try {
    await fs.promises.stat(path.join(__dirname, name));
    return true;
  } catch (e) {
    return false;
  }
}

describe('Compile ByteCode', function () {
  it('should compile without error', async function () {
    await littleByte.walker.start({
      silent: true,
      inputDir: path.join(__dirname, 'app'),
      outputDir: path.join(__dirname, 'dist'),
      onFile(fileInfo, defaultAction) {
        if (fileInfo.relativePath.startsWith('foobar/')) {
          return 'ignore';
        }
        if (fileInfo.isScript) {
          return 'compile';
        } else {
          return 'copy';
        }
      },
    });
  });

  it('should generate bytecode', async function () {
    assert(await fileExists('dist/index.bytecode'));
    assert(await fileExists('dist/sub/index.bytecode'));
  });

  it('should generate bytesouce', async function () {
    assert(await fileExists('dist/index.bytesource'));
    assert(await fileExists('dist/sub/index.bytesource'));
  });

  it('should copy files', async function () {
    assert(await fileExists('dist/sub/textfile.txt'));
  });

  it('should ignore files', async function () {
    assert.strictEqual(await fileExists('dist/foobar/foo.js'), false);
  });
});

describe('Run ByteCode', function () {
  it('app should run without error', function () {
    require('./dist/index');
  });

  let subModule;
  function getSubModule() {
    if (!subModule) {
      const mod = require('./dist/sub/index');
      const sayHello = mod.sayHello.toString();
      const myClass = mod.myClass.toString();
      subModule = {
        mod,
        sayHello,
        myClass,
      };
    }
    return subModule;
  }

  it('function.toString() should includes declaration', function () {
    const { mod, sayHello, myClass } = getSubModule();

    console.debug('\x1B[97;100;1m --- mode --- \x1B[m', '\n', { mod });
    console.debug('\x1B[97;100;1m --- sayHello --- \x1B[m', '\n', {
      sayHello,
    });
    console.debug('\x1B[97;100;1m --- myClass --- \x1B[m', '\n', { myClass });
    assert(sayHello.includes('function sayHello'));
    assert(myClass.includes('class myClass'));
    assert(myClass.includes('constructor'));
    assert(myClass.includes('inc()'));
  });

  it('function.toString() should not include function body', function () {
    const { mod, sayHello, myClass } = getSubModule();

    assert(!myClass.includes('return this.value'));
    assert(!sayHello.includes('console.log'));
  });

  it('read property of undefined in async arrow function should not crash', async function () {
    const { mod, sayHello, myClass } = getSubModule();

    try {
      await mod.asyncArrowException();
    } catch (e) {
      assert(e.toString().includes('TypeError'));
    }
  });

  it('read property of null in async arrow function should not crash', async function () {
    const { mod, sayHello, myClass } = getSubModule();

    try {
      await mod.asyncArrowExceptionWithNull();
    } catch (e) {
      assert(e.toString().includes('TypeError'));
    }
  });

  it('stack trace should contain correct file path', function () {
    const { mod, sayHello, myClass } = getSubModule();
    assert(mod.stackTrace().includes('/sub/index.js:'));
  });

  it('require should pass module info', function () {
    const { mod, sayHello, myClass } = getSubModule();
    const { __dirname, __filename, module } = mod.getModuleInfo();
    assert(typeof __dirname === 'string');
    assert(__filename.endsWith('.bytecode'));
    assert(typeof module === 'object');
    assert(typeof module.exports === 'object');
  });
});
