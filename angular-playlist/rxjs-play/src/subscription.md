# Subscription

[original](https://rxjs-dev.firebaseapp.com/guide/subscription)

[codes](./subscription.js)

A Subscription is an object that represents a disposable resource, usually the execution of an Observable. A Subscription has one important method, `unsubscribe`, that takes no argument and just disposes the resource held by the subscription. In previous versions of RxJS, Subscription was called "Disposable".

```javascript
import { interval } from 'rxjs';

const observable = interval(1000);
const subscription = observable.subscribe(x => {
    console.log(x);
});
// Later:
// This cancels the ongoing Observable execution which
// was started by calling subscribe with an Observer.
setTimeout(_ => {
    subscription.unsubscribe();
}, 5000);
```

> A Subscription essentially just has an `unsubscribe()` function to release resources or cancel Observable executions.

Subscriptions can also be put together, so that a call to an `unsubscribe()` of one Subscription may unsubscribe multiple Subscriptions. You can do this by "adding" one subscription into another:


```javascript
import { interval } from 'rxjs';
 
const observable1 = interval(400);
const observable2 = interval(300);
 
const subscription = observable1.subscribe(x => console.log('first: ' + x));
const childSubscription = observable2.subscribe(x => console.log('second: ' + x));
 
subscription.add(childSubscription);
 
setTimeout(() => {
  // Unsubscribes BOTH subscription and childSubscription
  subscription.unsubscribe();
}, 6000);
```
Subscriptions also have a `remove(otherSubscription)` method, in order to undo the addition of a child Subscription.