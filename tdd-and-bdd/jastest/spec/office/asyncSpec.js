
describe('On Official Document', () => {

  describe('Asynchronous specs', () => {
    function soon() {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          resolve();
        }, 1);
      });
    }

    function browserHasPromises() {
      return typeof Promise !== 'undefined';
    }

    function getAsyncCtor() {
      try {
        eval("var func = async function(){};");
      } catch (e) {
        return null;
      }

      return Object.getPrototypeOf(func).constructor;
    }

    function browserHasAsyncAwaitSupport() {
      return getAsyncCtor() !== null;
    }
    let value;

    describe('Using callbacks', () => {
      beforeEach((done) => {
        setTimeout(() => {
          value = 0;
          done();
        })
      }, 10);
      it('should support asynchronous execution fo test preparaton and expectations', (done) => {
        value += 1;
        expect(value).toBeGreaterThan(0);
        done();
      });

      describe('A spect using done.fail', () => {
        const foo = (x, cb1, cb2) => {
          const cb = x ? cb1 : cb2;
          setTimeout(cb, 10);
        };
        it('should not call the second callback', (done) => {
          foo(true,
            done,
            () => {
              done.fail('second callback has been called');
            });
        });
      });
    });

    describe('Using Promise', () => {
      if (!browserHasPromises()) {
        return;
      }
      beforeEach(() => {
        return soon().then(() => {
          value = 0;
        });
      });
      it('should support asynchronous exectuon of test preparation and expectations', () => {
        soon().then(() => {
          value += 1;
          expect(value).toBeGreaterThan(0);
        });
      });
    });

    describe('Using async/await', () => {
      if (!browserHasAsyncAwaitSupport()) {
        return;
      }
      beforeEach(async () => {
        await soon();
        value = 0;
      });

      it('should support async/await execution of test preparation and expections', async () => {
        await soon();
        value += 1;
        expect(value).toBeGreaterThan(0);
      });
    });

    describe('long asynchronous specs', () => {
      beforeEach((done) => {
        done();
      }, 1000);
      it('takes a long time by beforeEach', done => {
        setTimeout(() => {
          done();
        }, 9000)
      }, 10000);
      afterEach(done => {
        done();
      }, 1000);
    });
  });

});