import * as css from 'css';
import {
  CancellationToken,
  DocumentSelector,
  ExtensionContext,
  Hover,
  HoverProvider,
  languages,
  MarkdownString,
  Position,
  Range,
  TextDocument,
  workspace
} from 'vscode';
import { LanguageService } from 'vscode-html-languageservice';
import { getSiblingStyle, isInsideAttribute } from './embeddedSupport';

export class CssHoverProvider implements HoverProvider {
  service: typeof css;
  public static register(
    context: ExtensionContext,
    languageService: LanguageService
  ) {
    const provider = new CssHoverProvider(context, languageService);
    const providerRegistration = languages.registerHoverProvider(
      CssHoverProvider.documentSelector,
      provider
    );
    return providerRegistration;
  }

  private static documentSelector: DocumentSelector = ['html'];

  constructor(
    private readonly context: ExtensionContext,
    private readonly languageService: LanguageService
  ) {
    this.service = css;
  }
  public async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Hover | null> {
    if (!workspace.getConfiguration('css-quicker').get('enableHover')) {
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
      return null;
    }
    const text = document.getText(range);

    console.log(`hover text: ${text}`);

    const { document: cssDocument, ast } = await getSiblingStyle(document);
    const rules = ast.stylesheet?.rules.filter(
      (r) => r.type === 'rule'
    ) as css.Rule[];
    for (const rule of rules) {
      if (rule.selectors?.some((selector) => selector.indexOf(text) > -1)) {
        console.log(
          `%c***** position *****`,
          'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
          '\n',
          cssDocument.getText(this.cssPosition2Range(rule.position)),
          rule.position
        );

        return new Hover(
          new MarkdownString('\n**css-hover**\n')
            .appendCodeblock(
              cssDocument.getText(this.cssPosition2Range(rule.position)),
              'css'
            )
            .appendMarkdown('\n**css-hover end**\n'),
          range
        );
      }
    }

    return null;
  }

  private cssPosition2Range(position: css.Rule['position']): Range {
    return new Range(
      new Position(position!.start!.line! - 1, position!.start!.column! - 1),
      new Position(position!.end!.line! - 1, position!.end!.column! - 1)
    );
  }
}
