type Context = {
  postData: (data: string) => Promise<string>;
  wait: (ms: number) => Promise<void>;
};

export default ({ postData, wait }: Context) =>
  async (data: string) => {
    async function job(t: number) {
      try {
        return await postData(data);
      } catch (error) {
        await wait(t);
        return job(t * 2);
      }
    }
    return job(200);
  };
