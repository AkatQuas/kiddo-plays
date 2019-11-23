# Observable

[original](https://rxjs-dev.firebaseapp.com/guide/observable)

[codes](./observable.js)

An `Observerable` is kind of like a `Generator` with `Promise` style chaining actions.

Observables are **created** using `Observable.create` or a creation operator, are **subscribed** to with an Observer, **execute** to deliver `next / error / complete` notifications to the Observer, and their execution may be **disposed**. These four aspects are all encoded in an Observable instance, but some of these aspects are related to other types, like Observer and Subscription.

Core Observable concerns:

- Creating Observables
- Subscribing to Observables
- Executing the Observable
- Disposing Observables 

## Creating Observables

`Observable.create` is an alias for the `Observable` constructor, and it takes one argument: the `subscribe` function.

```javascript
import { Observable } from 'rxjs';

const observable = Observable.create(function subscribe(observer) {
  const id = setInterval(() => {
    observer.next('hi')
  }, 1000);
});
```

> Observables can be created with `create`, but usually we use the so-called *creation operators*, like `of`, `from`, `interval`, etc.

## Subscribing to Observables

The Observable `observable` in the example can be `subscribed` to:

    observable.subscribe(x => console.log(x));

This shows how `subscribe` calls are not shared among multiple Observers of the same Observable. When calling `observable.subscribe` with an Observer, the function `subscribe` in `Observable.create(function subscribe(observer) {...})` is run for that given Observer. Each call to `observable.subscribe` triggers its own independent setup for that given Observer.

> Subscribing to an Observable is like calling a function, providing callbacks where the data will be delivered to.

With `observable.subscribe`, the given Observer is not registered as a listener in the Observable. The Observable does not even maintain a list of attached Observers.

A subscribe call is simply a way to start an "Observable execution" and deliver values or events to an Observer of that execution.

## Executing Observables

The code inside `Observable.create(function subscribe(observer) {...})` represents an "Observable execution", a lazy computation that only happens for each Observer that subscribes. The execution produces multiple values over time, either synchronously or asynchronously.

There are three types of values an Observable Execution can deliver:

- "Next" notification: sends a value such as a Number, a String, an Object, etc.
- "Error" notification: sends a JavaScript Error or exception.
- "Complete" notification: does not send a value.

**Next notifications** are the most important and most common type: they represent actual data being delivered to an Observer. **Error** and **Complete** notifications may happen only once during the Observable Execution, and there can only be either one of them.

> In an Observable Execution, zero to infinite Next notifications may be delivered. If either an Error or Complete notification is delivered, then nothing else can be delivered afterwards.

It is a good idea to wrap any code in subscribe with try/catch block that will deliver an Error notification if it catches an exception:

```javascript
import { Observable } from 'rxjs';
 
const observable = Observable.create(function subscribe(observer) {
  try {
    observer.next(1);
    observer.next(2);
    observer.next(3);
    observer.complete();
  } catch (err) {
    observer.error(err); // delivers an error if it caught one
  }
});
```

## Disposing Observable Executions

When `observable.subscribe` is called, the Observer gets attached to the newly created Observable execution. This call also returns an object, the `Subscription`. With `subscription.unsubscribe()` you can cancel the ongoing execution:

```javascript
import { Observable } from 'rxjs';

const observable = Observable.from([10, 20, 30]);
const subscription = observable.subscribe(x => console.log(x));
// later 
subscription.unsubscribe();
```

Each Observable must define how to dispose resources of that execution when we create the Observable using `create()`. You can do that by returning a custom unsubscribe function from within function `subscribe()`.

An example for how we can clear an interval execution set with `setInterval`:

```javascript
var observable = Rx.Observable.create(function subscribe(observer) {
  // Keep track of the interval resource
  var intervalID = setInterval(() => {
    observer.next('hi');
  }, 1000);

  // Provide a way of canceling and disposing the interval resource
  return function unsubscribe() {
    clearInterval(intervalID);
    intervalID = null;
  };
});

const subscription = observable1.subscribe(s => {
    console.log('s', s, ' ', intervalID)
});

setTimeout(_ => {
    // the unsubcribe is calling the function declared in the above `Observable.create()`
    subscription.unsubscribe();
    console.log('s', intervalID);
}, 5000);
```

Just like `observable.subscribe` resembles `Observable.create(function subscribe() {...})`, the unsubscribe we return from subscribe is conceptually equal to subscription.unsubscribe.

