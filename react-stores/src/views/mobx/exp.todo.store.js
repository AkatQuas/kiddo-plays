export default class TodoStore {
    todos = [];
    get completedTodosCount() {
        const { todos } = this;
        return todos.filter(todo => todo.completed).length;
    }
    report() {
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

