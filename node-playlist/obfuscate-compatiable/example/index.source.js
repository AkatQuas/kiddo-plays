'use strict';

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function compute(x, y) {
  return multiply(add(x, y), add(x, y));
}

const result = compute(2, 3);
console.log('RESULT:' + result);
console.log('NODE:' + process.version);
