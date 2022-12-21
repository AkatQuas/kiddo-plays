const d = require('./tf');
// pages/component/ad/ad.js
// Component({
//   data: {
//     data1: '1',
//   },
//   properties: {
//     prop: 2,
//     data: {},
//     methods: {},
//   },
//   methods: {
//     doAction() {},
//   },
//   lifetimes: {
//     created() {},
//   },
//   created() {},
//   detached(res) {},
// });
const c = {};

function fun() {}
Component({
  data: {
    cd1: '',
    cd2: 22,
  },
  properties: {
    pc1: 22,
    pc2: 33,
  },
  onLoad() {},
  handleClick() {},
  chen: () => {},
  chen2: async () => {},
  fun,
  fun2: fun,
});
Page({
  ...c,
  data: {
    pd1: '',
    pd2: 33,
  },
  grab() {},
  methods: {
    drive() {},
    halt: () => {},
    dive: async function dive() {},
    fly: function fly() {},
  },
});

// new Component();
// b.a();
