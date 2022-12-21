function add() {}
Page({
  // failed to parse shorthand function
  add: add,
  data: {
    a: 'b',
  },
  onLoad(res) {},
  onShow: function (res) {
    this.ctx = tt.createCanvasContext('canvas');
    this.r = 300 / 2;
    this.rem = 300 / 200;

    this.interval = setInterval(() => {
      this.draw();
    }, 1000);
  },
  drawBackground() {},
  async ant() {},
  drawHour(hour, minute) {},
  onUnload: function onUnload() {
    clearInterval(this.interval);
  },
});
