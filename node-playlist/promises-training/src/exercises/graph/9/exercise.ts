import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const b = createPromise("B");
    const c = createPromise("C");
    const d = (async () => {
      await createPromise("A");
      await createPromise("D");
    })();

    const e = async () => {
      await b;
      await createPromise("E");
    };

    const f = async () => {
      await d;
      await createPromise("F");
    };

    const g = async () => {
      await Promise.all([f(), e(), c]);

      await createPromise("G");
    };

    const h = async () => {
      await Promise.all([b, c, d]);
      await createPromise("H");
    };

    await Promise.all([g(), h()]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  () => {
    const b = createPromise("B");
    const c = createPromise("C");
    const d = createPromise("A").then(() => createPromise("D"));

    const e = b.then(() => createPromise("E"));

    return Promise.all([
      Promise.all([d, b, c]).then(() => createPromise("H")),
      Promise.all([c, e, d.then(() => createPromise("F"))]).then(() =>
        createPromise("G")
      ),
    ]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
