import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  ExtensionContext,
  languages,
  Position,
  TextDocument,
  workspace,
} from 'vscode';
import {
  getCSSLanguageService,
  LanguageService as CSSLanguageService,
} from 'vscode-css-languageservice';
import {
  getLanguageService,
  LanguageService,
  TokenType,
} from 'vscode-html-languageservice';
import { TextDocument as ServerTextDocument } from 'vscode-languageserver-textdocument';

export function activate(context: ExtensionContext) {
  const htmlLanguageService = getLanguageService();
  const cssLanguageService = getCSSLanguageService();

  const subscription = languages.registerCompletionItemProvider(
    'html',
    {
      async provideCompletionItems(
        document: TextDocument,
        position: Position,
        _token: CancellationToken,
        _context: CompletionContext
      ): Promise<CompletionItem[] | CompletionList<CompletionItem>> {
        // 1. make sure the completion position is in the right attributeValue for `class` attribute
        const attributeResult = ensureAttribute(
          htmlLanguageService,
          document,
          position
        );
        if (!attributeResult) {
          return [];
        }

        // 2. parse sibling css document to stylesheet
        const stylesheet = await parseCss(cssLanguageService, document);

        const raw: Set<string> = new Set();
        // 3. walk the stylesheet, get the node
        (stylesheet as any).accept((node: any) => {
          // https://github.com/microsoft/vscode-css-languageservice/blob/main/src/parser/cssNodes.ts#L29
          if (node.type === 14) {
            // subtract the leading character, `.`
            raw.add(node.getText().substr(1));
          }
          return true;
        });

        // 4. construct the CompletionItem
        return Array.from(raw).map(
          (selector) => new CompletionItem(selector, CompletionItemKind.Color)
        );
      },
    },
    "'" /* triggerCharacter ' single quote*/,
    '"' /* triggerCharacter " double quote */
  );

  context.subscriptions.push(subscription);
}

/* --- helper --- */

/**
 * Ensure the position is at correct attributeValue position
 * for attribute `class`.
 * @param htmlLanguageService
 * @param document
 * @param position
 * @returns
 */
function ensureAttribute(
  htmlLanguageService: LanguageService,
  document: TextDocument,
  position: Position
) {
  const scanner = htmlLanguageService.createScanner(document.getText());
  const offset = document.offsetAt(position);
  let lastAttributeName: string | null = null;
  let token = scanner.scan();
  while (token !== TokenType.EOS) {
    switch (token) {
      case TokenType.AttributeName:
        lastAttributeName = scanner.getTokenText();
        break;
      case TokenType.AttributeValue:
        if (!lastAttributeName) {
          break;
        }
        if (lastAttributeName === 'class') {
          if (
            offset > scanner.getTokenOffset() &&
            offset < scanner.getTokenEnd()
          ) {
            return true;
          }
        }
      default:
        break;
    }
    token = scanner.scan();
  }
  return false;
}

/**
 * Parse the sibling css document for html document, they have the same name under same folder.
 *
 *    some-path/page.html
 *
 *    some-path/page.css
 *
 * @param cssLanguageService
 * @param htmlDocument
 * @returns
 */
async function parseCss(
  cssLanguageService: CSSLanguageService,
  htmlDocument: TextDocument
) {
  /* Create the css document uri */
  const cssUri = htmlDocument.uri.with({
    path: htmlDocument.uri.path.slice(0, -4) + 'css',
  });

  /* Open the css file as TextDocument */
  const cssDocument = await workspace.openTextDocument(cssUri);

  /* Convert to Server-Side TextDocument for parsing */
  const styleDocument = ServerTextDocument.create(
    cssUri.toString(),
    'css',
    cssDocument.version,
    cssDocument.getText()
  );

  return cssLanguageService.parseStylesheet(styleDocument);
}
