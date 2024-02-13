import { reduceArrayAsync } from "../../../lib/reduceArrayAsync.js";

type Context = {
  postData: (data: string) => Promise<string>;
};

const amazing = async (list: string[], postData: Context["postData"]) => {
  return await list.reduce(async (result, el) => {
    const acc = await result;
    const next = await postData(el);
    acc.push(next);
    return acc;
  }, Promise.resolve([] as string[]));
};

const normal = async (list: string[], postData: Context["postData"]) => {
  return await reduceArrayAsync(
    list,
    async (acc, el, index) => {
      const r = await postData(el);
      acc.push(r);
      return acc;
    },
    Promise.resolve([] as string[])
  );
};

export default ({ postData }: Context) =>
  async (list: Array<string>) => {
    return amazing(list, postData);
  };
