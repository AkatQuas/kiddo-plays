type Context = {
  postData: (data: string) => Promise<void>;
};

// shorter
export const shorter = ({ postData }: Context) => {
  let p = Promise.resolve();

  return async (data: string) => {
    p = p.then(() => postData(data));
    await p;
  };
};

// Amazing

export default ({ postData }: Context) => {
  let p = Promise.resolve();
  const task = async (d: string) => {
    await p;
    await postData(d);
  };

  return async (data: string) => {
    p = task(data);
    await p;
  };
};
