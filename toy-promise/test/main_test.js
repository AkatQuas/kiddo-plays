const assert = require('assert');
const { ToyPromise1, ToyPromise2, ToyPromise3, ToyPromise4 } = require('..');

thenWorksBeforeAndAfterSettlement(
  ToyPromise1,
  ToyPromise2,
  ToyPromise3,
  ToyPromise4
);
youCanOnlySettleOnce(ToyPromise1, ToyPromise2, ToyPromise3, ToyPromise4);
simpleChaining(ToyPromise2, ToyPromise3, ToyPromise4);
flatteningPromises(ToyPromise3, ToyPromise4);
rejectingByThrowingInReactions(ToyPromise4);

function thenWorksBeforeAndAfterSettlement(...ToyPromiseClasses) {
  for (const ToyPromise of ToyPromiseClasses) {
    test(`Resolving before then() (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.resolve('result');
      tp.then((v) => {
        assert.equal(v, 'result');
        done();
      });
    });
    test(`Resolving after then() (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.then((v) => {
        assert.equal(v, 'result');
        done();
      });
      tp.resolve('result');
    });
    test(`Rejecting before then() (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.reject('err');
      tp.then(undefined, (value) => {
        assert.equal(value, 'err');
        done();
      });
    });
    test(`Rejecting after then() (${ToyPromise.name})`, (done) => {
      const dp = new ToyPromise();
      dp.then(undefined, (value) => {
        assert.equal(value, 'err');
        done();
      });
      dp.reject('err');
    });
  }
}

function youCanOnlySettleOnce(...ToyPromiseClasses) {
  for (const ToyPromise of ToyPromiseClasses) {
    test(`You can only resolve once (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.resolve('first');
      tp.then((value) => {
        assert.equal(value, 'first');
        tp.resolve('second'); // resolve again
        tp.then((value) => {
          assert.equal(value, 'first'); // unchanged
          done();
        });
      });
    });
    test(`You can only reject once (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.reject('firstError');
      tp.then(undefined, (value) => {
        assert.equal(value, 'firstError');
        tp.reject('secondError'); // reject again
        tp.then(undefined, (value) => {
          assert.equal(value, 'firstError'); // unchanged
          done();
        });
      });
    });
  }
}

function simpleChaining(...ToyPromiseClasses) {
  for (const ToyPromise of ToyPromiseClasses) {
    test(`Fulfilling via onFulfilled (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.resolve();
      tp.then((value1) => {
        assert.equal(value1, undefined);
        return 123;
      }).then((value2) => {
        assert.equal(value2, 123);
        done();
      });
    });
    test(`Fulfilling via onRejected (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.reject();
      tp.catch((reason) => {
        assert.equal(reason, undefined);
        return 123;
      }).then((value) => {
        assert.equal(value, 123);
        done();
      });
    });
    test(`Missing onFulfilled is skipped (${ToyPromise.name})`, (done) => {
      const tp = new ToyPromise();
      tp.resolve('a');
      tp.then((value1) => {
        assert.equal(value1, 'a');
        return 'b';
      })
        // Missing onFulfilled: value is passed on to next .then()
        .catch((reason) => {
          // Never called
          assert.fail();
        })
        .then((value2) => {
          assert.equal(value2, 'b');
          done();
        });
    });
  }
}

function flatteningPromises(...ToyPromiseClasses) {
  for (const ToyPromise of ToyPromiseClasses) {
    test(`Chaining with a promise (${ToyPromise.name})`, (done) => {
      const tp1 = new ToyPromise();
      const tp2 = new ToyPromise();
      tp1.resolve(tp2);
      tp2.resolve(123);
      // Has the value been passed on to tp1?
      tp1.then((value) => {
        assert.equal(value, 123);
        done();
      });
    });
  }
}

function rejectingByThrowingInReactions(...ToyPromiseClasses) {
  for (const ToyPromise of ToyPromiseClasses) {
    test(`Rejecting via onFulfilled (${ToyPromise.name})`, (done) => {
      let myError;
      const tp = new ToyPromise();
      tp.resolve();
      tp.then((value) => {
        assert.equal(value, undefined);
        throw (myError = new Error()); // throw to reject
      }).catch((reason) => {
        assert.equal(reason, myError);
        done();
      });
    });
    test(`Rejecting via onRejected (${ToyPromise.name})`, (done) => {
      let myError;
      const tp = new ToyPromise();
      tp.reject();
      tp.catch((reason1) => {
        assert.equal(reason1, undefined);
        throw (myError = new Error()); // throw again
      }).catch((reason2) => {
        assert.equal(reason2, myError);
        done();
      });
    });
  }
}
