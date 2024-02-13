import { ExerciseContext } from "../../../lib/Exercise.js";
import { promiseSettled } from "../../../lib/promiseResult.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    try {
      await createPromise("A");
    } catch (error) {
      return;
    }
    const job2 = createPromise("B");
    const job3 = createPromise("C");

    const jobE = async () => {
      try {
        await Promise.all([job2, job3]);
      } catch (error) {
        return await createPromise("E");
      }
    };

    const job4 = async (previousJob: Promise<any>, job: string) => {
      await previousJob;
      await createPromise(job);
    };

    await job4(Promise.all([job4(job2, "D"), jobE(), job4(job3, "F")]), "G");
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const pA = promiseSettled(createPromise("A"));
    return pA.then((rA) => {
      if (rA.status === "rejected") {
        return;
      }

      const job = (before: Promise<any>, t: string) =>
        before.then(() => createPromise(t));

      const pB = createPromise("B");
      const pC = createPromise("C");
      const e = Promise.all([pB, pC]).catch(() => createPromise("E"));
      const d = job(pB, "D");
      const f = job(pC, "F");
      return Promise.all([e, job(Promise.all([d, f]), "G")]);
    });
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
