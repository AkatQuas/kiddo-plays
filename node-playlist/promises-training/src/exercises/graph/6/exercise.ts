import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    await createPromise("A");
    const c = createPromise("C");
    const f = async (side: string, end: string) => {
      await Promise.all([c, createPromise(side)]);
      await createPromise(end);
    };

    await Promise.all([f("B", "E"), f("D", "F")]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    return createPromise("A").then(() => {
      const c = createPromise("C");
      const e = Promise.all([createPromise("B"), c]).then(() =>
        createPromise("E")
      );
      const f = Promise.all([c, createPromise("D")]).then(() =>
        createPromise("F")
      );
      return Promise.all([e, f]);
    });
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
