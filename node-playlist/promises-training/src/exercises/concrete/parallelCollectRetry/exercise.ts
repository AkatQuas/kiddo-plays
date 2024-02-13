type Context = {
  postData: (data: string) => Promise<string>;
};

type Record = {
  data: string;
  result: string | undefined;
  errors: unknown[];
};

async function normal(
  list: string[],
  postData: (data: string) => Promise<string>
) {
  const records = list.map<Record>((data) => ({
    data,
    result: undefined,
    errors: [],
  }));

  let tried = 0;
  let needRetry = true;
  while (needRetry && tried < 4) {
    needRetry = false;
    const todo = records.filter((a) => !a.result);

    const taskList = todo.map(async (r) => {
      try {
        r.result = await postData(r.data);
      } catch (error) {
        needRetry = true;
        r.errors.push(error);
      }
    });
    await Promise.all(taskList);
    tried += 1;
  }

  // records are still bad
  if (records.some((a) => !a.result && a.errors.length > 0)) {
    throw records.filter((a) => a.errors.length > 0).map((a) => a.errors);
  }

  return records.map((a) => a.result);
}

export default ({ postData }: Context) =>
  async (list: Array<string>) => {
    return await normal(list, postData);
  };
