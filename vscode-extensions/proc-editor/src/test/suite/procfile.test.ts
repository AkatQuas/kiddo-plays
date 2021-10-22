import * as assert from 'assert';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Procfile } from '../../proc-core/procfile';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Procfile removeLine by index', () => {
    const text = `cmd: echo 1
# comment
cmd2: echo 2`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.removeLine(1).toString(),
      `cmd: echo 1
cmd2: echo 2`
    );
  });

  test('Procfile removeLine by command name', () => {
    const text = `cmd: echo 1
# comment
cmd2: echo 2`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.removeLine('cmd').toString(),
      `# comment
cmd2: echo 2`
    );
  });

  test('Procfile insertLine by index', () => {
    const text = `cmd: echo 1
# comment`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.insertLine(0, 'cmd0: echo 0').toString(),
      `cmd0: echo 0
cmd: echo 1
# comment`
    );
  });

  test('Procfile updateLine by index', () => {
    const text = `cmd: echo 1
# comment
cmd2: echo 2`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.updateLine(0, 'cmd: echo 0').toString(),
      `cmd: echo 0
# comment
cmd2: echo 2`
    );
  });

  test('Procfile updateLine by command name', () => {
    const text = `cmd: echo 1
# comment
cmd2: echo 2`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.updateLine('cmd2', 'cmdX: echo x').toString(),
      `cmd: echo 1
# comment
cmdX: echo x`
    );
  });

  test('Procfile appendText when last line is empty', () => {
    const text = `cmd: echo 1
# comment
`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.appendLine('cmd2: echo 2').toString(),
      `cmd: echo 1
# comment

cmd2: echo 2`
    );
  });

  test('Procfile appendText', () => {
    const text = ``;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.appendLine('cmd: echo 42').toString(),
      `
cmd: echo 42`
    );
  });

  test('Procfile appendText', () => {
    const text = `cmd: echo 1
# comment`;
    const procfile = Procfile.fromString(text);
    assert.strictEqual(
      procfile.appendLine('cmd2: echo 2').toString(),
      `cmd: echo 1
# comment
cmd2: echo 2`
    );
  });
});
