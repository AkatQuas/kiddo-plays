import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

const Todo = ({
    onClick,
    completed, text
}) => (
        <Fragment>
            <li
                onClick={onClick}
                style={{
                    textDecoration: completed ? 'line-through' : 'none'
                }}
            >
                {text}
            </li>
            <style jsx>{`
        li {
            cursor: pointer;
        }
    `}</style>
        </Fragment>
    )

Todo.propTypes = {
    onClick: PropTypes.func.isRequired,
    completed: PropTypes.bool.isRequired,
    text: PropTypes.string.isRequired
}

const TodoList = ({ todos, onTodoClick }) => (
    <ul>
        {todos.map((todo, index) => (<Todo key={index} {...todo} onClick={_ => onTodoClick(index)} />))}
    </ul>
)

TodoList.propTypes = {
    todos: PropTypes.arrayOf(
        PropTypes.shape({
            completed: PropTypes.bool.isRequired,
            text: PropTypes.string.isRequired
        }).isRequired
    ).isRequired,
    onTodoClick: PropTypes.func.isRequired
}

export default TodoList