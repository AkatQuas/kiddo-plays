import * as css from 'css';
import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionList,
  DocumentSelector,
  ExtensionContext,
  languages,
  Position,
  TextDocument,
  workspace,
} from 'vscode';
import { LanguageService } from 'vscode-html-languageservice';
import { getSiblingStyle, isInsideAttribute } from './embeddedSupport';
import { ClassSelectorString, IDSelectorString } from './re';

export class CssCompletionProvider implements CompletionItemProvider {
  public static register(
    context: ExtensionContext,
    languageService: LanguageService
  ) {
    const provider = new CssCompletionProvider(context, languageService);
    const providerRegistration = languages.registerCompletionItemProvider(
      CssCompletionProvider.documentSelector,
      provider,
      ...CssCompletionProvider.triggerCharacters
    );
    return providerRegistration;
  }

  private static documentSelector: DocumentSelector = ['html'];
  private static triggerCharacters = ['"', "'"];

  constructor(
    private readonly context: ExtensionContext,
    private readonly languageService: LanguageService
  ) {}

  public async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList<CompletionItem> | null> {
    if (!workspace.getConfiguration('css-quicker').get('enableCompletion')) {
      return null;
    }
    const inside = isInsideAttribute(
      this.languageService,
      document,
      document.offsetAt(position),
      ['class', 'id']
    );
    if (inside.result === false) {
      return null;
    }
    console.log(`leading attribute: ${inside.attributeName}`);

    let regString: string;
    if (inside.attributeName === 'class') {
      regString = ClassSelectorString;
    } else if (inside.attributeName === 'id') {
      regString = IDSelectorString;
    } else {
      return [];
    }
    const { ast } = await getSiblingStyle(document);
    const raw = this.filterSelector(ast, regString);

    //#region example
    // checkout https://github.com/microsoft/vscode-extension-samples/blob/main/lsp-embedded-request-forwarding/client/src/extension.ts#L60
    // const result = await commands.executeCommand<DocumentHighlight[]>(
    //     'vscode.executeDocumentSymbolProvider',
    //     uri,
    // );
    // const result = await commands.executeCommand<CompletionList>(
    //     'vscode.executeCompletionItemProvider',
    //     uri,
    //     new Position(0, 0),
    //     'a',
    // );
    //#endregion

    console.log(
      `%c***** result *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      raw
    );
    return new Array(27)
      .fill(true)
      .map((_, i) => {
        const x = new CompletionItem('item - ' + i);
        x.kind = i;
        return x;
      })
      .concat(
        Array.from(raw).map((r) => {
          const x = new CompletionItem(r);
          x.insertText = r.substr(1);
          x.kind = CompletionItemKind.Color;
          return x;
        })
      );
  }

  private filterSelector(stylesheet: css.Stylesheet, reg: string): Set<string> {
    const raw = new Set<string>();
    stylesheet.stylesheet?.rules
      .filter((r) => r.type === 'rule')
      .forEach((rule: css.Rule) => {
        rule.selectors?.forEach((selector) => {
          const regex = new RegExp(reg, 'g');
          const r = selector.match(regex);
          if (r) {
            r.forEach((kls) => raw.add(kls));
          }
        });
      });

    return raw;
  }
}
