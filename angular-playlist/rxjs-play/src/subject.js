const { Subject, from, interval, BehaviorSubject, ReplaySubject, AsyncSubject } = require('rxjs');
const { multicast, refCount } = require('rxjs/operators')

function m1() {
    const subject = new Subject();

    subject.subscribe({
        next: v => console.log(`observerA: ${v}`)
    });

    subject.subscribe({
        next: v => console.log(`observerB: ${v}`)
    });

    subject.next('001');
    subject.next('002');

    const observable = from([1, 2, 3]);

    observable.subscribe(subject)
}

m1();

function m2() {
    const source = from([100, 200, 300]);
    const subject = new Subject();
    const multicasted = source.pipe(multicast(subject));

    // These are, under the hood, `subject.subscribe({...})`:
    multicasted.subscribe({
        next: (v) => console.log(`observerA: ${v}`)
    });
    multicasted.subscribe({
        next: (v) => console.log(`observerB: ${v}`)
    });

    // This is, under the hood, `source.subscribe(subject)`:
    multicasted.connect();
}

m2();

function m3() {
    const source = interval(500);
    const subject = new Subject();
    const refCounted = source.pipe(multicast(subject), refCount());
    let subscription1, subscription2;

    // This calls `connect()`, because
    // it is the first subscriber to `refCounted`
    console.log('observerA subscribed');
    subscription1 = refCounted.subscribe({
        next: (v) => console.log(`observerA: ${v}`)
    });

    setTimeout(() => {
        console.log('observerB subscribed');
        subscription2 = refCounted.subscribe({
            next: (v) => console.log(`observerB: ${v}`)
        });
    }, 1300);

    setTimeout(() => {
        console.log('observerA unsubscribed');
        subscription1.unsubscribe();
    }, 2600);

    // This is when the shared Observable execution will stop, because
    // `refCounted` would have no more subscribers after this
    setTimeout(() => {
        console.log('observerB unsubscribed');
        subscription2.unsubscribe();
    }, 5100);
}

m3();

function m4() {
    const subject = new BehaviorSubject(0); // 0 is the initial value

    const subscription = subject.subscribe({
        next: (v) => console.log(`Behavior observerA: ${v}`)
    });

    subject.next(1);
    subject.next(2);
    subscription.unsubscribe();

    subject.subscribe({
        next: (v) => console.log(`Behavior observerB: ${v}`)
    });

    subject.next(3);
}

m4();

function m5() {
    const subject = new ReplaySubject(3); // buffer 3 values for new subscribers

    subject.subscribe({
        next: (v) => console.log(`replay observerA: ${v}`)
    });

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.next(4);

    subject.subscribe({
        next: (v) => console.log(`replay observerB: ${v}`)
    });

    subject.next(5);
}
m5();

function m6() {
    const subject = new ReplaySubject(100, 500 /* windowTime */);

    subject.subscribe({
        next: (v) => console.log(`replay with time observerA: ${v}`)
    });

    let i = 1;
    setInterval(() => subject.next(i++), 200);

    setTimeout(() => {
        subject.subscribe({
            next: (v) => console.log(`replay with time observerB: ${v}`)
        });
    }, 1000);
}
m6();

function m7() {
    const subject = new AsyncSubject();

    subject.subscribe({
        next: (v) => console.log(`async observerA: ${v}`)
    });

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.next(4);

    subject.subscribe({
        next: (v) => console.log(`async observerB: ${v}`)
    });

    subject.next(5);
    subject.next(8);
    subject.complete();
}
m7();