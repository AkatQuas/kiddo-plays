import { observable , computed, action } from 'mobx';

import TodoModel from './todo.model';

export default class TodoListModel {
    @observable todos = [];

    @computed get unfinishedTodoCount () {
        const { todos } = this;
        return todos.filter(todo => !todo.finished).length;
    }

    @action
    addTodo(title) {
        this.todos.push(new TodoModel(title));
    }
}