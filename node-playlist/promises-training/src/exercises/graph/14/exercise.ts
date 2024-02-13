import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const e = async () => {
      await Promise.all([createPromise("A"), createPromise("B")]);
      await createPromise("E");
    };

    const c = createPromise("C");
    const d = createPromise("D");

    const f = async () => {
      await c;
      await createPromise("F");
    };

    const g = async () => {
      await Promise.any([c, d]);
      await createPromise("G");
    };

    await Promise.any([e(), Promise.all([f(), g()])]);

    await createPromise("H");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const c = createPromise("C");
    const d = createPromise("D");

    return Promise.any([
      Promise.all([createPromise("A"), createPromise("B")]).then(() =>
        createPromise("E")
      ),
      Promise.all([
        c.then(() => createPromise("F")),
        Promise.any([c, d]).then(() => createPromise("G")),
      ]),
    ]).then(() => createPromise("H"));
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
