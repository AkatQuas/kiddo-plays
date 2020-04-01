import React, { Component, Fragment } from 'react';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import todoApp from './reducers';
import Footer from './components/footer.dummy';
import AddTodo from './components/add-todo.container';
import VisibleTodoList from './components/visible-todolist.container';
import logger from 'redux-logger';

const myMiddle = ({ getState, dispatch }) => next => action => {
    console.log('This is my middleware 1');
    next(action);
}
const myMiddle2 = ({ getState, dispatch }) => next => action => {
    console.log('This is my middleware 2');
    next(action);
}
const store = createStore(
    todoApp,
    {},
    applyMiddleware(myMiddle, logger, myMiddle2)
);

export default class ReduxPage extends Component {

    render() {
        return (
            <Provider store={store}>
                <Fragment>
                    <p>Redux Page</p>

                    <div>Check the tutorial at <a href="https://redux.js.org/basics/actions">here</a> </div>
                    <ul>
                        <li>step1: create some actions which return an object with <i>type</i> and <i>payload</i></li>
                        <li>step2: create corresponding <i>action-type</i> reducer functions, which could be <i>combineReducers</i>-ed in redux</li>
                        <li>step3: <i>connect</i> components with <i>react-redux</i> , <i>mapStateToProps</i> or <i>mapDispatchToProps</i> or just inject <i>dispatch</i> into the component.</li>
                        <li>step4: call the <i>dispatch</i> function in the components methods. Or, use the data from redux through <i>props</i></li>
                        <li>step5: as fro middlewares, take a look at the method <i>applyMiddleware</i> from redux. <a href="https://github.com/evgenyrodionov/redux-logger">Redux-logger</a> for development logging store states. <a href="https://github.com/reduxjs/redux-thunk">Redux-thunk</a>  for asynchronous calls which returns a function in which you can invoke sync or async actions with `dispatch`. <a href="https://github.com/redux-utilities/redux-promise">Redux-promise</a> is another one middleware that allows you to invoke async actions. </li>
                    </ul>
                    <hr />
                    <Footer />
                    <AddTodo />
                    <VisibleTodoList />
                </Fragment>
            </Provider>
        )
    }
}