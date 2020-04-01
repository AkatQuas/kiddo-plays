import { combineReducers } from 'redux';
import randomstring from 'randomstring';

import {
    ADD_TODO,
    TOGGLE_TODO,
    SET_VISIBILITY_FILTER,
    SEED_TODOS,
    VisibilityFilters
} from './actions';

const { SHOW_ALL } = VisibilityFilters;

const visibilityFilter = (state = SHOW_ALL, { type, filter}) => {
    switch (type) {
        case SET_VISIBILITY_FILTER:
            return filter;
        default:
            return state;
    }
}

const todos = (state = [], {type, text, index}) => {
    switch (type) {
        case ADD_TODO: 
            return [
                ...state,
                {
                    text,
                    completed: false
                }
            ];
        case TOGGLE_TODO:
            return state.map((todo, todo_index) => todo_index === index ? {...todo, completed: !todo.completed } : todo);
        case SEED_TODOS: 
            const seeds = new Array(3).fill(0).map((_, i) => ({
                    text: randomstring.generate(),
                    completed: !(i % 2)
                }));
            return [
                ...state,
                ...seeds
            ]
        default: 
            return  state;
    }
}

export default combineReducers({
    visibilityFilter,
    todos
})