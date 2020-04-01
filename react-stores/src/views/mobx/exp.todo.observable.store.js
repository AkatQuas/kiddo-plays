import { observable, computed, autorun } from "mobx";

export default class ObservableTodoStore {
    @observable todos = [];
    @observable pendingRequests = 0;

    constructor () {
        autorun(_ => {
            console.log(_);
        });
    }

    @computed get completedTodosCount () {
        console.log('called completeCount');
        const {todos} = this;
        return todos.filter(todo => todo.completed).length;
    }

    @computed get report() {
        console.log('called report');
        const { todos, completedTodosCount } = this;
        if (!todos.length) {
            return '<none>';
        }
        return `Next todo: "${todos[0].task}". Progress: ${completedTodosCount}/${todos.length}`
    }

    addTodo(task) {
        this.todos.push({
            task,
            completed: false,
            assignee: null
        });
    }
}

