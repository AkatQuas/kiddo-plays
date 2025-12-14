/**
 * https://leetcode.com/problems/number-of-students-unable-to-eat-lunch
 */

// because the queue loop, as long as there is someone in favor, the sandwich is eaten.
// when the top sandwich loses preference, the process got stuck
//
// calculate the eaten
function countStudents(students: number[], sandwiches: number[]): number {
  let eaten = 0;
  let total = students.length;
  let i = 0;
  while (true) {
    const x = sandwiches[i];
    const you = students.indexOf(x);
    if (you === -1) {
      break;
    }
    students.splice(you, 1);
    eaten += 1;
    i += 1;
  }
  return total - eaten;
}
