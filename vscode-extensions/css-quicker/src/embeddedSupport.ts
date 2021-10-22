import * as css from 'css';
import { TextDocument, workspace } from 'vscode';
import { LanguageService, TokenType } from 'vscode-html-languageservice';

export function isInsideAttribute(
  languageService: LanguageService,
  document: TextDocument,
  offset: number,
  targetAttributes: string[]
):
  | { result: false; attributeName: null }
  | { result: true; attributeName: string } {
  const scanner = languageService.createScanner(document.getText());
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
        if (targetAttributes.includes(lastAttributeName)) {
          if (
            offset > scanner.getTokenOffset() &&
            offset < scanner.getTokenEnd()
          ) {
            let start = scanner.getTokenOffset();
            let end = scanner.getTokenEnd();
            const firstChar = document.getText()[start];
            const lastChar = document.getText()[end];
            console.log(
              `${firstChar}, ${lastChar}, ${scanner.getTokenText()}, ${JSON.stringify(
                document.positionAt(start)
              )}, ${JSON.stringify(document.positionAt(end))}`
            );
            return {
              result: true,
              attributeName: lastAttributeName,
            };
          }
        }
        break;
      default:
        break;
    }
    token = scanner.scan();
  }

  return {
    result: false,
    attributeName: null,
  };
}

export async function getSiblingStyle(
  document: TextDocument
): Promise<{ document: TextDocument; ast: css.Stylesheet }> {
  const uri = siblingStyleDocument(document);
  const cssDocument = await workspace.openTextDocument(uri);
  return {
    document: cssDocument,
    ast: css.parse(cssDocument.getText(), { silent: true }),
  };
}

export function siblingStyleDocument(document: TextDocument) {
  return document.uri.with({
    path: document.uri.path.slice(0, -4) + 'css',
  });
}
