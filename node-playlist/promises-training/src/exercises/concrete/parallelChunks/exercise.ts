import { chunk } from "lodash";
import { reduceArrayAsync } from "../../../lib/reduceArrayAsync.js";

type Context = {
  postData: (data: string) => Promise<string>;
};

async function better(
  postData: (data: string) => Promise<string>,
  list: string[]
) {
  const chunkList = chunk(list, 5);

  return reduceArrayAsync(
    chunkList,
    async (result, el) => {
      const acc = await result;
      return acc.concat(await Promise.all(el.map((d) => postData(d))));
    },
    Promise.resolve([] as string[])
  );
}

async function normal(
  postData: (data: string) => Promise<string>,
  list: string[]
) {
  const job = async (todo: string[], context: string[]): Promise<string[]> => {
    if (todo.length < 1) {
      return context;
    }
    const chunk = todo.slice(0, 5);
    const rest = todo.slice(5);
    const result = await Promise.all(chunk.map((d) => postData(d)));
    context = context.concat(result);
    return await job(rest, context);
  };
  return await job(list, []);
}

export default ({ postData }: Context) =>
  async (list: Array<string>) => {
    return await better(postData, list);
  };
