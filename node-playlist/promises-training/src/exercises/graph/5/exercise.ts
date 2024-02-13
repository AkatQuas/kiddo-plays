import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    await createPromise("A");
    const f = async (a: string, b: string) => {
      await createPromise(a);
      await createPromise(b);
    };
    await Promise.all([f("B", "D"), f("C", "E")]);
    await createPromise("F");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    return createPromise("A")
      .then(() =>
        Promise.all([
          createPromise("B").then(() => createPromise("D")),
          createPromise("C").then(() => createPromise("E")),
        ])
      )
      .then(() => createPromise("F"));
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
