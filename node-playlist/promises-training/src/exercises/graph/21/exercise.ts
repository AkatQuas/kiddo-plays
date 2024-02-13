import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const pA = createPromise("A");
    const pB = createPromise("B");

    const job = async (j: string) => {
      try {
        await Promise.all([pA, pB]);
      } catch (error) {
        return createPromise(j);
      }
    };
    async function jobE() {
      const [_, c] = await Promise.all([pA, job("C")]);
      if (c === "C") {
        await createPromise("E");
      }
    }
    await Promise.all([job("D"), jobE()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const pA = createPromise("A");
    const pB = createPromise("B");
    const job = (j: string) =>
      Promise.all([pA, pB]).catch(() => createPromise(j));
    const jobE = () =>
      Promise.all([pA, job("C")]).then(([_, c]) =>
        c === "C" ? createPromise("E") : undefined
      );
    return Promise.all([job("D"), jobE()]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
