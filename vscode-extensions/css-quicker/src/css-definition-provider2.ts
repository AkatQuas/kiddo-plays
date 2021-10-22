import {
  CancellationToken,
  commands,
  Definition,
  DefinitionProvider,
  DocumentSelector,
  ExtensionContext,
  languages,
  Location,
  LocationLink,
  Position,
  SymbolInformation,
  TextDocument,
  workspace,
} from 'vscode';
import { LanguageService } from 'vscode-html-languageservice';
import { isInsideAttribute, siblingStyleDocument } from './embeddedSupport';
import { ClassSelector, IDSelector } from './re';

export class CssDefinitionProvider2 implements DefinitionProvider {
  public static register(
    context: ExtensionContext,
    languageService: LanguageService
  ) {
    const provider = new CssDefinitionProvider2(context, languageService);
    const registration = languages.registerDefinitionProvider(
      CssDefinitionProvider2.documentSelector,
      provider
    );
    return registration;
  }

  private static documentSelector: DocumentSelector = ['html'];

  constructor(
    private readonly context: ExtensionContext,
    private readonly languageService: LanguageService
  ) {}
  public async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Definition | LocationLink[]> {
    if (!workspace.getConfiguration('css-quicker').get('enableDefinition2')) {
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
    // still need to check out leading, to make sure in the attribute value
    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      return [];
    }
    const text = document.getText(range);
    console.log(`definition text: ${text}`);

    let reg: RegExp;
    switch (attributeName) {
      case 'class':
        reg = ClassSelector(text);
        break;
      case 'id':
        reg = IDSelector(text);
        break;
      default:
        return [];
    }
    const symbols = await commands.executeCommand<SymbolInformation[]>(
      'vscode.executeDocumentSymbolProvider',
      siblingStyleDocument(document)
    );

    const result: Location[] = [];

    if (Array.isArray(symbols)) {
      for (const symbol of symbols) {
        const regex = new RegExp(reg);
        if (symbol.name.match(regex)) {
          result.push(symbol.location);
        }
      }
    }
    return result;
  }
}
