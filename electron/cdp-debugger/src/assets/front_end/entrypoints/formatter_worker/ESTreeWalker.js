const SkipSubTreeObject = {};
export class ESTreeWalker {
  #beforeVisit;
  #afterVisit;
  #walkNulls;
  constructor(beforeVisit, afterVisit) {
    this.#beforeVisit = beforeVisit;
    this.#afterVisit = afterVisit || function() {
    };
    this.#walkNulls = false;
  }
  static get SkipSubtree() {
    return SkipSubTreeObject;
  }
  setWalkNulls(value) {
    this.#walkNulls = value;
  }
  walk(ast) {
    this.#innerWalk(ast, null);
  }
  #innerWalk(node, parent) {
    if (!node && parent && this.#walkNulls) {
      const result = { raw: "null", value: null, parent: null };
      result.type = "Literal";
      node = result;
    }
    if (!node) {
      return;
    }
    node.parent = parent;
    if (this.#beforeVisit.call(null, node) === ESTreeWalker.SkipSubtree) {
      this.#afterVisit.call(null, node);
      return;
    }
    const walkOrder = _walkOrder[node.type];
    if (!walkOrder) {
      console.error("Walk order not defined for " + node.type);
      return;
    }
    if (node.type === "TemplateLiteral") {
      const templateLiteral = node;
      const expressionsLength = templateLiteral.expressions.length;
      for (let i = 0; i < expressionsLength; ++i) {
        this.#innerWalk(templateLiteral.quasis[i], templateLiteral);
        this.#innerWalk(templateLiteral.expressions[i], templateLiteral);
      }
      this.#innerWalk(templateLiteral.quasis[expressionsLength], templateLiteral);
    } else {
      for (let i = 0; i < walkOrder.length; ++i) {
        const entity = node[walkOrder[i]];
        if (Array.isArray(entity)) {
          this.#walkArray(entity, node);
        } else {
          this.#innerWalk(entity, node);
        }
      }
    }
    this.#afterVisit.call(null, node);
  }
  #walkArray(nodeArray, parentNode) {
    for (let i = 0; i < nodeArray.length; ++i) {
      this.#innerWalk(nodeArray[i], parentNode);
    }
  }
}
const _walkOrder = {
  "AwaitExpression": ["argument"],
  "ArrayExpression": ["elements"],
  "ArrayPattern": ["elements"],
  "ArrowFunctionExpression": ["params", "body"],
  "AssignmentExpression": ["left", "right"],
  "AssignmentPattern": ["left", "right"],
  "BinaryExpression": ["left", "right"],
  "BlockStatement": ["body"],
  "BreakStatement": ["label"],
  "CallExpression": ["callee", "arguments"],
  "CatchClause": ["param", "body"],
  "ClassBody": ["body"],
  "ClassDeclaration": ["id", "superClass", "body"],
  "ClassExpression": ["id", "superClass", "body"],
  "ChainExpression": ["expression"],
  "ConditionalExpression": ["test", "consequent", "alternate"],
  "ContinueStatement": ["label"],
  "DebuggerStatement": [],
  "DoWhileStatement": ["body", "test"],
  "EmptyStatement": [],
  "ExpressionStatement": ["expression"],
  "ForInStatement": ["left", "right", "body"],
  "ForOfStatement": ["left", "right", "body"],
  "ForStatement": ["init", "test", "update", "body"],
  "FunctionDeclaration": ["id", "params", "body"],
  "FunctionExpression": ["id", "params", "body"],
  "Identifier": [],
  "ImportDeclaration": ["specifiers", "source"],
  "ImportDefaultSpecifier": ["local"],
  "ImportNamespaceSpecifier": ["local"],
  "ImportSpecifier": ["imported", "local"],
  "ImportExpression": ["source"],
  "ExportAllDeclaration": ["source"],
  "ExportDefaultDeclaration": ["declaration"],
  "ExportNamedDeclaration": ["specifiers", "source", "declaration"],
  "ExportSpecifier": ["exported", "local"],
  "IfStatement": ["test", "consequent", "alternate"],
  "LabeledStatement": ["label", "body"],
  "Literal": [],
  "LogicalExpression": ["left", "right"],
  "MemberExpression": ["object", "property"],
  "MetaProperty": ["meta", "property"],
  "MethodDefinition": ["key", "value"],
  "NewExpression": ["callee", "arguments"],
  "ObjectExpression": ["properties"],
  "ObjectPattern": ["properties"],
  "ParenthesizedExpression": ["expression"],
  "PrivateIdentifier": [],
  "PropertyDefinition": ["key", "value"],
  "Program": ["body"],
  "Property": ["key", "value"],
  "RestElement": ["argument"],
  "ReturnStatement": ["argument"],
  "SequenceExpression": ["expressions"],
  "SpreadElement": ["argument"],
  "Super": [],
  "SwitchCase": ["test", "consequent"],
  "SwitchStatement": ["discriminant", "cases"],
  "TaggedTemplateExpression": ["tag", "quasi"],
  "TemplateElement": [],
  "TemplateLiteral": ["quasis", "expressions"],
  "ThisExpression": [],
  "ThrowStatement": ["argument"],
  "TryStatement": ["block", "handler", "finalizer"],
  "UnaryExpression": ["argument"],
  "UpdateExpression": ["argument"],
  "VariableDeclaration": ["declarations"],
  "VariableDeclarator": ["id", "init"],
  "WhileStatement": ["test", "body"],
  "WithStatement": ["object", "body"],
  "YieldExpression": ["argument"]
};
//# sourceMappingURL=ESTreeWalker.js.map
