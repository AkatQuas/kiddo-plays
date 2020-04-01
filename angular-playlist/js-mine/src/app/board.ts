import { Cell, neighborIds } from './cell';

function minePosition(total: number, amount: number) {
  if (amount >= total) {
    throw new ReferenceError(`Cannot place ${amount} mines in ${total} cells!`);
  }
  const pos = new Array(total).fill(false);
  for (let ii = 0; ii < amount;) {
    const p = ~~(Math.random() * total);
    if (pos[p] === true) {
      continue;
    } else {
      pos[p] = true;
      ii += 1;
    }
  }
  return pos;
}

export class Board {
  width: number;
  height: number;
  cells: Map<string, Cell>;
  minesAmount: number;

  constructor(width: number, height: number, minesAmount: number) {
    this.minesAmount = minesAmount;
    this.width = width;
    this.height = height;
    this.initCells();
  }

  initCells() {
    const { width, height, minesAmount } = this;
    const pos = minePosition(width * height, minesAmount);
    const cells = new Map();
    let pi = 0;
    for (let wi = 0; wi < width; wi += 1) {
      for (let hi = 0; hi < height; hi += 1) {
        const cell = new Cell(wi, hi, pos[pi]);
        cells.set(cell.id, cell);
        pi += 1;
      }
    }
    this.cells = cells;
    this.calculateNeighbors();
  }

  calculateNeighbors() {
    const { cells } = this;
    for (let pair of cells) {
      const cell = pair[1];
      if (cell.mined || cell.neighbors !== null) {
        continue;
      }
      cell.neighbors = neighborIds(cell.row, cell.col)
        .reduce((acc, id) => {
          if (cells.has(id)) {
            acc += (cells.get(id).mined ? 1 : 0);
          }
          return acc;
        }, 0);
    }
  }

  destroy() {
    if (this.cells) {
      this.cells.clear();
    }

    delete this.minesAmount;
    delete this.width;
    delete this.height;
    delete this.cells;
  }
}
