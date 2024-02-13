import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    try {
      await createPromise("A");
    } catch (error) {
      await Promise.all([createPromise("C"), createPromise("D")]);
      await createPromise("E");
      return;
    }

    await createPromise("B");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = a.then(() => createPromise("B"));
    const e = a.catch(() =>
      Promise.all([createPromise("C"), createPromise("D")]).then(() =>
        createPromise("E")
      )
    );
    return Promise.any([b, e]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
