'use strict';

import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  createConnection,
  Diagnostic,
  Hover,
  HoverParams,
  IPCMessageReader,
  IPCMessageWriter,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';

const connection: Connection = createConnection(
  new IPCMessageReader(process),
  new IPCMessageWriter(process)
);

connection.listen();

const documents = new TextDocuments(TextDocument);

documents.listen(connection);

let workspaceRoot: string | null;

interface Settings {
  dotLanguageServer: DotSettings;
}

interface DotSettings {
  maxNumberOfProblems: number;
}

let maxNumberOfProblems: number;

let colors: string[];
let shapes: string[];
let names: any[];

connection.onInitialize((params) => {
  workspaceRoot = params.workspaceFolders?.[0].uri ?? null;
  colors = new Array<string>();
  shapes = new Array<string>();

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['='],
      },
      hoverProvider: true,
    },
  };
});

connection.onDidChangeConfiguration((change) => {
  const settings = <Settings>change.settings;
  maxNumberOfProblems = settings.dotLanguageServer.maxNumberOfProblems;
  documents.all().forEach(validateDotDocument);
});

async function validateDotDocument(doc: TextDocument): Promise<void> {
  let diagnostics: Diagnostic[] = [];

  // let the remote server do validation
  const response = await fetch('https://localhost:3050/parse', {
    method: 'POST',
    body: doc.getText(),
  });
  const data = await response.json();
  // headers ??
  const { errors, names } = data as any;

  // do something with the result

  // send back diagnostics
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return [];
  }

  //#region lazy initialize data
  if (colors.length === 0) {
    colors = loadDataContent('colors');
  }
  if (shapes.length === 0) {
    shapes = loadDataContent('shapes');
  }
  //#endregion

  const text = doc.getText();
  const lines = text.split(/\r?\n/g);
  const { line, character } = params.position;

  const targetLine = lines[line];
  let start = 0;
  for (let i = character; i >= 0; i--) {
    if (targetLine[i] === '=') {
      start = i;
      i = 0;
    }
  }
  if (start < 5) {
    return [];
  }
  const token = targetLine.substr(start - 5, 5);

  switch (token) {
    case 'color':
      return colors.map((c, i) => ({
        label: c,
        kind: CompletionItemKind.Color,
        data: `color-${i}`,
      }));

    case 'shapes':
      return shapes.map((s, i) => ({
        label: s,
        kind: CompletionItemKind.Text,
        data: `shape-${i}`,
      }));
    default:
      return [];
  }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data?.startsWith('color-')) {
    (item.detail = 'X11 Color'),
      (item.documentation = 'http://www.graphviz.org/doc/info/colors.html');
  }

  if (item.data?.startsWith('shape-')) {
    (item.detail = 'Shape'),
      (item.documentation = 'http://www.graphviz.org/doc/info/shapes.html');
  }

  return item;
});

connection.onHover(
  ({ textDocument, position }: HoverParams): Hover | undefined => {
    const { line, character } = position;
    const match = names.filter(
      (name) =>
        name.line === line && name.start <= character && name.end >= character
    );
    if (match[0]) {
      return {
        contents: match[0].text,
      };
    }
    return void 0;
  }
);

function loadDataContent(file: string): string[] {
  const content = fs
    .readFileSync(path.join(__dirname, '..', '..', 'data', file))
    .toString();
  return content.split(/\r?\n/g);
}
