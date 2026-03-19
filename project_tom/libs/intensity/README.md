# Intensity Manager

This module manages **intensity** by segments.

The instance updates intensity by an integer amount for a given range.\
All intensity starts with _0_. Segments are intervals from `-Infinity` to `Infinity`.

## Example

1. Create an instance to manipulate intensity.

```typescript
import { IntensitySegments } from '@tom_ai/intensity';

const segments = new IntensitySegments();

segments.add(10, 30, 1);
segments.toString(); // Should be "[[10,1],[30,0]]"

segments.add(20, 40, 1);
segments.toString(); // Should be "[[10,1],[20,2],[30,1],[40,0]]"
```

2. Restore from breakpoints and manipulate intensity more.

```typescript
const segments = IntensitySegments.restore([
  [10, 1],
  [30, 0]
]);

segments.toString(); // Should be "[[10,1],[30,0]]"

segments.add(20, 40, 1);
segments.toString(); // Should be "[[10,1],[20,2],[30,1],[40,0]]"
```

## Development

Run the test in watch mode leveraging [VSCode Task Configurations](./.vscode/tasks.json).

Let's write some code at [src/index.mjs](./src/index.mjs) and [test/index.test.mjs](./test/index.test.mjs);

## Mathematic explanation

**Intensity** is just a name for a numeric value assigned to every point on the number line — think of it as a piecewise-constant function `I(x)` that can change value only at certain breakpoints (segment boundaries).

- Intensity is an integer value for each position `x` (everywhere initially _0_).
- `add(from, to, amount)` increases the intensity by amount for every `x` in `[from, to)` (include `from`, exclude `to`).
- `set(from, to, amount)` overwrites the intensity with amount for every `x` in `[from, to)`.

```bash
                ▲
                │
              2 ┼
                │
                │
              1 ┼ ─────────────
                │
                │
  ──────────────┼───────────────┼─────────┼─────────────►
-Infinity      0│               10        15
                │                                      Infinity
                │
            -1  ┼                      ────────
                │
```

The above code examples explained:

- After `add(10,30,1)`, `I(x)=1` for `10 ≤ x < 30`, and 0 elsewhere, so the breakpoints is `[[10,1],[30,0]]`.
- After `add(20,40,1)`, we have:\
   &nbsp;&nbsp;10 ≤ x < 20 → 1\
   &nbsp;&nbsp;20 ≤ x < 30 → 2\
   &nbsp;&nbsp;30 ≤ x < 40 → 1\
   &nbsp;&nbsp;else → 0\
   so the breakpoints becomes `[[10,1],[20,2],[30,1],[40,0]]`.
- After `add(5, 35, -2)`, we have:\
   &nbsp;&nbsp;5 ≤ x < 10 → -2\
   &nbsp;&nbsp;10 ≤ x < 20 → -1\
   &nbsp;&nbsp;20 ≤ x < 30 → 0\
   &nbsp;&nbsp;30 ≤ x < 35 → -1\
   &nbsp;&nbsp;35 ≤ x < 40 → 1\
   &nbsp;&nbsp;else → 0\
   so the breakpoints becomes `[[5,-2],[10,-1],[20,0],[30,-1],[35,1],[40,0]]`.

## Demystify Implementation

To represent the numeric value to every point on the number line, we take `[position, intensity]` to mark specific points.

- `position`: the starting point of the segment
- `intensity`: the intensity value across the segment

For a segments like the following,

| Segment Start | Segment End (exclusive) | Intensity Value | Representation |
| ------------- | ----------------------- | --------------- | -------------- |
| -Infinity     | 5                       | 0               | [-Infinity, 0] |
| 5             | 15                      | 1               | [5, 1]         |
| 15            | 30                      | 2               | [15, 2]        |
| 30            | 42                      | -2              | [30, -2]       |
| 42            | Infinity                | 0               | [42, 0]        |

So the saved pairs is

```typescript
const breakpoints = [
  // [-Infinity, 0], // the hidden pair
  [5, 1],
  [15, 2],
  [30, -2],
  [42, 0]
];
```

The instance would compress its breakpoints after each manipulation to maintain simplicity.
