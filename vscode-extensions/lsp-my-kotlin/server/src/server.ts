import { CharStreams, CommonTokenStream } from 'antlr4ts';
import * as fs from 'fs';
import * as pathFunctions from 'path';
import {
  computeTokenPosition,
  getSuggestionsForParseTree,
  ImportHeaderContext,
  KotlinFileContext,
  KotlinLexer,
  KotlinParser,
} from 'toy-kotlin-language-server';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  DefinitionParams,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import {
  findDefinition,
  getRange,
  getScope,
  SymbolTableVisitor,
} from './go-to-definition';
import fileUriToPath = require('file-uri-to-path');

type ExtendedTextDocument = {
  parser?: KotlinParser;
  parseTree?: KotlinFileContext;
  symbolTableVisitor?: SymbolTableVisitor;
};
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  connection.console.info('server online');

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
      // Tell the client that this server supports go to definition.
      definitionProvider: true,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const { position, textDocument } = params;
    const doc = documents.get(textDocument.uri);
    connection.console.info(`open doc: ${doc?.uri}`);
    if (!doc) {
      return [];
    }

    const { parser, parseTree, visitor } = ensureParsed(doc);

    const tokenPosition = computeTokenPosition(parseTree, {
      line: position.line + 1,
      column: position.character,
    });

    if (!tokenPosition) {
      return [];
    }

    // we have to add 1 to the line, because VSCode is zero-based while our library is 1-based when it comes to lines of code.
    // Conversely, we subtract 1 from the column because VSCode counts columns from 1 while our library counts from 0.
    const suggestions = getSuggestionsForParseTree(
      parser,
      parseTree,
      visitor,
      { line: position.line + 1, column: position.character - 1 },
      computeTokenPosition
    );
    return suggestions.map((s) => ({
      label: s,
      kind: CompletionItemKind.Keyword,
    }));
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  connection.console.info(item.label);
  item.detail = `${item.label} with nonce string`;
  item.documentation = {
    kind: 'markdown',
    value: 'Some great data.\n[Find more here]http://cn.bing.com',
  };

  return item;
});

connection.onDefinition((params: DefinitionParams) => {
  const {
    position: pos,
    textDocument: { uri },
  } = params;
  const doc = documents.get(uri);
  if (!doc) {
    return undefined;
  }

  const { parser, parseTree, visitor } = ensureParsed(doc);

  const position = computeTokenPosition(parseTree, {
    line: pos.line + 1,
    column: pos.character,
  });
  if (position && position.context) {
    const scope = getScope(position.context, visitor.symbolTable);
    const definition = findDefinition(position.context.text, scope!);
    // @ts-ignore
    if (definition && definition.location) {
      return {
        // @ts-ignore
        ...definition.location,
        originSelectionRange: getRange(position.context),
      };
    }
  }
  return undefined;
});

documents.onDidChangeContent((change) => {
  reParse(change.document);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

/* --- helper --- */

function ensurePath(path: string): string {
  if (path.startsWith('file:')) {
    //Decode for Windows paths like /C%3A/...
    let decoded = decodeURIComponent(fileUriToPath(path));
    if (!decoded.startsWith('\\\\') && decoded.startsWith('\\')) {
      //Windows doesn't seem to like paths like \C:\...
      decoded = decoded.substring(1);
    }
    return decoded;
  }

  if (pathFunctions.isAbsolute(path)) {
    return path;
  }

  return pathFunctions.resolve(path);
}

function computeBaseUri(uri: string) {
  const lastSep = uri.lastIndexOf(pathFunctions.sep);

  if (lastSep >= 0) {
    return uri.substring(0, lastSep + 1);
  } else {
    return '';
  }
}

function processImport(path: string, symbolTableVisitor: SymbolTableVisitor) {
  try {
    const input = CharStreams.fromString(fs.readFileSync(path).toString());
    const lexer = new KotlinLexer(input);
    const parser = new KotlinParser(new CommonTokenStream(lexer));
    const parseTree = parser.kotlinFile();
    symbolTableVisitor.visit(parseTree);
  } catch (e) {
    connection.window.showErrorMessage(
      `Cannot read from imported file ${path}: ${e}`
    );
    console.error(e);
  }
}

function processImports(
  imports: ImportHeaderContext[],
  symbolTableVisitor: SymbolTableVisitor
) {
  const uri = symbolTableVisitor.documentUri;
  const baseUri = computeBaseUri(uri);
  const basePath = ensurePath(baseUri);
  for (let i in imports) {
    const filename = imports[i].identifier().text + '.mykt';
    connection.console.info(`Reading file ${filename}`);
    const filepath = basePath + filename;
    if (fs.existsSync(filepath)) {
      symbolTableVisitor.documentUri = baseUri + filename;
      processImport(filepath, symbolTableVisitor);
    } else {
      connection.window.showErrorMessage(
        `Imported file not found: ${filepath}`
      );
    }
  }
  symbolTableVisitor.documentUri = uri;
}

function markForReParse(document: TextDocument & ExtendedTextDocument) {
  document['parser'] = undefined;
  document['parseTree'] = undefined;
  document['symbolTableVisitor'] = undefined;
}

function ensureParsed(document: TextDocument & ExtendedTextDocument) {
  if (
    document['parser'] &&
    document['parseTree'] &&
    document['symbolTableVisitor']
  ) {
    return {
      parser: document['parser'],
      parseTree: document['parseTree'],
      visitor: document['symbolTableVisitor'],
    };
  }
  const input = CharStreams.fromString(document.getText());
  const lexer = new KotlinLexer(input);
  const parser = new KotlinParser(new CommonTokenStream(lexer));
  const parseTree = parser.kotlinFile();
  const symbolTableVisitor = new SymbolTableVisitor(document.uri);

  const imports = parseTree?.preamble()?.importList()?.importHeader();
  if (imports) {
    processImports(imports, symbolTableVisitor);
  }
  symbolTableVisitor.visit(parseTree);
  document['parser'] = parser;
  document['parseTree'] = parseTree;
  document['symbolTableVisitor'] = symbolTableVisitor;
  return {
    parser,
    parseTree,
    visitor: symbolTableVisitor,
  };
}

function reParse(document: TextDocument) {
  markForReParse(document);
  ensureParsed(document);
}
