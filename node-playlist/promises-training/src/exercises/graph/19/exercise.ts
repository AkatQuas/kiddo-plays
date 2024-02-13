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
      try {
        await createPromise("C");
      } catch (error) {}
      await createPromise("D");
      return;
    }

    await createPromise("B");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");

    const b = a.then(() => createPromise("B"));
    const c = a
      .catch(() => createPromise("C"))
      .then((r) => {
        // the result from a.then will flow to here
        if (r === "C") {
          return createPromise("D");
        }
      })
      .catch(() => {
        return createPromise("D");
      });

    return Promise.all([b, c]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
