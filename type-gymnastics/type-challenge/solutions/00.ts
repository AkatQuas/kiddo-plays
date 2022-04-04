interface IState {
  name: string;
  capital: string;
}
interface IState {
  population: number;
}

interface Name {
  first: string;
  last?: string;
}
type DancingDuo<T extends Name> = [T, T];

type A = {};
type B = { age: 'b' };

interface IA {}
interface IB {
  age: 'b';
}
type C = 0 extends number ? true : false;
