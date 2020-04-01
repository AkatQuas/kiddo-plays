const { interval } = require('rxjs');

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

const observable1 = interval(400);
const observable2 = interval(300);
 
const subscription1 = observable1.subscribe(x => console.log('first: ' + x));
const childSubscription = observable2.subscribe(x => console.log('second: ' + x));
 
subscription1.add(childSubscription);
 
setTimeout(() => {
  // Unsubscribes BOTH subscription and childSubscription
  subscription1.unsubscribe();
}, 5000);
