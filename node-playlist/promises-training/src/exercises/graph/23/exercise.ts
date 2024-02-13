import { ExerciseContext } from "../../../lib/Exercise.js";
import { skipExercise } from "../../../lib/skipExercise.js";

const mixed =
  ({ createPromise }: ExerciseContext) =>
  async () => {};

const asyncAwait =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    // AT "2023/12/31 12:44"
    // TODO FIXME ¯\_(°ペ)_/¯
    //
  };

const thenCatch =
  ({ createPromise }: ExerciseContext) =>
  async () => {
    // AT "2023/12/31 12:44"
    // TODO FIXME ¯\_(°ペ)_/¯
    //
  };

export default {
  makeMixedExercise: skipExercise(mixed),
  makeAsyncAwaitExercise: skipExercise(asyncAwait),
  makeThenCatchExercise: skipExercise(thenCatch),
};
