import * as assert from 'node:assert';

import { add, multiply } from '../src/math';

suite('math', () => {
  suite('add', () => {
    assert.strictEqual(add(1, 2), 3);
  });
  suite('multiply', () => {
    assert.strictEqual(multiply(2, 3), 6);
  });
});
