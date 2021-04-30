const babel = require('@babel/core');

function main(code) {
  console.log('before transform:\n', code);
  babel.transform(
    code,
    {
      plugins: [
        function customePlugin() {
          return {
            visitor: {
              Identifier: {
                enter(path) {
                  console.log(`path->`, path.node);
                },
                exit(path, state) {
                  console.log(`state->`, state);
                },
              },
              FunctionDeclaration(path) {
                console.log(`function path->`, path.node);
              },
            },
          };
        },
      ],
    },
    (err, output) => {
      if (err) {
        console.error('Failed to transform: ', err);
        process.exit(1);
      }
      console.log('after transform:\n', output.code);
    }
  );
}

if (require.main === module) {
  const code = `
'use strict';

const number = 1;

/**
 * @param {number} x
 * @param {number} y
 */
const add = (x, y) => x + y;

/**
 * @param {number} s
 * @param {number} t
 */
function subtract(s, t) {
  return s - t;
}
`;

  main(code);
}
