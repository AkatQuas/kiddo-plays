import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");

    const s1 = async (s: string) => {
      await a;
      return createPromise(s);
    };
    const b = s1("B");

    const s2 = async () => {
      await Promise.any([b, s1("C")]);
      await createPromise("D");
    };

    const d = s2();

    const g = async () => {
      await d;
      await createPromise("G");
    };
    const f = async () => {
      await Promise.all([b, d]);
      await createPromise("F");
    };

    await Promise.any([createPromise("E"), f(), g()]);

    await createPromise("H");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = a.then(() => createPromise("B"));
    const d = Promise.any([b, a.then(() => createPromise("C"))]).then(() =>
      createPromise("D")
    );

    return Promise.any([
      createPromise("E"),
      d.then(() => createPromise("G")),
      Promise.all([b, d]).then(() => createPromise("F")),
    ]).then(() => createPromise("H"));
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
