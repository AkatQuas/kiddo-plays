import * as css from 'css';
import {
  CancellationToken,
  Definition,
  DefinitionProvider,
  DocumentSelector,
  ExtensionContext,
  languages,
  Location,
  LocationLink,
  Position,
  Range,
  TextDocument,
  workspace,
} from 'vscode';
import { LanguageService } from 'vscode-html-languageservice';
import { getSiblingStyle, isInsideAttribute } from './embeddedSupport';
import { ClassSelector, IDSelector } from './re';

export class CssDefinitionProvider implements DefinitionProvider {
  public static register(
    context: ExtensionContext,
    languageService: LanguageService
  ) {
    const provider = new CssDefinitionProvider(context, languageService);
    const providerRegistration = languages.registerDefinitionProvider(
      CssDefinitionProvider.documentSelector,
      provider
    );
    return providerRegistration;
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
  ): Promise<Definition | LocationLink[] | null> {
    if (!workspace.getConfiguration('css-quicker').get('enableDefinition')) {
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
    // still need to check out leading, to make sure in the attribute value
    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      return [];
    }
    const text = document.getText(range);

    let reg: RegExp;
    switch (inside.attributeName) {
      case 'class':
        reg = ClassSelector(text);
        break;
      case 'id':
        reg = IDSelector(text);
        break;
      default:
        return [];
    }

    console.log(`definition text: ${text}`);
    const { document: cssDocument, ast } = await getSiblingStyle(document);
    const result: Location[] = [];
    ast.stylesheet?.rules
      .filter((r) => r.type === 'rule')
      .forEach((rule: css.Rule) => {
        // this is bad, you could do better
        if (rule.selectors?.some((selector) => selector.match(reg))) {
          console.log(
            `%c***** position *****`,
            'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
            '\n',
            cssDocument.getText(this.cssPosition2Range(rule.position)),
            rule.position
          );

          result.push(
            new Location(
              cssDocument.uri,
              this.cssPosition2Position(rule.position)
            )
          );
        }
      });

    return result;
  }
  private cssPosition2Position(position: css.Rule['position']): Position {
    return new Position(
      position!.start!.line! - 1,
      position!.start!.column! - 1
    );
  }

  private cssPosition2Range(position: css.Rule['position']): Range {
    return new Range(
      new Position(position!.start!.line! - 1, position!.start!.column! - 1),
      new Position(position!.end!.line! - 1, position!.end!.column! - 1)
    );
  }
}
