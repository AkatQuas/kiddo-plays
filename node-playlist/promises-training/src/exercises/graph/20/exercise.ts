import { ExerciseContext } from "../../../lib/Exercise.js";
import { promiseResult, promiseSettled } from "../../../lib/promiseResult.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const check1 = async () => {
      const r = await promiseResult(createPromise("A"));
      switch (r.status) {
        case "fulfilled":
          return createPromise("B");
        case "rejected":
          return createPromise("C");
      }
    };

    const check2 = async () => {
      const r = await promiseResult(check1());
      if (r.status === "fulfilled" && r.value === "B") {
        return createPromise("D");
      }

      if (r.status === "rejected" && r.reason === "C") {
        return createPromise("E");
      }
    };

    const r = await promiseResult(check2());

    if (
      (r.status === "fulfilled" && r.value == "E") ||
      (r.status === "rejected" && r.reason === "D")
    ) {
      await createPromise("F");
    }
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    const check1 = () => {
      return promiseSettled(createPromise("A")).then((r) => {
        switch (r.status) {
          case "fulfilled":
            return createPromise("B");

          case "rejected":
            return createPromise("C");
        }
      });
    };

    const check2 = () => {
      return promiseSettled(check1()).then((r) => {
        if (r.status === "fulfilled" && r.value === "B") {
          return createPromise("D");
        }
        if (r.status === "rejected" && r.reason === "C") {
          return createPromise("E");
        }
      });
    };
    return promiseSettled(check2()).then((r) => {
      if (
        (r.status === "fulfilled" && r.value == "E") ||
        (r.status === "rejected" && r.reason === "D")
      ) {
        return createPromise("F");
      }
    });
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
