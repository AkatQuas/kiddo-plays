
describe('On Official Document', () => {
  describe('manually ticking the Jasmine Clock', () => {
    let timerCallback;
    beforeEach(() => {
      timerCallback = jasmine.createSpy('timerCallback');
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });
    it('causes a timeout to be called synchronously', () => {
      setTimeout(() => {
        timerCallback();
      }, 1000);

      expect(timerCallback).not.toHaveBeenCalled();
      jasmine.clock().tick(100);
      expect(timerCallback).not.toHaveBeenCalled();
      jasmine.clock().tick(901);
      expect(timerCallback).toHaveBeenCalled();
    });

    it("causes an interval to be called synchronously", function () {
      setInterval(function () {
        timerCallback();
      }, 100);

      expect(timerCallback).not.toHaveBeenCalled();

      jasmine.clock().tick(101);
      // expect(timerCallback.calls.count()).toEqual(1);
      expect(timerCallback).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(50);
      // expect(timerCallback.calls.count()).toEqual(1);
      expect(timerCallback).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(50);
      // expect(timerCallback.calls.count()).toEqual(2);
      expect(timerCallback).toHaveBeenCalledTimes(2);
    });


    it('can also mock the date object and set it to a givent time', () => {
      let baseTime = new Date(2019, 6, 13);
      jasmine.clock().mockDate(baseTime);
      jasmine.clock().tick(50);
      // console.log(Date.now() === baseTime.getTime()) -> true;

      expect(new Date().getTime()).toEqual(baseTime.getTime() + 50);
    });
  });

});