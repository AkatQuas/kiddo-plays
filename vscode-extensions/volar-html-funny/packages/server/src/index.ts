import { create as createCssService } from 'volar-service-css';
import { create as createEmmetService } from 'volar-service-emmet';
import { create as createHtmlService } from 'volar-service-html';
import { create as createTypeScriptServices } from 'volar-service-typescript';

import {
  Diagnostic,
  DiagnosticSeverity,
  VirtualCode,
  createConnection,
  createServer,
  createTypeScriptProjectProvider,
  loadTsdkByPath,
} from '@volar/language-server/node';

import { HTMLFunnyCode, HTMLFunnyLanguagePlugin } from './language-plugin';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(
    params.initializationOptions.typescript.tsdk,
    params.locale
  );
  const plugins = createTypeScriptServices(tsdk.typescript, {}).concat([
    createHtmlService(),
    createCssService(),
    createEmmetService({}),
    {
      create: (context) => {
        return {
          name: 'html-funny-plugin-single-style',
          provideDiagnostics(document) {
            const decoded = context.decodeEmbeddedDocumentUri(document.uri);
            const virtualCode =
              decoded &&
              (context.language.scripts
                .get(decoded[0])
                ?.generated?.embeddedCodes.get(decoded[1]) as
                | VirtualCode
                | HTMLFunnyCode
                | undefined);
            if (!virtualCode || !('htmlDocument' in virtualCode)) {
              return;
            }
            const styleNodes = virtualCode.htmlDocument.roots.filter(
              (root) => root.tag === 'style'
            );
            if (styleNodes.length < 1) {
              return;
            }
            const errors: Diagnostic[] = [];
            for (let i = 1; i < styleNodes.length; i++) {
              const { start, end } = styleNodes[i];
              errors.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                  start: document.positionAt(start),
                  end: document.positionAt(end),
                },
                source: 'html_funny',
                message: 'Remove this <style>. Only one style tay is allowed',
              });
            }
            return errors;
          },
        };
      },
    },
  ]);
  return server.initialize(
    params,
    plugins,
    // project provider, used for creating server project
    // server project contains LanguageService which handle dirty world
    createTypeScriptProjectProvider(
      tsdk.typescript,
      tsdk.diagnosticMessages,
      () => [HTMLFunnyLanguagePlugin]
    )
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
