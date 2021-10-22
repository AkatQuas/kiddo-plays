import * as vscode from 'vscode';
import { getLanguageService } from 'vscode-html-languageservice';
import { CssCompletionProvider } from './css-completion-provider';
import { CssCompletionProvider2 } from './css-completion-provider2';
import { CssDefinitionProvider } from './css-definition-provider';
import { CssDefinitionProvider2 } from './css-definition-provider2';
import { CssHoverProvider } from './css-hover-provider';

export function activate(context: vscode.ExtensionContext) {
  const htmlLanguageService = getLanguageService();
  context.subscriptions.push(
    CssCompletionProvider.register(context, htmlLanguageService),
    CssCompletionProvider2.register(context, htmlLanguageService),
    CssHoverProvider.register(context, htmlLanguageService),
    CssDefinitionProvider2.register(context, htmlLanguageService),
    CssDefinitionProvider.register(context, htmlLanguageService)
  );
}
