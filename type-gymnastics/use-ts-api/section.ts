import * as ts from 'typescript';

/**
 * Prints out particular nodes from a source file
 *
 * @param file a path to a file
 * @param identifiers top level identifiers available
 */
function extract(file: string, identifiers?: string[]): void {
  // Create a Program to represent the project, then pull out the
  // source file to parse its AST.
  let program = ts.createProgram([file], { allowJs: true });
  const sourceFile = program.getSourceFile(file);

  // const statements = sourceFile!.statements;

  // console.log(statements[statements!.length - 1]);

  // Loop through the root AST nodes of the file
  ts.forEachChild(sourceFile!, (node) => {
    let name = '';

    // This is an incomplete set of AST nodes which could have a top level identifier
    // it's left to you to expand this list, which you can do by using
    // https://ts-ast-viewer.com/ to see the AST of a file then use the same patterns
    // as below
    if (ts.isFunctionDeclaration(node)) {
      name = node!.name!.text;
      console.log('function declaration');
      console.log(node!.name!.text);

      // Hide the method body when printing
      // node!.body = undefined;
    } else if (ts.isVariableStatement(node)) {
      // name = node.declarationList.declarations[0].name.getText(sourceFile);
    } else if (ts.isInterfaceDeclaration(node)) {
      // name = node.name.text;
    } else if (ts.isExpressionStatement(node)) {
      console.log(`node is expressions statement`);

      console.log(node.expression.expression.text);
      // debugger;
    } else if (ts.isCallExpression(node)) {
      console.log('node is call exp');
    }
  });

  // Either print the found nodes, or offer a list of what identifiers were found
}

// Run the extract function with the script's arguments
extract(process.argv[2]);
