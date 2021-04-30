const { declare } = require('@babel/helper-plugin-utils');
const { isIdentifier, stringLiteral } = require('@babel/types');
const normalizeOptions = require('./normalize-options');

const logger = (...msg) => {
  console.log(`[useless-plugin] `, ...msg);
};

module.exports = declare((api, options) => {
  const { sourceIdentifier, targetIdentifier } = normalizeOptions(options);
  return {
    name: 'replace-plugin',
    visitor: {
      Identifier: {
        enter(path) {
          logger('entering node', path.node.name);
          if (isIdentifier(path.node, { name: sourceIdentifier })) {
            path.node.name = targetIdentifier;
          }
        },
        exit(path, state) {
          logger('exit node', path.node.name);
        },
      },
      FunctionDeclaration(path) {
        logger('encounter the function', path.node.name);
      },
      ObjectProperty(path) {
        const { key } = path.node;
        if (isIdentifier(key, { name: 'abc' })) {
          path.node.value = stringLiteral('abc');
        }
      },
    },
  };
});
