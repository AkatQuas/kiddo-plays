import { Todo } from '@nrwl-todos/data';
import './todos.module.less';

export interface TodosProps {
  todos: Todo[];
}

export const Todos = (props: TodosProps) => {
  return (
    <ul>
      {props.todos.map((t) => (
        <li className={'todo'}>{t.title}</li>
      ))}
    </ul>
  );
};

export default Todos;
