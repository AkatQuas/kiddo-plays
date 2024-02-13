import makeExercises from "../../../exercises/graph/17/exercise.js";
import { makeGraphExerciseTests } from "../../../lib/graphExercise/graphExerciseTests.js";

const graphExerciseTests = makeGraphExerciseTests(makeExercises);

await graphExerciseTests("17");
