Page({
  data: {
    inputValue: '',
    todos: [],
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
  }
})
