type Context = {
  fetchFirstData: (input: string) => Promise<string>;
  fetchSecondData: (input: string) => Promise<string>;
  setData: (data: string) => void;
};

function generateID() {
  let u = "",
    i = 0;
  while (i++ < 36) {
    let c = "xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"[i - 1],
      r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    u += c == "-" || c == "4" ? c : v.toString(16);
  }
  return u;
}

export default ({ fetchFirstData, fetchSecondData, setData }: Context) => {
  const runIdRef: {
    current: string | undefined;
  } = { current: undefined };
  return async (input: string) => {
    const jobID = generateID();
    runIdRef.current = jobID;

    const inSameContext = () => {
      return runIdRef.current === jobID;
    };

    const r1 = await fetchFirstData(input);
    if (!inSameContext()) {
      return;
    }
    const r2 = await fetchSecondData(r1);
    if (!inSameContext()) {
      return;
    }
    setData(r2);
  };
};
