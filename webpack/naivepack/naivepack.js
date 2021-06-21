const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

const root = process.cwd();

function modulePathToId(filePath) {
  return './' + path.relative(root, filePath).replace(/\\+/g, '/');
}

/**
 *
 * @param {string} filePath
 */
function readModuleInfo(filePath) {
  // relative path for module key
  const file = modulePathToId(path.resolve(filePath));

  // source code
  const content = fs.readFileSync(file, 'utf-8');
  // parse source for AST
  const ast = parser.parse(content);

  const deps = [];
  // traverse AST, rewrite `require` function
  traverse(ast, {
    CallExpression: ({ node }) => {
      if (node.callee.name !== 'require') {
        return;
      }
      node.callee.name = '_require_';
      let moduleName = node.arguments[0].value;
      const extension = path.extname(moduleName) ? '' : '.js';
      moduleName = modulePathToId(path.join(path.dirname(file), moduleName + extension));
      deps.push(moduleName);
      // use new module name/path
      node.arguments[0].value = moduleName;
    },
  });

  // generate code
  const { code } = babel.transformFromAstSync(ast);
  return {
    moduleId: file,
    deps,
    code,
  };
}

/**
 * traverse the dependency graph
 * @param {string} entry
 * @returns {Array<{moduleId: string; deps: string[]; code: string}>}
 */
function buildDependencyGraph(entry) {
  const entryInfo = readModuleInfo(entry);
  const graphArray = [];

  graphArray.push(entryInfo);
  for (const mod of graphArray) {
    mod.deps
      /* avoid duplicate module analyze */
      .filter((dep) => !graphArray.some((mod) => mod.moduleId === dep))
      .forEach((depPath) => {
        const modInfo = readModuleInfo(path.resolve(depPath));
        graphArray.push(modInfo);
      });
  }
  return graphArray;
}

/**
 *
 * @param {Array<{moduleId: string; deps: string[]; code: string}>} graph
 * @param {string} entry
 * @returns {string}
 */
function pack(graph, entry) {
  const moduleArray = graph.map((mod) => {
    return (
      `"${mod.moduleId}": function (module, exports, _require_) {
        eval(\`${mod.code}\`);
      }
      `
    );
  });
  const output = `;(() => {
    var modules = {
      ${moduleArray.join(',\n')}
    };
    var modules_cache = {};
    var _require_ = function (moduleId) {
      if (modules_cache[moduleId]) {
        return modules_cache[moduleId].exports;
      }
      var module = modules_cache[moduleId] = {
        exports: {}
      };
      // what about asynchronous load scripts
      modules[moduleId](module, module.exports, _require_);
      return module.exports;
    }
    /* bootstrap */
    _require_('${entry}');
  })();`;
  return output;
}

function main(entry = './src/index.js', output = './dist.js') {
  fs.writeFileSync(output, pack(buildDependencyGraph(entry), entry));
  console.log(`Output write to ${output}`);
}

main();
