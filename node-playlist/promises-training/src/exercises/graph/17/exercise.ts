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
      await createPromise("B");
    } catch (error) {
      await createPromise("C");
      return;
    }
    await createPromise("D");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = a.then(() => createPromise("B"));
    const c = b.catch(() => createPromise("C"));
    const d = b.then(() => createPromise("D"));
    return Promise.all([c, d]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
