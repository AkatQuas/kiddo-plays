type Context = {
  postData: (data: string) => Promise<string>;
  now: () => number;
};

const normal = async (
  data: string,
  postData: Context["postData"],
  now: Context["now"]
) => {
  let start = now();
  const errors: unknown[] = [];
  while (now() - start <= 2000) {
    try {
      return await postData(data);
    } catch (error) {
      errors.push(error);
    }
  }
  throw errors;
};

export default ({ postData, now }: Context) =>
  async (data: string) => {
    return normal(data, postData, now);
  };
