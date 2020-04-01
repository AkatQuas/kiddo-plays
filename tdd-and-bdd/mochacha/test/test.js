const assert = require('assert');
describe('Array', () => {
  describe('#indexOf()', () => {
    it('should return -1 when the value is not present', () => {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });

    it.skip('should return -1 unless present', function () {
      // pending this test
      assert.equal('user'.length, 4);
    });

    it('should return the index when present', function () {
      assert.equal('user'.length, 4);
    });
  });
});

const expect = require('chai').expect;
const assert2 = require('chai').assert;

describe('Using chaijs assertion', () => {
  let foo, beverages;

  beforeEach(() => {
    foo = 'bar';
    beverages = { tea: ['chai', 'mocha', 'oop'] };
  });

  it('first level it', () => {
    expect(foo).to.be.a('string');
    expect(foo).to.equal('bar');
  });

  describe('nest describe', () => {
    beforeEach(() => {
      foo = 'bazbar';
    });

    it('level 2 it', () => {
      expect(foo).to.equal('bazbar');
    });
  });

  it('test property', () => {
    expect(beverages).to.have.property('tea');
  });
  it('test property value length', () => {
    expect(beverages).to.have.property('tea').with.lengthOf(3);
  });
});

describe('Dynamic tests', () => {
  const addNumberArray = (args) => args.reduce((p, c) => +p + c, 0);
  const tests = [
    { args: [1, 2], expected: 3 },
    { args: [5, 2], expected: 7 },
    { args: [5, 2, 3], expected: 10 },
  ];
  tests.forEach(test => {
    it('correctly adds ' + test.args.length + ' arguments', () => {
      assert2.equal(addNumberArray(test.args), test.expected);
    });
  })
})
