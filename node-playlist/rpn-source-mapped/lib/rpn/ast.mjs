import { SourceNode } from 'source-map';

function push(val) {
  return ['__rpn.push(', val, ');\n'];
}

export class ASTNode {
  constructor(/** @type {number} */ line, /** @type {number} */ column) {
    this._line = line;
    this._column = column;
  }

  _sn(originalFilename, chunk) {
    return new SourceNode(this._line, this._column, originalFilename, chunk);
  }

  compile(_data) {
    throw new Error('Not Yet Implemented');
  }
  compileReference(data) {
    return this.compile(data);
  }
}

export class Number extends ASTNode {
  constructor(
    /** @type {number} */ line,
    /** @type {number} */ column,
    /** @type {string} */ numberText
  ) {
    super(line, column);
    this._value = new globalThis.Number(numberText);
  }
  compile(data) {
    return this._sn(data.originalFilename, push(this._value.toString()));
  }
}

export class Variable extends ASTNode {
  constructor(
    /** @type {number} */ line,
    /** @type {number} */ column,
    /** @type {string} */ variableText
  ) {
    super(line, column);
    this._name = variableText;
  }
  compile(data) {
    return this._sn(data.originalFilename, push(['globalThis.', this._name]));
  }
  compileReference(data) {
    return this._sn(data.originalFilename, push(["'", this._name, "'"]));
  }
}

export class Expression extends ASTNode {
  constructor(
    /** @type {number} */ line,
    /** @type {number} */ column,
    /** @type {any} */ operand1,
    /** @type {any} */ operand2,
    /** @type {Operator} */ operator
  ) {
    super(line, column);
    this._left = operand1;
    this._right = operand2;
    this._operator = operator;
  }
  compile(data) {
    const temp = '__rpn.temp';
    const output = this._sn(data.originalFilename, '');
    switch (this._operator.symbol) {
      case 'print':
        return output
          .add(this._left.compile(data))
          .add(this._right.compile(data))
          .add([temp, ' = __rpn.pop();\n'])
          .add([
            'if (',
            temp,
            " <= 0) {\n\tthrow new Error('arguments must be greater than 0');\n}\n",
          ])
          .add([
            'if (Math.floor(',
            temp,
            ') !=',
            temp,
            ") {\n\tthrow new Error('argument must be an integer');\n}\n",
          ])
          .add([this._operator.compile(data), '(__rpn.pop(), ', temp, ');\n']);
      case '=':
        return output
          .add(this._right.compile(data))
          .add(this._left.compileReference(data))
          .add([
            'globalThis[__rpn.pop()] ',
            this._operator.compile(data),
            '__rpn.pop();\n',
          ]);

      case '/':
        return output
          .add(this._left.compile(data))
          .add(this._right.compile(data))
          .add([temp, ' = __rpn.pop();\n'])
          .add([
            'if (',
            temp,
            " === 0) {\n\tthrow new Error('divide by zero error');\n}\n",
          ])
          .add(push(['__rpn.pop() ', this._operator.compile(data), ' ', temp]));

      default:
        return output
          .add(this._left.compile(data))
          .add(this._right.compile(data))
          .add([temp, ' = __rpn.pop();\n'])
          .add(push(['__rpn.pop() ', this._operator.compile(data), ' ', temp]));
    }
  }
}
export class Operator extends ASTNode {
  constructor(
    /** @type {number} */ line,
    /** @type {number} */ column,
    /** @type {string} */ operatorText
  ) {
    super(line, column);
    this.symbol = operatorText;
  }
  compile(data) {
    if (this.symbol === 'print') {
      return this._sn(data.originalFilename, '__rpn.print');
    }
    return this._sn(data.originalFilename, this.symbol);
  }
}
