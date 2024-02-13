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
    const f = async (m: "all" | "any", end: string) => {
      const payload = [a, b];
      await (m === "all" ? Promise.all(payload) : Promise.any(payload));
      await createPromise(end);
    };

    await Promise.all([f("all", "D"), f("any", "C"), f("any", "E")]);
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const a = createPromise("A");
    const b = createPromise("B");
    return Promise.all([
      Promise.any([a, b]).then(() => createPromise("C")),
      Promise.all([a, b]).then(() => createPromise("D")),
      Promise.any([a, b]).then(() => createPromise("E")),
    ]);
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
