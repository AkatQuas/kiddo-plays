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
    const c = createPromise("C");
    const e = async () => {
      const d = async () => {
        await Promise.all([a, b]);
        await createPromise("D");
      };
      await Promise.any([d(), Promise.all([b, c])]);
      await createPromise("E");
    };

    const f = async () => {
      await Promise.all([b, c]);
      await createPromise("F");
    };
    const g = async () => {
      await Promise.any([b, Promise.all([a, c])]);
      await createPromise("G");
    };
    await Promise.all([e(), f(), g()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = createPromise("B");
    const c = createPromise("C");
    const e = Promise.any([
      Promise.all([a, b]).then(() => createPromise("D")),
      Promise.all([b, c]),
    ]).then(() => createPromise("E"));
    const f = Promise.all([b, c]).then(() => createPromise("F"));
    const g = Promise.any([b, Promise.all([a, c])]).then(() =>
      createPromise("G")
    );

    return Promise.all([e, f, g]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
