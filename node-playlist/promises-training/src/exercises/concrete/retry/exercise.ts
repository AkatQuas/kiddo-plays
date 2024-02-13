type Context = {
  getData: (data: string) => Promise<string>;
};

async function recursive(getData: Context["getData"], data: string) {
  const job = async (count: number, errors: unknown[]): Promise<string> => {
    if (count < 0) {
      throw errors;
    }
    try {
      const r = await getData(data);
      return r;
    } catch (error) {
      errors.push(error);
    }

    return await job(count - 1, errors);
  };
  return await job(3, []);
}

async function loop(getData: Context["getData"], data: string) {
  let errors: unknown[] = [];
  let count = 4;

  while (count > 0) {
    try {
      return await getData(data);
    } catch (error) {
      count -= 1;
      errors.push(error);
    }
  }
  throw errors;
}

export default ({ getData }: Context) =>
  async (data: string) => {
    return await loop(getData, data);
  };
