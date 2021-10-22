const css = require('css');
const fs = require('fs');
const path = require('path');

const content = fs
  .readFileSync(path.resolve(__dirname, 'src/sample.css'))
  .toString();
const obj = css.parse(content, { silent: true });
console.log(obj.stylesheet.rules);

obj.stylesheet.rules
  .filter((r) => r.type === 'rule')
  .forEach((rule) => {
    const reg = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
    if (!rule.selectors) {
      return;
    }
    const result = rule.selectors.map((selector) => {
      const r = selector.match(reg);
      return r;
    });

    console.log(result);
  });
