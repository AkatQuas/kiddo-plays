import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const f1 = async () => {
      await createPromise("A");
      await createPromise("B");
      await createPromise("C");
    };
    const f2 = async () => {
      await createPromise("D");
      await createPromise("E");
      await createPromise("F");
    };

    await Promise.all([f1(), f2()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const f1 = createPromise("A")
      .then(() => createPromise("B"))
      .then(() => createPromise("C"));
    const f2 = createPromise("D")
      .then(() => createPromise("E"))
      .then(() => createPromise("F"));

    return Promise.all([f1, f2]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
