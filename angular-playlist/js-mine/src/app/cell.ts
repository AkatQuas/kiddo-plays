export function cellIdGenerator(row: number, col: number): string {
  return row + '_' + col;
}
export function crossNeighborIds(row: number, col: number): string[] {
  return [
    [row - 1, col],
    [row, col - 1],
    [row, col + 1],
    [row + 1, col],
  ].map(pos => cellIdGenerator(pos[0], pos[1]));
}
export function neighborIds(row: number, col: number): string[] {
  return [
    [row - 1, col - 1],
    [row, col - 1],
    [row + 1, col - 1],
    [row - 1, col],
    [row + 1, col],
    [row - 1, col + 1],
    [row, col + 1],
    [row + 1, col + 1],
  ].map(pos => cellIdGenerator(pos[0], pos[1]));
}

export class Cell {
  id: string;
  row: number;
  col: number;
  mined: boolean;
  open: boolean;
  neighbors: number;

  constructor(row: number, col: number, mined: boolean) {
    this.id = cellIdGenerator(row, col);
    this.col = col;
    this.row = row;
    this.mined = mined;
    this.open = false;
    this.neighbors = null;
  }

}
