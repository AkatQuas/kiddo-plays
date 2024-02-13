import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const f1 = async () => {
      await Promise.all([createPromise("B"), createPromise("C")]);
      await createPromise("E");
    };

    await createPromise("A");
    await Promise.all([createPromise("D"), f1()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    return createPromise("A").then(() =>
      Promise.all([
        createPromise("D"),
        Promise.all([createPromise("B"), createPromise("C")]).then(() =>
          createPromise("E")
        ),
      ])
    );
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
