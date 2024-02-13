type Context = {
  firstStep: (data: string) => Promise<string>;
  secondStep: (data: string) => Promise<string>;
  thirdStep: (data: string) => Promise<string>;
};

export default ({ firstStep, secondStep, thirdStep }: Context) =>
  async (list: Array<string>) => {
    const job = async (data: string) => {
      const r1 = await firstStep(data);
      const r2 = await secondStep(r1);
      return await thirdStep(r2);
    };

    return Promise.all(list.map((d) => job(d)));
  };
