// Component({
//   data: {
//     c_data: '',
//   },
//   methods: {
//     shenfen() {}
//   }
// })

Page({
  data: {
    inputValue: '',
    todos: [],
    nest: {
      deep: {
        d: 'b'
      },
    },
  },
  handleInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },
  toggleTodo(e) {
    const index = e.target.dataset.index;
    const { todos } = this.data;
    const ori = todos[index];
    todos[index] = {...ori, complete: !ori.complete}
    this.setData({
      todos
    })
  },

  addTodo() {
    const { inputValue, todos } = this.data;
    if (!inputValue) {
      wx.showToast({
        title: '请输入Todo内容',
        icon: 'none'
      })
      return;
    }
    const newTodos = [...todos, {
      label: inputValue,
      complete: false
    }];
    this.setData({
      inputValue: '',
      todos: newTodos
    })
  },

  seedTodo() { 
    let i = 3;
    const seeds = [];
    while(i--) {
      seeds.push({
        label: 'fake'+i,
        complete: false
      })
    }
    const { todos } = this.data;
    this.setData({
      todos: todos.concat(seeds)
    })
  },
  onLoad: function () {
    console.log('big number', 1_000_000_2);
    console.log('string_replace_all'.replaceAll('a', '2'));
    console.log(this.data.nest.deep?.d ?? 'optional chain');
    console.log(this.data.nest.deep?.c ?? 'nullish');
  }
})
