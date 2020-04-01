const { Observable } = require('rxjs');

function m1() {
    const observable = Observable.create(observer => {
        observer.next(1);
        observer.next(2);
        observer.next(3);
        setTimeout(_ => {
            observer.next(4);
            observer.complete();
        }, 1000);
    });

    console.log('before subscribe');

    observable.subscribe({
        next: x => console.log('got value: ' + x),
        error: err => console.error('something wrong: ' + err),
        complete: _ => console.log('done')
    });

    console.log('just after subscribe');
}
m1();

function m2() {

    const foo = Observable.create(observer => {
        console.log('hello');
        observer.next(42);
        observer.next(100);
        observer.complete();

        observer.next(500); //dead value, will never execute
    });

    foo.subscribe(x => {
        console.log(x);
    });
    console.log('after x, before y');

    foo.subscribe({
        next: y => {
            console.log(y);
        },
        complete: v => {
            console.log('y complete');
        }
    });
}
m2();

function m3() {
    console.log('-----------')
    let intervalID;
    const observable1 = Observable.create(function subscribe(observer) {
        // Keep track of the interval resource
        intervalID = setInterval(() => {
            observer.next('hi');
        }, 1000);

        // Provide a way of canceling and disposing the interval resource
        return function unsubscribe() {
            clearInterval(intervalID);
            intervalID = null;
            return 'end';
        };
    });

    const uns = observable1.subscribe(s => {
        console.log('s', s, ' ', intervalID)
    });

    setTimeout(_ => {
        uns.unsubscribe();
        console.log('s', intervalID);
    }, 5000);
}

m3();
