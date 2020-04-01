import React, { Component, Fragment } from 'react';
import DevTools from 'mobx-react-devtools';

import TodoListComp from './todo-list.comp';
import TodoListModel from './todo-list.model';

import ExpTodo from './exp.todo.observable.store';
import TodoComp from './exp.todo.comp';

const store = new TodoListModel();

const exp_store = new ExpTodo();

export default class MobxPage extends Component {

    render() {
        return (
            <Fragment>
                <DevTools />
                <p>Mobx Page</p>
                <p>Check the documentation at <a href="https://mobx.js.org/"> here </a>.</p>
                <TodoListComp store={store} />
                <br/>
                <hr/>
                <br/>
                <p>You can have another store. Two stores are independent to each other, no effect on each other though they have the same method <i>addTodo</i>.</p>
                <TodoComp store={exp_store} />
            </Fragment>
        )
    }
}

store.addTodo('Get Coffee');
store.addTodo('Write simpler code');

store.todos[0].finished = true;

setTimeout( _ => {
    store.addTodo('Get a cookie as well');
}, 2000);