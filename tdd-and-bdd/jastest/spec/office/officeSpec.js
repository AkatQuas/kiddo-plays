
describe('On Official Document', () => {
  var foo;

  beforeEach(function () {
    foo = 0;
    foo += 1;
    // console.log('outer before each %d', foo);
  });

  afterEach(function () {
    foo = 0;
  });

  it('using "toThrow" function', () => {
    expect(function () { throw 'foo'; return 'things'; }).toThrow('foo');
    expect(function () { return 'stuff'; }).not.toThrow();
  });

  it('using "toThrowError" function', () => {
    const MyCustomError = require('../../lib/my-custom-error');
    expect(function () { return 'things'; }).not.toThrowError();
    expect(function () { throw new Error('foo'); return 'things'; }).toThrowError('foo');

    expect(function () { throw new MyCustomError('foo'); return 'things'; }).toThrowError('foo');
  });

  it('can using "fail" mannually', () => {
    var foo = function (x, callBack) {
      if (x) {
        callBack();
      }
    };
    foo(false, () => {
      // if callback is called, it is a FAILED test.
      fail('Callback should not be called');
    });
  });

  describe("nested inside a second describe", function () {
    var bar;

    beforeEach(function () {
      bar = 1;
      // console.log('inner before each %d ', bar);
    });

    it("can reference both scopes as needed", function () {
      expect(foo).toEqual(bar);
    });

    it('just repeat to see more before each', () => {
      expect(foo).toEqual(bar);
      expect(foo).toBe(bar);
    });
  });

  xit("can be declared 'xit'", function () {
    // Pending specs do not run,
    // but their names will show up
    // in the results as pending.
    expect(true).toBe(false);
  });

  // no function will result in "pending" by default
  it("can be declared with 'it' but without a function");

  // pending manually
  it("can be declared by calling 'pending' in the spec body", function () {
    expect(true).toBe(false);
    pending('this is why it is pending');
  });


  describe('on Spy, aka test double', () => {
    let foo, bar;
    beforeEach(() => {
      foo = {
        setBar: (value) => {
          bar = value;
        }
      }
      spyOn(foo, 'setBar');
      foo.setBar(123);
      foo.setBar(345, 'extra parameters');
    });

    it('tracks that the spy has been called', () => {
      expect(foo.setBar).toHaveBeenCalled();
    });

    it('tracks that the spy has been called 2 times', () => {
      expect(foo.setBar).toHaveBeenCalledTimes(2);
    });

    it("tracks all the arguments of its calls", function () {
      expect(foo.setBar).toHaveBeenCalledWith(123);
      expect(foo.setBar).toHaveBeenCalledWith(345, 'extra parameters');
    });

  });

  describe('create a spy object manually', () => {
    let tap;
    beforeEach(() => {
      tap = jasmine.createSpyObj('tap', ['read', 'eat']);
      // tap.read();
      tap.eat(10);
    });

    it('creates the method we neede', () => {
      expect(tap.read).toBeDefined();
      expect(tap.eat).toBeDefined();
    });

    it('call "eat" ', () => {
      expect(tap.eat).toHaveBeenCalledTimes(1);
      expect(tap.eat).toHaveBeenCalledWith(10);
    });
  });

  describe('jasmine.objectContaining', () => {
    let foo;
    beforeEach(() => {
      foo = {
        a: 1,
        b: 2,
        bar: 'baz',
      }
    });

    it('matches objects with the expect key/value pairs', () => {
      expect(foo.bar).toBeDefined();
      expect(foo).toEqual(jasmine.objectContaining({ b: 2 }));
      expect(foo).not.toEqual(jasmine.objectContaining({ c: 37 }));
    });
    describe('when used with a spy', () => {
      it('is useful for comparing arguments', () => {
        const cb = jasmine.createSpy('callback');
        cb({
          bar: 'baz'
        });
        expect(cb).toHaveBeenCalledWith(jasmine.objectContaining({ bar: 'baz' }));
      });
    });
  });

});