const expect = require('chai').expect;

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