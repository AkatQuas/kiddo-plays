import React, { Component } from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';

const TodoItem = observer(({todo}) => (
    <li>
        <input type="checkbox" checked={todo.finished} onChange={ _ => todo.finished = !todo.finished} />
        {todo.title}
    </li>
));

@observer
export default class TodoList extends Component {
    @observable newTodoTitle = '';

    render() {
        const { store } = this.props;
        const { newTodoTitle } =this;
        return (
            <div>
                <div>
                New Todo:
                    <input type="text" value={newTodoTitle} onChange={this.handleInputChange} />
                    <button type="submit" onClick={this.handleFormSubmit}>Add</button>
                </div>
                <hr/>
                <ul>
                    { store.todos.map(todo => (
                        <TodoItem todo={todo} key={todo.id} />
                    ))}
                </ul>
                Tasks left: { store.unfinishedTodoCount }
            </div>
        )
    }

    @action
    handleInputChange = e => {
        this.newTodoTitle = e.target.value;
    }

    @action
    handleFormSubmit = _ => {
        const { store } = this.props;
        const { newTodoTitle } =this;
        store.addTodo(newTodoTitle);
        this.newTodoTitle = '';
    }
}
