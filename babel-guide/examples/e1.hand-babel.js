const generate = require('@babel/generator');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');

const code = `
'use strict';

const number = 1;
`;

function main() {
  // parse the code -> ast
  const ast = parser.parse(code);

  traverse.default(ast, {
    enter(path, node) {
      console.log(`entering to path->`, path, Reflect.ownKeys(path));
      console.log(`entering to node->`, node);
      // modify the path directly
    },
    exit(path, node) {
      console.log(`exiting to path->`, path, Reflect.ownKeys(path));
      console.log(`exiting to node->`, node);
    },
  });

  const output = generate.default(ast, code);
  console.log(`generated code:\n`, output.code);
}

if (require.main === module) {
  main();
}
