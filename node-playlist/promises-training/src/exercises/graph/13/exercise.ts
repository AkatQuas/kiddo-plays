import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const s1 = async (x: string, y?: string) => {
      await createPromise(x);
      if (y) {
        await createPromise(y);
      }
    };

    const d = s1("A", "D");
    const g = async (x: string, y: string) => {
      await Promise.any([d, Promise.all([s1("B"), s1("C", "E")])]);
      await createPromise(x);
      await createPromise(y);
    };
    await Promise.all([d, g("F", "G")]);
    await createPromise("H");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const d = createPromise("A").then(() => createPromise("D"));
    const e = createPromise("C").then(() => createPromise("E"));
    const b = createPromise("B");

    return Promise.all([
      d,
      Promise.any([d, Promise.all([b, e])])
        .then(() => createPromise("F"))
        .then(() => createPromise("G")),
    ]).then(() => createPromise("H"));
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
