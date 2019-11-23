import { connect } from 'react-redux';
import { toggleTodo } from '../actions';
import TodoList from './todo-list.dummy';
import { VisibilityFilters } from '../actions';

const getVisibleTodos = (todos, filter) => {
    switch (filter) {
        case VisibilityFilters.SHOW_ALL:
            return todos;
        case VisibilityFilters.SHOW_COMPLETED:
            return todos.filter(t => t.completed);
        case VisibilityFilters.SHOW_ACTIVE:
            return todos.filter(t => !t.completed)
        default:
            return todos;
    }
}

const mapStateToProps = ({ todos, visibilityFilter }) => ({
    todos: getVisibleTodos(todos, visibilityFilter)
});

const mapDispatchToProps = dispatch => ({
    onTodoClick: id => dispatch(toggleTodo(id))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TodoList);