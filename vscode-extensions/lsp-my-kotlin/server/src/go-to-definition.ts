import {
  ScopedSymbol,
  Symbol as BaseSymbol,
  SymbolTable,
  VariableSymbol,
} from 'antlr4-c3';
import { ParserRuleContext } from 'antlr4ts';
import { ParseTree, TerminalNode } from 'antlr4ts/tree';
import {
  SymbolTableVisitor as BaseVisitor,
  VariableDeclarationContext,
} from 'toy-kotlin-language-server';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { LocationLink, Range } from 'vscode-languageserver-types';

export class SymbolTableVisitor extends BaseVisitor {
  constructor(
    public documentUri: DocumentUri,
    public symbolTable = new SymbolTable('', {}),
    scope = symbolTable.addNewSymbolOfType(ScopedSymbol, undefined)
  ) {
    super(symbolTable, scope);
  }

  protected registerDefinition(
    symbol: any,
    tree: ParseTree,
    definitionName: ParseTree
  ) {
    symbol.location = LocationLink.create(
      this.documentUri,
      getRange(tree),
      getRange(definitionName)
    );
  }

  visitVariableDeclaration = (ctx: VariableDeclarationContext) => {
    let symbol = this.symbolTable.addNewSymbolOfType(
      VariableSymbol,
      this.scope,
      ctx.simpleIdentifier().text
    );
    this.registerDefinition(symbol, ctx, ctx.simpleIdentifier());
    return this.visitChildren(ctx);
  };
}

/* --- helper --- */

export function getRange(tree: ParseTree): Range {
  let start, end;
  if (tree instanceof ParserRuleContext) {
    start = tree.start;
    end = tree.stop;
  } else if (tree instanceof TerminalNode) {
    start = end = tree.symbol;
  }
  if (!start || !end) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }
  return {
    start: {
      line: start.line - 1,
      character: start.charPositionInLine,
    },
    end: {
      line: end.line - 1,
      character: end.charPositionInLine + (end.text?.length ?? 0),
    },
  };
}

export function findDefinition(
  name: string,
  scope: BaseSymbol
): BaseSymbol | undefined {
  let targetScope: BaseSymbol | undefined = scope;

  while (targetScope && !(targetScope instanceof ScopedSymbol)) {
    targetScope = targetScope.parent;
  }
  if (!targetScope) {
    return undefined;
  }

  const symbol = (scope as ScopedSymbol)
    .getSymbolsOfType(BaseSymbol)
    .find((s) => s.name === name);
  if (symbol && symbol.hasOwnProperty('location')) {
    return symbol;
  }
  return findDefinition(name, scope.parent!);
}

export function getScope(
  context: ParseTree,
  symbolTable: SymbolTable
): BaseSymbol | undefined {
  if (!context) {
    return undefined;
  }
  const scope = symbolTable.symbolWithContext(context);
  return scope ? scope : getScope(context.parent!, symbolTable);
}
