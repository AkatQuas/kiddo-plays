import { ExtraServiceScript, LanguagePlugin, VirtualCode, forEachEmbeddedCode } from '@volar/language-core';
import type * as ts from 'typescript';
import * as html from 'vscode-html-languageservice';

// A LanguagePlugin to provide VirtualCode and its context
export const HTMLFunnyLanguagePlugin: LanguagePlugin<HTMLFunnyCode> = {
  getLanguageId(uri) {
    if (uri.endsWith('.html_funny')) {
      return 'html_funny'
    }
  },
  createVirtualCode(_scriptId, languageId, snapshot) {
    if (languageId === 'html_funny') {
      return createHTMLFunnyCode(snapshot);
    }
  },
  updateVirtualCode(_scriptId, _oldVirtualCode, newSnapshot) {
    return  createHTMLFunnyCode(newSnapshot)
  },
  typescript: {
    extraFileExtensions: [],
    getServiceScript: (_rootVirtualCode) => undefined,
    getExtraServiceScripts: (fileName, rootVirtualCode) => {
      const scripts: ExtraServiceScript[] = [];
      for (const code of forEachEmbeddedCode(rootVirtualCode)) {
        if (code.languageId === 'javascript') {
          scripts.push({
            fileName: fileName + '.' + code.id + '.js',
            code,
            extension: '.js',
            scriptKind: 1 satisfies ts.ScriptKind.JS
          });
        }
        else if (code.languageId === 'typescript') {
          scripts.push({
            fileName: fileName + '.' + code.id + '.ts',
            code,
            extension: '.ts',
            scriptKind: 3 satisfies ts.ScriptKind.TS
          })
        }

      }
      return scripts;
    },
  }
};

export interface HTMLFunnyCode extends VirtualCode {
  // Reuse for custom service plugin
  htmlDocument: html.HTMLDocument;
}

const htmlLS = html.getLanguageService();

// Root VirtualCode
function createHTMLFunnyCode(snapshot:ts.IScriptSnapshot): HTMLFunnyCode {
  const document = html.TextDocument.create('', 'html', 0, snapshot.getText(0, snapshot.getLength()));
  const htmlDocument = htmlLS.parseHTMLDocument(document)

  return {
    id: 'root',
    languageId: 'html',
    snapshot,
    mappings: [{
      sourceOffsets: [0],
      generatedOffsets: [0],
      lengths: [snapshot.getLength()],
      data: {
        completion: true,
        format: true,
        navigation: true,
        semantic: true,
        structure: true,
        verification: true,
      }
    }],
    // embeddedCodes in Root VirtualCode
    embeddedCodes: Array.from(createEmbeddedCodes(snapshot, htmlDocument)),
    htmlDocument,
  }
}

function* createEmbeddedCodes(snapshot: ts.IScriptSnapshot, htmlDocument:html.HTMLDocument): Generator<VirtualCode> {
  let styles = 0;
  let scripts = 0;
  for( const root of htmlDocument.roots) {
    if (root.tag === 'style' && root.startTagEnd !== undefined && root.endTagStart !== undefined) {
      const styleText = snapshot.getText(root.startTagEnd, root.endTagStart);
      yield {
        id: 'style_' + styles++,
        languageId: 'css',
        snapshot: {
          getText: (start, end) => styleText.substring(start, end),
          getLength: () => styleText.length,
          getChangeRange: ( ) => undefined,
        },
        mappings: [{
            sourceOffsets: [root.startTagEnd],
            generatedOffsets: [0],
            lengths: [styleText.length],
            data: {
              completion: true,
              format: true,
              navigation: true,
              semantic: true,
              structure: true,
              verification: true,
            }
          }],
        // each embeddedCode might not embed other codes
        embeddedCodes: []
      }

    }
      if (root.tag === 'script' && root.startTagEnd !== undefined && root.endTagStart !== undefined) {
        const text = snapshot.getText(root.startTagEnd, root.endTagStart);
        const lang = root.attributes?.lang;
        const isTS = lang === 'ts' || lang == '"ts"' || lang === "'ts'"
        yield {
          id: 'script_' + scripts++,
          languageId: isTS ? 'typescript': 'javascript',
          snapshot: {
            getText: (start, end) => text.substring(start, end),
            getLength: () => text.length,
            getChangeRange: () => undefined
          },
          mappings: [{
            sourceOffsets: [root.startTagEnd],
            generatedOffsets: [0],
            lengths: [text.length],
            data: {
              completion: true,
              format: true,
              navigation: true,
              semantic: true,
              structure: true,
              verification: true,
            }
          }],
          embeddedCodes: [],
        }
      }
  }
}
