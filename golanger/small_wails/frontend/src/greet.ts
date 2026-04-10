import { Greet } from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';

export const generate = async (name: string) => {
  let person = new main.Person({ name, age: 27 });
  const result = await Greet(person);
  console.log(result);
  return result;
};
