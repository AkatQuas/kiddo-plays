/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate, getDocUri } from './helper';

suite('Should do completion', () => {
  const docUri = getDocUri('a.html');

  test('Completes HTML class selectors', async () => {
    await testCompletion(docUri, new vscode.Position(7, 16), {
      items: [
        {
          label: '.head',
          insertText: 'head',
          kind: vscode.CompletionItemKind.Color,
        },
        {
          label: '.button',
          insertText: 'button',
          kind: vscode.CompletionItemKind.Color,
        },
        {
          label: '.navigation',
          insertText: 'navigation',
          kind: vscode.CompletionItemKind.Color,
        },
      ],
    });
  });

  test('Completion HTML id selectors', async () => {
    await testCompletion(docUri, new vscode.Position(8, 16), {
      items: [],
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedList: vscode.CompletionList
) {
  await activate(docUri);

  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;

  assert.ok(actualList.items.length >= expectedList.items.length);
  expectedList.items.forEach((expectedItem, i) => {
    const actualItem = actualList.items.find(
      (a) => a.label === expectedItem.label && expectedItem.kind
    );
    assert.ok(actualItem);
  });
}
