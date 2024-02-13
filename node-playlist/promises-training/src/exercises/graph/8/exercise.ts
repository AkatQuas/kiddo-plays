import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const f = async (x: string, yz: string, w: string) => {
      await createPromise(x);
      await Promise.all(yz.split(",").map((i) => createPromise(i)));
      await createPromise(w);
    };

    await Promise.all([f("A", "B,C", "D"), f("E", "F,G", "H")]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const f = (x: string, yz: string, w: string) => {
      return createPromise(x)
        .then(() => Promise.all(yz.split(",").map((i) => createPromise(i))))
        .then(() => createPromise(w));
    };
    return Promise.all([f("A", "B,C", "D"), f("E", "F,G", "H")]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
