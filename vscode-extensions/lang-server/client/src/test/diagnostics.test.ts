import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate, getDocUri } from './helper';

suite('Should get diagnostics', () => {
  const docUri = getDocUri('diagnostics.txt');
  test('Diagnoses uppercase texts', async () => {
    await testDiagnostics(docUri, [
      {
        message: 'ANY is all uppercase.',
        range: toRange(0, 0, 0, 3),
        severity: vscode.DiagnosticSeverity.Warning,
        source: 'ex',
      },
      {
        message: 'ANY is all uppercase.',
        range: toRange(0, 14, 0, 17),
        severity: vscode.DiagnosticSeverity.Warning,
        source: 'ex',
      },
      {
        message: 'OS is all uppercase.',
        range: toRange(0, 18, 0, 20),
        severity: vscode.DiagnosticSeverity.Warning,
        source: 'ex',
      },
    ]);
  });
});

function toRange(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
) {
  const start = new vscode.Position(startLine, startCharacter);
  const end = new vscode.Position(endLine, endCharacter);
  return new vscode.Range(start, end);
}

async function testDiagnostics(
  docUri: vscode.Uri,
  expectedDiagnostics: vscode.Diagnostic[]
) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.strictEqual(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}
