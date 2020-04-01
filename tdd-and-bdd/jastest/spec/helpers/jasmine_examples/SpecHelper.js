beforeEach(function () {
  jasmine.addMatchers({
    toBeGoofy: function (util, customEqualityTesters) {
      // more on 'util' parameter, please visit https://github.com/pivotal/jasmine/blob/master/src/core/matchers/matchersUtil.js
      return {
        compare: function (actual, expected) {
          if (expected === undefined) {
            expected = '';
          }
          const result = {};
          // you can use `eqeq` or `eqeqeq`,
          // to get a boolean result for `pass`
          result.pass = util.equals(actual.hyuk, "gawrsh" + expected, customEqualityTesters);
          if (result.pass) {
            result.message = "Expected " + actual + " not to be quite so goofy";
          } else {
            result.message = "Expected " + actual + " to be goofy, but it was not very goofy";
          }
          return result;
        }
      }
    },
    toBeBoolTrue: function (util) {
      return {
        compare(actual, expected) {
          expected = true;
          return { pass: util.equals(actual, expected) };
        }
      };
    },
    toBePlaying: function () {
      return {
        compare: function (actual, expected) {
          var player = actual;

          return {
            pass: player.currentlyPlayingSong === expected && player.isPlaying
          }
        }
      };
    }
  });
});
