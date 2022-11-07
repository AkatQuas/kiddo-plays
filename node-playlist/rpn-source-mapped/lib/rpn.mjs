import jison from 'jison';
import sourceMap from 'source-map';
import * as ast from './rpn/ast.mjs';
import { bnf } from './rpn/bnf.mjs';
import { lex } from './rpn/lex.mjs';

const parser = new jison.Parser({
  lex,
  bnf,
});

parser.yy = ast;

function getPreamble() {
  return new sourceMap.SourceNode(null, null, null, '')
    .add('const __rpn = { _stack: [], temp: 0 };\n')
    .add('__rpn.push = function (val) {\n')
    .add('  __rpn._stack.push(val);\n')
    .add('};\n')
    .add('__rpn.pop = function () {\n')
    .add('  if (__rpn._stack.length > 0) {\n')
    .add('   return __rpn._stack.pop();\n')
    .add('  } else {\n')
    .add("    throw new Error('can not pop from empty stack');\n")
    .add('  }\n')
    .add('};\n')
    .add('__rpn.print = function (val, repeat) {\n')
    .add('  while (repeat-- > 0) {\n')
    .add(
      "    console.log('\\x1B[97;42;1m --- printed --- \\x1B[m', '\\n', val);\n"
    )
    .add('  }\n')
    .add('};\n');
}

export const compile = (input, data) => {
  const expression = parser.parse(input.toString());
  const preamble = getPreamble();

  const result = new sourceMap.SourceNode(null, null, null, preamble);
  const program = [];
  for (const exp of expression) {
    const compiled = exp.compile(data);
    program.push(compiled);
  }

  result.add(program);

  return result;
};
