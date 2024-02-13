type Context = {
  postData: (data: string) => Promise<string>;
};

export default ({ postData }: Context) =>
  async (list: Array<string>) => {
    const result = await Promise.allSettled(list.map((a) => postData(a)));
    return result.reduce(
      (acc, r) => {
        if (r.status === "fulfilled") {
          acc.successes.push(r.value);
        } else if (r.status === "rejected") {
          acc.errors.push(r.reason);
        }
        return acc;
      },
      {
        successes: [],
        errors: [],
      } as {
        successes: string[];
        errors: unknown[];
      }
    );
  };
