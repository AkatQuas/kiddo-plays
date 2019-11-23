import React from 'react';
import { VisibilityFilters } from '../actions';
import FilterLink from './filter-link.container';

export default _ => (
    <p>
        Show:
        <FilterLink filter={VisibilityFilters.SHOW_ALL}>ALL</FilterLink>
        <FilterLink filter={VisibilityFilters.SHOW_ACTIVE}>Active</FilterLink>
        <FilterLink filter={VisibilityFilters.SHOW_COMPLETED}>Completed</FilterLink>
    </p>
)