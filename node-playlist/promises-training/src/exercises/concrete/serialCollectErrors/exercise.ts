import { reduceArrayAsync } from "../../../lib/reduceArrayAsync.js";

type Context = {
  postData: (data: string) => Promise<string>;
};
function amazing(list: string[], postData: (data: string) => Promise<string>) {
  return list.reduce(
    async (result, el) => {
      const acc = await result;

      try {
        const r = await postData(el);
        acc.successes.push(r);
      } catch (error) {
        acc.errors.push(error);
      }

      return acc;
    },
    Promise.resolve({ successes: [], errors: [] } as {
      successes: string[];
      errors: unknown[];
    })
  );
}

function normal(list: string[], postData: (data: string) => Promise<string>) {
  return reduceArrayAsync(
    list,
    async (result, el, index) => {
      const acc = await result;

      try {
        const r = await postData(el);
        acc.successes.push(r);
      } catch (error) {
        acc.errors.push(error);
      }
      return acc;
    },
    Promise.resolve({ successes: [], errors: [] } as {
      successes: string[];
      errors: unknown[];
    })
  );
}

export default ({ postData }: Context) =>
  async (list: Array<string>) => {
    return amazing(list, postData);
  };
