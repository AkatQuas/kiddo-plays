// new Promise((resolve) => {
//   console.log(1);
//   setTimeout(() => {
//     console.log(3);
//     resolve(0);
//   }, 100);
// }).then(() => console.log(4));
// console.log(2);

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
