export const howOld = (name: string, age: number) => {
  console.log(`${name} is ${age} years old`);
};

export const report = () => {
  howOld('Bob', 12);
};

export const report2 = (fn: (name: string, age: number) => void) => {
  return fn('Alice', 12);
};
