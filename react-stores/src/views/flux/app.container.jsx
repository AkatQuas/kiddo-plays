import React, { Fragment } from 'react';
import { Container } from 'flux/utils';
import TodoStore from './todo.store';
import TodoActions from './todo.actions';

const Header = _ => (
    <header id="header">
        <h1>todos</h1>
    </header>
)

const Main = props => {
    const { todos, onToggeleTodo , onDeleteTodo } = props;
    return todos.size === 0 ? null : (
        <section id="main">
            <ul id="todo-list">
                {[...todos.values()].reverse().map(todo => (
                    <li key={todo.id}>
                        <div className="view">
                            <input
                                type="checkbox"
                                className="toggle"
                                checked={todo.complete}
                                onChange={ _ => onToggeleTodo(todo.id)}
                            />
                            <label>{todo.text}</label>
                            <button
                                className="destroy"
                                onClick={_ => onDeleteTodo(todo.id)}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}

const Footer = props => {
    const { todos } = props;

    const remaining = todos.filter(todo => !todo.complete).size;
    const phrase = remaining === 1 ? ' item left' : ' items left';

    return todos.size === 0 ? null : (
        <footer id="footer">
            <span id="todo-count">
                <strong>{remaining}</strong>{phrase}
            </span>
        </footer>
    )
}

const AppView = props => (
    <Fragment>
        <Header />
        <p>not finished !!TODO!!</p>
        <Main {...props} />
        <Footer {...props} />
    </Fragment>
)

const getStores = _ => [TodoStore];

const getState = _ => ({
    todos: TodoStore.getState(),
    onDeleteTodo: TodoActions.deleteTodo,
    onToggeleTodo: TodoActions.toggleTodo 
});

export default Container.createFunctional(AppView, getStores, getState);

