const acorn = require('acorn');
const walk = require('acorn-walk');
const fs = require('fs');
const path = require('path');

const pageFile = path.resolve(__dirname, 'demo', 'page.js');
const componentFile = path.resolve(__dirname, 'demo', 'component.js');
console.log('---');
console.log('---');
console.log('---');
console.log('---');

function walkAST(filepath, callee) {
  const content = fs.readFileSync(filepath).toString();
  const AST = acorn.parse(content, {
    ecmaVersion: 'latest',
    locations: true,
    ranges: false,
  });

  const PC_found /* page or component found */ = walk.findNodeAt(
    AST,
    null,
    null,
    (type, node) => type === 'CallExpression' && node.callee.name === callee
  );
  if (!PC_found) {
    return;
  }
  // console.log(PC_found.node.arguments);
  const arg0Node = PC_found.node.arguments[0];
  // console.log(arg0Node);
  /**
   * properties
   */
  const possibleVariableHoldingNode = arg0Node.properties.filter(
    (node) => isObjectProperty(node) && DataOrProperties(node.key)
  );
  // console.log(possibleVariableHoldingNode);
  const resultProperties = possibleVariableHoldingNode.reduce((acc, node) => {
    const { value } = node;
    console.log(value.properties);

    value.properties.forEach((p) => {
      // console.log(p.key);
      acc.push({
        name: p.key.name,
        position: p.loc,
      });
    });
    return acc;
  }, []);
  // console.log(resultProperties);

  /**
   * methods
   */
  const possibleMethods = arg0Node.properties
    .filter((node) => isObjectProperty(node) && MethodsNode(node.key))
    .map((node) => node.value)

    .filter(Boolean);
  possibleMethods.unshift(arg0Node);
  // console.log(possibleMethods);
  const resultMethods = possibleMethods.reduce((acc, node) => {
    // console.log(node.properties);
    node.properties
      .filter((n) => isFunctionProperty(n) && NotBuiltInMethods(n.key))
      .forEach((n) => {
        acc.push({
          name: n.key.name,
          position: n.loc,
        });
      });
    return acc;
  }, []);
  console.log(resultMethods);
  return {
    vars: resultProperties,
    methods: resultMethods,
  };
}
// walkAST(pageFile, 'Page');
walkAST(componentFile, 'Component');

function ast() {
  const content = fs.readFileSync(componentFile).toString();
  return acorn.parse(content, {
    ecmaVersion: 'latest',
    locations: true,
  });
}

module.exports = {
  ast,
};

const out = {
  CallExpression(node) {
    /**
         * callee in an identifier
          Node {
            type: 'Identifier',
            start: 0,
            end: 4,
            loc: SourceLocation {
              start: Position { line: 1, column: 0 },
              end: Position { line: 1, column: 4 }
            },
            range: [ 0, 4 ],
            name: 'Page'
          }
         */
    console.log(`callee name should`, node.expression.callee.name);

    /**
         * arguments is an array, first node should be ObjectExpression
           [
            Node {
              type: 'ObjectExpression',
              start: 5,
              end: 381,
              loc: SourceLocation { start: [Position], end: [Position] },
              range: [ 5, 381 ],
              properties: [ [Node], [Node], [Node], [Node], [Node], [Node] ]
            }
          ]
           */
    console.log(`arguments`, node.expression.arguments);
  },
};

function isFunctionProperty(node) {
  return (
    node.type === 'Property' &&
    (node.method === true || node.value.type === 'FunctionExpression')
  );
}

function NotBuiltInMethods(node) {
  return (
    node.type === 'Identifier' &&
    ['created', 'onLoad', 'onShow', 'onUnload'].includes(node.name) === false
  );
}

function isObjectProperty(node) {
  return (
    node.type === 'Property' &&
    node.method === false &&
    node.value.type === 'ObjectExpression'
  );
}

function DataOrProperties(node) {
  return (
    node.type === 'Identifier' &&
    (node.name === 'data' || node.name === 'properties')
  );
}

function MethodsNode(node) {
  return node.type === 'Identifier' && node.name === 'methods';
}

function SourcePosition2Position(pos) {
  return {};
}

/* --- some unknown code --- */

const isNode = (target) => target && typeof target.type === 'string';

const isNodeArray = (target) =>
  Array.isArray(target) && target[0] && isNode(target[0]);

const isChildNode = (target) => isNodeArray(target) || isNode(target);

const getChildrenKeys = (node) =>
  Object.keys(node).filter((key) => isChildNode(node[key]));

const traverseChildren = (func) => (node, ctx) => {
  if (isNode(node)) {
    for (const key of getChildrenKeys(node)) {
      if (Array.isArray(node[key])) {
        for (let i = 0; i < node[key].length; i++) {
          node[key][i] = node[key][i] && func(node[key][i], ctx);
        }
      } else {
        node[key] = func(node[key], ctx);
      }
    }
  }
  return node;
};

const traverse = (func) => {
  const _traverse = (node, ctx) => func(node, ctx, _traverseChildren);
  const _traverseChildren = traverseChildren(_traverse);
  return _traverse;
};
