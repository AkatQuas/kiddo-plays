import { readFileSync } from 'fs-extra';
import * as ts from 'typescript';

/**
 * Prints out particular nodes from a source file
 *
 * @param file a path to a file
 * @param identifiers top level identifiers available `Component` or `Page`
 */
function extract(file: string, identifiers: 'Component' | 'Page'): void {
  // Create a Program to represent the project, then pull out the
  // source file to parse its AST.
  console.time('create program');
  const program = ts.createProgram([file], {
    allowJs: true,
    declaration: false,
    sourceMap: false,
    noEmit: true,
  });
  console.timeEnd('create program');

  console.time('sourceFile');
  // const sourceFile = program.getSourceFile(file);
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file).toString(),
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true
  );
  console.timeEnd('sourceFile');

  if (!sourceFile) {
    return;
  }

  function traverse(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      callExpressionName(node) === identifiers &&
      firstArgIsObject(node)
    ) {
      const arg0 = node.arguments[0] as ts.ObjectLiteralExpression;
      // console.log(
      //   `%c***** call expression *****`,
      //   'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      //   '\n',
      //   arg0.properties,
      //   '\n'
      // );
      const methodCollector: any[] = [];
      const dataCollector: any[] = [];
      arg0.properties.forEach((prop) => {
        methodLikeProperty(prop, methodCollector);
        dataLikeProperty(prop, dataCollector);
      });
      console.log(
        `%c***** method *****`,
        'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
        '\n',
        methodCollector,
        '\n'
      );

      console.log(
        `%c***** data *****`,
        'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
        '\n',
        dataCollector,
        '\n'
      );
    }

    ts.forEachChild(node, traverse);
  }

  console.time('traverse');

  ts.forEachChild(sourceFile, traverse);
  console.timeEnd('traverse');

  // Either print the found nodes, or offer a list of what identifiers were found
}

// Run the extract function with the script's arguments
extract(process.argv[2], 'Component');
extract(process.argv[2], 'Page');

/**
 * @param node candidate node
 * @returns the identifier name for call expression
 */
function callExpressionName(node: ts.CallExpression): string | undefined {
  try {
    const expression = node.expression as ts.Identifier;
    return expression.text;
  } catch (error) {
    return undefined;
  }
}

/**
 * check out the arguments of the call expression node
 * @param node
 * @returns
 */
function firstArgIsObject(node: ts.CallExpression) {
  const arg0 = node.arguments[0];
  return arg0.kind === ts.SyntaxKind.ObjectLiteralExpression;
}

function filterProperty(node: ts.ObjectLiteralExpression) {
  const properties = node.properties;
  return properties.filter((property) => true);
}

/**
 * method or function like properties
 * @param node property like ts node
 * @returns
 */
function methodLikeProperty(node: ts.Node, collector: any[]): void {
  if (ts.isMethodDeclaration(node)) {
    node.pos;
    node.end;
    const methodName = (node.name as ts.Identifier).text;
    collector.push({
      name: methodName,
    });
    return;
  }

  if (ts.isPropertyAssignment(node)) {
    // arrow function
    if (
      ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer)
    ) {
      node.pos;
      node.end;
      const methodName = (node.name as ts.Identifier).text;
      collector.push({
        name: methodName,
      });
      return;
    }

    // methods property
    if (
      (node.name as ts.Identifier).text === 'methods' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      (node.initializer as ts.ObjectLiteralExpression).properties.forEach(
        (prop) => methodLikeProperty(prop, collector)
      );
    }
  }
}

/**
 *
 * @param node property like ts node
 */
function dataLikeProperty(node: ts.Node, collector: any[]): void {
  if (!ts.isPropertyAssignment(node)) {
    return;
  }

  const propertyName = (node.name as ts.Identifier).text;
  if (propertyName !== 'data' && propertyName !== 'properties') {
    return;
  }

  // not object literal
  if (!ts.isObjectLiteralExpression(node.initializer)) {
    return;
  }

  node.initializer.properties.forEach((prop) => {
    prop.pos;
    prop.end;
    collector.push({
      name: (prop.name as ts.Identifier).text,
    });
  });
}
