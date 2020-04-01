# Jasmine Test

> Jasmine is a BDD framework with own assertion library.

Jasmine, as it's been said, is a behavior-driven development framework for testing JavaScript code. It does not depend on any other JavaScript frameworks. It does not require a DOM. And it has a clean, obvious syntax so that you can easily write tests.

## Install and Run Test

```bash
npm install

jasmine

# or
npm run test
```

## Useful documents

[Matcher API list](https://jasmine.github.io/api/3.4/matchers.html).

If you are new to jasmine, please do go through the [offical tutorial](https://jasmine.github.io/tutorials/your_first_suite).

On how asynchronous code works, read [this](https://jasmine.github.io/tutorials/async).

Custome matcher, [official document](https://jasmine.github.io/tutorials/custom_matcher.html), [code example, `toBeGoofy`](spec/helpers/jasmine_examples/SpecHelper.js#L3).

Custom asymmetric equality tester, When you need to check that something meets a certain criteria, without being strictly equal, you can also specify a custom asymmetric equality tester simply by providing an object that has an asymmetricMatch function.

```js
describe("custom asymmetry", function() {
    var tester = {
      asymmetricMatch: function(actual) {
        var secondValue = actual.split(',')[1];
        return secondValue === 'bar';
      }
    };

    it("dives in deep", function() {
      expect("foo,bar,baz,quux").toEqual(tester);
    });

    describe("when used with a spy", function() {
      it("is useful for comparing arguments", function() {
        var callback = jasmine.createSpy('callback');

        callback('foo,bar,baz');

        expect(callback).toHaveBeenCalledWith(tester);
      });
    });
  });
});

// define an asymmetricMatch
function multipleOf(number) {
  return {
    asymmetricMatch: function(compareTo) {
      return compareTo % number === 0;
    },
    jasmineToString: function() {
      return '<multipleOf: '.concat(number, '>');
    }
  }
}

// use in `it`
spyOn(Buffer, 'alloc').and.callThrough();
Buffer.alloc(2048);
expect(Buffer.alloc).toHaveBeenCalledWith(multiple(1024));

spyOn(request, 'post');
request.post({ name: 'Jan Jansen', age: 40 });
expect(request.post).toHaveBeenCalledWith({ name: jasmine.any(String), age: multipleOf(10) });

expect(10).toEqual(multipleOf(5));

expect({ x: 3, y: 9 }).toEqual({ x: multipleOf(3), y: multipleOf(3) });
```

