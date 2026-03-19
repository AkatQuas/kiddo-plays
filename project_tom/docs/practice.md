# Intensity Segments

## Guidelines

In this practice, you're supposed to come up with an algorithm to solve the problem as described below. The problem itself is quite simple to solve. The main purpose of this practice is mainly to looking for in this test (besides that the solution should work) is, how well you actually organize the code, how you write production-quality code in a team setting where multiple developers will be collaborating on the codebase.

Simplicity, cleanness, readability and maintenance!

Things like code organization, readability, documentation, testing and deliverability are most important here.

## Problem Set

A library that manages “intensity” by segments.

Segments are intervals from `-infinity` to `infinity`, please implement functions that updates intensity by an integer amount for a given range.

All intensity starts with 0.

Please implement these three functions:

```js
export class IntensitySegments {
  add(from, to, amount) {
    // TODO: implement this
  }
  set(from, to, amount) {
    // TODO: implement this
  }
  toString() {
    // TODO: implement this
  }
}
```

Here is an example sequence:

```js
const segments = new IntensitySegments();
// (data stored as an array of start point and value for each segment.) const segments = new IntensitySegments();
segments.toString(); // Should be "[]"
segments.add(10, 30, 1);
segments.toString(); // Should be: "[[10,1],[30,0]]"
segments.add(20, 40, 1);
segments.toString(); // Should be: "[[10,1],[20,2],[30,1],[40,0]]"
segments.add(10, 40, -2);
segments.toString(); // Should be: "[[10,-1],[20,0],[30,-1],[40,0]]"
```

Another example sequence:

```js
const segments = new IntensitySegments();
segments.toString(); // Should be "[]"
segments.add(10, 30, 1);
segments.toString(); // Should be "[[10,1],[30,0]]"
segments.add(20, 40, 1);
segments.toString(); // Should be "[[10,1],[20,2],[30,1],[40,0]]"
segments.add(10, 40, -1);
segments.toString(); // Should be "[[20,1],[30,0]]"
segments.add(10, 40, -1);
segments.toString(); // Should be "[[10,-1],[20,0],[30,-1],[40,0]]"
```
