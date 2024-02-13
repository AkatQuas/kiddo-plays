import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = createPromise("B");
    const f1 = async () => {
      await Promise.all([a, b]);
      await createPromise("D");
    };
    const f2 = async () => {
      await a;
      await createPromise("C");
    };

    const f3 = async () => {
      await Promise.all([b, f2()]);
      await createPromise("E");
    };

    await Promise.all([f1(), f3()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = createPromise("B");
    return Promise.all([
      Promise.all([a.then(() => createPromise("C")), b]).then(() =>
        createPromise("E")
      ),
      Promise.all([a, b]).then(() => createPromise("D")),
    ]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
