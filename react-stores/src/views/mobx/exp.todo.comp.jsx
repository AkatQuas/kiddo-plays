import React, { Component } from 'react';

import { observer } from 'mobx-react';

@observer
class TodoView extends Component {
    render() {
        const { todo } = this.props;

        return (
            <li onDoubleClick={ this.onRename }>
                <input  
                    type="checkbox"
                    checked={todo.completed}
                    onChange={this.onToggleCompleted}
                />
                {todo.task}
                {todo.assignee  && <small> {todo.assignee.name}</small>}
            </li>
        )
    }

    onToggleCompleted = _ => {
        const { todo } = this.props;
        todo.completed = !todo.completed;
    }

    onRename = _ => {
        const { todo } = this.props;
        todo.task = prompt('Task name', todo.task) || todo.task;
    }
}

@observer
export default class TodoList extends Component {
    onNewTodo = _ => {
        const { store } = this.props;
        store.addTodo(prompt('Enter a new todo:', 'coffee plz'));
    }
    render() {

        const { store } = this.props;
        return (
            <div>
                {store.report}
                <ul>
                    {store.todos.map((todo, idx) => <TodoView todo={todo} key={idx} />)}
                </ul>
                {store.pendingRequests > 0 && <span>Loading </span>}
                <button onClick={this.onNewTodo} >New Todo</button>
                <small>(double-click a todo to edit)</small>
            </div>
        )
    }
}