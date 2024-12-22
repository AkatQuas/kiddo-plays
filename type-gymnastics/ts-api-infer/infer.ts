import * as ts from 'typescript';

// Create a TypeScript program
const program = ts.createProgram(['./sample/card.ts'], {});

// Get the source file
const sourceFile = program.getSourceFile('./sample/card.ts');

// Find the Card function call expression
let cardCallExpression: ts.CallExpression | undefined;
ts.forEachChild(sourceFile, (node) => {
  if (
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression)
  ) {
    node;
    if (node.expression.expression.text === 'Card') {
      cardCallExpression = node.expression;
    }
  }
});

// Extract the type of the 'data' argument
let dataType: ts.TypeNode | undefined;
if (cardCallExpression) {
  const dataArgument = cardCallExpression.arguments[0];
  if (dataArgument && ts.isObjectLiteralExpression(dataArgument)) {
    dataType = dataArgument;
    console.log(
      ts
        .createPrinter()
        .printNode(ts.EmitHint.Unspecified, dataType, sourceFile)
    );
    // Infer the type of the target node
    if (dataType) {
      const checker = program.getTypeChecker();
      const targetType = checker.getTypeAtLocation(dataType.properties[0]);
      const typeAsString = checker.typeToString(targetType);
      console.log('Inferred type of the target node:', typeAsString);
    }
  }
}
