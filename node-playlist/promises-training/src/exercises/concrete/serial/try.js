/**
 * @param {string} x
 */
const postData = async (x) => {
  await Promise.resolve();
  return "base_" + x;
};

export const reduceArrayAsync = async (array, reducer, initialAccumulator) => {
  let accumulator = await initialAccumulator;

  for (let index = 0; index < array.length; index++) {
    const current = array[index];
    accumulator = await reducer(accumulator, current, index);
  }

  return accumulator;
};

const list = ["a", "b", "c", "d", "e", "f"];
async function one() {
  debugger;
  const final = list.reduce(async (result, data) => {
    debugger;
    console.debug("\x1B[97;100;1m --- result --- \x1B[m", "\n", result);
    const acc = await result;
    console.debug("\x1B[97;100;1m --- acc --- \x1B[m", "\n", acc);

    const toReturn = [...acc, await postData(data)];
    console.debug("\x1B[97;100;1m --- toReturn --- \x1B[m", "\n", toReturn);
    return toReturn;
  }, Promise.resolve([]));
  console.debug("\x1B[97;42;1m --- final --- \x1B[m", "\n", await final);
}

async function two() {
  let acc = await Promise.resolve([]);
  for (let index = 0; index < list.length; index++) {
    debugger;
    const el = list[index];
    const x = await postData(el);
    acc.push(x);
  }
  return acc;
}

// console.debug("\x1B[97;42;1m --- two --- \x1B[m", "\n", await two());

// async function normal() {
//   const ob = [];
//   return await reduceArrayAsync(
//     list,
//     async (result, el, index) => {
//       debugger;
//       ob.push(result);
//       const acc = await result;
//       const r = await postData(el);
//       acc.push(r);
//       return acc;
//     },
//     Promise.resolve([])
//   );
// }

// console.debug("\x1B[97;42;1m --- normal --- \x1B[m", "\n", await normal());

async function settled() {
  const job = async () => {
    if (Math.random() > 0.5) {
      return Promise.reject(new Error("Bad"));
    }
    return Promise.resolve("Good");
  };

  const jobs = list.map((_) => job());
  const r = await Promise.allSettled(jobs);
  console.debug("\x1B[97;100;1m --- random --- \x1B[m", "\n", r);
}

settled();
