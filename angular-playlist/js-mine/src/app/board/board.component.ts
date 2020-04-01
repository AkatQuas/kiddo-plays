import { Component, OnInit } from '@angular/core';
import { Board } from '../board';
import { Cell, crossNeighborIds } from '../cell';
import { ToastaService, ToastaConfig } from 'ngx-toasta';

enum GameState {
  READY,
  GOING,
  OVER,
  WIN,
}

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.less']
})
export class BoardComponent implements OnInit {
  board: Board;
  width: number = 20;
  height: number = 20;
  mines: number = 50;
  emptyCell: number;
  score: number;
  cells: Array<Cell>;
  myContext = { $implicit: 'World', localSk: 'Svet' };
  state: GameState;


  constructor(
    private toastaService: ToastaService,
    private toastaConfig: ToastaConfig,
  ) {
    this.toastaConfig.theme = 'default';
    this.toastaConfig.position = 'top-center';
    this.toastaConfig.showClose = false;
    this.toastaConfig.timeout = 1500;
  }

  ngOnInit() {
    this.prepareBoard();
  }

  prepareBoard() {
    if (this.board) {
      this.board.destroy();
    }
    const { width, height, mines } = this;
    const board = new Board(width, height, mines);
    this.cells = [...board.cells.values()];
    this.board = board;
    this.emptyCell = width * height - mines;
    this.score = 0;
    this.state = GameState.READY;
    this.tickReady();
  }

  tickReady() {
    setTimeout(() => {
      this.state = GameState.GOING;
      this.toastaService.info('Game started!');
    }, 500);
  }

  cellClick(cell: Cell) {
    if (cell.open) {
      return;
    }
    if (this.state === GameState.OVER || this.state === GameState.WIN) {
      this.toastaService.info('Game is End, you can start a new game!');
      return;
    }
    if (this.state !== GameState.GOING) {
      alert('Game not ready!')
      return;
    }
    cell.open = true;
    if (cell.mined) {
      this.state = GameState.OVER;
      this.toastaService.error('BOOOOOM! You can restart the game!')
      return;
    } else {
      this.score += 1;
      if (cell.neighbors === 0) {
        this.quickOpen(cell);
      }
      if (this.score === this.emptyCell) {
        this.toastaService.success('You Win');
        this.state = GameState.WIN;
      }
    }
  }

  quickOpen(cell: Cell) {
    const { cells } = this.board;
    const cross = crossNeighborIds(cell.row, cell.col);
    cross.forEach(id => {
      if (!cells.has(id)) {
        return;
      }
      const neighbor = cells.get(id);
      if (neighbor.open) {
        return;
      }
      if (!neighbor.mined) {
        neighbor.open = true;
        this.score += 1;
      }
      if (neighbor.neighbors === 0) {
        this.quickOpen(neighbor);
      }
    });
  }

}
