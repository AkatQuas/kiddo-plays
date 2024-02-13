type Context = {
  fetchData: (input: string) => Promise<string>;
  setData: (data: string) => void;
};

export default ({ fetchData, setData }: Context) => {
  let running = false;
  return async (input: string) => {
    if (running) {
      return;
    }

    running = true;

    setData(await fetchData(input));

    running = false;
  };
};
