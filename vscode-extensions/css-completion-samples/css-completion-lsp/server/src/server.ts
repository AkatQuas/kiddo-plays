/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { ensureAttribute, parseCss } from './helper';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const AllDocuments: TextDocuments<TextDocument> = new TextDocuments(
  TextDocument
);

let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  return result;
});

connection.onInitialized(() => {
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (
    textDocumentPosition: TextDocumentPositionParams
  ): Promise<CompletionItem[]> => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested.
    const { textDocument, position } = textDocumentPosition;

    // Get the target document
    const document = AllDocuments.get(textDocument.uri);

    // No document available, no result.
    if (!document) {
      connection.console.info('No document available');
      return [];
    }

    // Not valid attribute `class`, no result.
    if (!ensureAttribute(document, position)) {
      connection.console.info('The position in document is invalid');
      return [];
    }

    // Parse sibling css document to stylesheet (AST)
    const stylesheet = await parseCss(AllDocuments, document);

    const raw: Set<string> = new Set();

    // Traverse the stylesheet, get the node
    (stylesheet as any).accept((node: any) => {
      // https://github.com/microsoft/vscode-css-languageservice/blob/main/src/parser/cssNodes.ts#L29
      if (node.type === 14) {
        raw.add(node.getText());
      }
      // Return `true` to continue the traverse
      return true;
    });

    // Construct the CompletionItem List
    return Array.from(raw).map((selector) => {
      return <CompletionItem>{
        label: selector,
        kind: CompletionItemKind.Color,
        insertText: selector.substring(1), // subtract the leading character, `.`
      };
    });
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // No necessary to modify the item.
  return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
AllDocuments.listen(connection);

// Listen on the connection
connection.listen();
