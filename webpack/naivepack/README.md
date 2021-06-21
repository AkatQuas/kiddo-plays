# NaivePack

Thanks to the article: [90 行代码的webpack，你确定不学吗？](https://juejin.cn/post/6963820624623960101).

This is a small packing script to convert _commonjs_ to IIFE javascript which runs in web.

> This packing script only handle commonjs javascript files.


## Examples

```javascript
// src/index.js
const a = require('./a');
const c = require('./c');

console.log('we have -> ', a, c);

// src/a.js
const b = require('./b');

console.log('in a, b is -> ', b);

module.exports = 'a';

// src/b.js
module.exports = 42;

// src/c.js
const b = require('./b');
console.log('in c, b is -> ', b);
module.exports = 'c';
```

After running `node naivepack.js`, we have these output:

```javascript
;(() => {
    var modules = {
      "./src/index.js": function (module, exports, _require_) {
        eval(`const a = _require_("./src/a.js");

const c = _require_("./src/c.js");

console.log('we have -> ', a, c);`)
      }
      ,
"./src/a.js": function (module, exports, _require_) {
        eval(`const b = _require_("./src/b.js");

console.log('in a, b is -> ', b);
module.exports = 'a';`)
      }
      ,
"./src/c.js": function (module, exports, _require_) {
        eval(`const b = _require_("./src/b.js");

console.log('in c, b is -> ', b);
module.exports = 'c';`)
      }
      ,
"./src/b.js": function (module, exports, _require_) {
        eval(`module.exports = 42;`)
      }

    };
    var modules_cache = {};
    var _require_ = function (moduleId) {
      if (modules_cache[moduleId]) {
        return modules_cache[moduleId].exports;
      }
      var module = modules_cache[moduleId] = {
        exports: {}
      };
      modules[moduleId](module, module.exports, _require_);
      return module.exports;
    }
    _require_('./src/index.js');
  })();
```
