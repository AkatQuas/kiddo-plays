import * as fs from 'fs';
import { getCSSLanguageService } from 'vscode-css-languageservice';
import { getLanguageService, TokenType } from 'vscode-html-languageservice';
import { TextDocumentIdentifier, TextDocuments } from 'vscode-languageserver';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
const htmlLanguageService = getLanguageService();
const cssLanguageService = getCSSLanguageService();

export function ensureAttribute(
  document: TextDocument,
  position: Position
): boolean {
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

export async function parseCss(
  docs: TextDocuments<TextDocument>,
  htmlDocument: TextDocumentIdentifier
) {
  // htmlDocument.uri is string in file scheme format
  const cssFile = htmlDocument.uri.slice(0, -4) + 'css';

  let doc = docs.get(cssFile);
  // Maybe the css document is opened,
  // create a backup in case undefined.
  if (!doc) {
    doc = TextDocument.create(cssFile, 'css', 1.0, await getContent(cssFile));
  }

  return cssLanguageService.parseStylesheet(doc);
}

/**
 * Get content from file using node#fs
 * @param location
 * @param encoding
 * @returns
 */
function getContent(
  location: string,
  encoding?: BufferEncoding
): Promise<string> {
  ensureFileUri(location);
  return new Promise<string>((c, e) => {
    const path = URI.parse(location).fsPath;
    fs.readFile(path, encoding, (err, buf) => {
      if (err) {
        return e(err);
      }
      c(buf.toString());
    });
  });
}

/* inner helper */

function ensureFileUri(location: string) {
  if (getScheme(location) !== 'file') {
    throw new Error('fileRequestService can only handle file URLs');
  }
}

export function getScheme(uri: string) {
  return uri.substring(0, uri.indexOf(':'));
}
