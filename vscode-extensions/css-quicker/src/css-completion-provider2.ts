import {
  CancellationToken,
  commands,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionList,
  DocumentSelector,
  ExtensionContext,
  languages,
  Position,
  SymbolInformation,
  TextDocument,
  workspace,
} from 'vscode';
import { LanguageService } from 'vscode-html-languageservice';
import { isInsideAttribute, siblingStyleDocument } from './embeddedSupport';
import { ClassSelectorString, IDSelectorString } from './re';

export class CssCompletionProvider2 implements CompletionItemProvider {
  public static register(
    context: ExtensionContext,
    languageService: LanguageService
  ) {
    const provider = new CssCompletionProvider2(context, languageService);
    const providerRegistration = languages.registerCompletionItemProvider(
      CssCompletionProvider2.documentSelector,
      provider,
      ...CssCompletionProvider2.triggerCharacters
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
  ): Promise<CompletionItem[] | CompletionList<CompletionItem>> {
    if (!workspace.getConfiguration('css-quicker').get('enableCompletion2')) {
      return [];
    }
    const { result: insideResult, attributeName } = isInsideAttribute(
      this.languageService,
      document,
      document.offsetAt(position),
      ['class', 'id']
    );
    if (insideResult === false) {
      return [];
    }
    console.log(`leading attribute: ${attributeName}`);

    let regString: string;
    switch (attributeName) {
      case 'class':
        regString = ClassSelectorString;
        break;
      case 'id':
        regString = IDSelectorString;
        break;
      default:
        return [];
    }

    const symbols = await commands.executeCommand<SymbolInformation[]>(
      'vscode.executeDocumentSymbolProvider',
      siblingStyleDocument(document)
    );
    const raw = symbols?.reduce((acc, symbol) => {
      const regex = new RegExp(regString, 'g');
      const r = symbol.name.match(regex);
      if (r) {
        r.forEach((kls) => acc.add(kls));
      }
      return acc;
    }, new Set<string>());

    return Array.from(raw || []).map((r) => {
      const x = new CompletionItem(r);
      x.insertText = r.substr(1);
      x.kind = CompletionItemKind.Keyword;
      return x;
    });
  }
}
