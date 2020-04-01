# Operators

Cant't find any document on this issue in `v6.x`, but do find the `v5.x` [here](http://reactivex.io/rxjs/manual/overview.html#operators).

Some operators are moved to be the static operators, [here is the list](https://rxjs-dev.firebaseapp.com/api/deprecations).

[codes](./operators.js)

The following content is written for `v5.x`, maybe some of them is consistent with `v6.x`.

---

Operators are **methods** on the Observable type, such as `.map(...)`, `.filter(...)`, `.merge(...)`, etc. When called, they do not change the *existing Observable* instance. Instead, they *return a new Observable*, whose subscription logic is based on the first Observable.

> An Operator is a function which creates a new Observable based on the current Observable. This is a pure operation: the previous Observable stays unmodified.

An Operator is essentially a pure function which takes one Observable as input and generates another Observable as output. Subscribing to the output Observable will also subscribe to the input Observable.

# Instance operators versus static operators

Typically when referring to operators, we assume *instance* operators, which are methods on Observable instances. For instance, if an operator would be an official instance operator, it would be a function in the prototype of the Observable.

```typescript
Rx.Observable.prototype['instance-operator'] = function () {
    //...
    // this refers to the Observable instance
}
```

> Instance operators are functions that use the `this` keyword to infer what is the input Observable.

However, besides instance operators, static operators are functions attached to the Observable class directly. A static operator uses no `this` keyword internally, but instead relies entirely on its arguments.

> Static operators are pure functions attached to the Observable class, and usually are used to create Observables from scratch.

The most common type of static operators are the so-called **Creation Operators**. Instead of transforming an input Observable to an output Observable, they simply take a **non-Observable** argument, like a number, and **create a new Observable**.

There are operators for different purposes, and they may be categorized as:

- creation
- transformation
- filtering
- combination
- multicasting
- error handling
- utility

, etc. In the following list you will find all the operators organized in categories.

[The complete list](http://reactivex.io/rxjs/manual/overview.html#categrories-of-operators).

Many operators are related to time, they may for instance delay, sample, throttle, or debounce value emissions in different ways. 

![](../docs/marble-diagram-anatomy.svg)

## Choose an operator

This is fun at [website](http://reactivex.io/rxjs/manual/overview.html#choose-an-operator) to choose the operator you need!

After the quiz, you may need to go to the `v6.x` [API list](https://rxjs-dev.firebaseapp.com/api) to find the usage.

Have fun with RxJS!
