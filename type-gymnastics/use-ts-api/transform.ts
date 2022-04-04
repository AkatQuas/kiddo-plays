import * as ts from 'typescript';

const source = "const x: string  = 'string'; x = 2; 2foo = 3";

let result = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});

console.log(JSON.stringify(result));
