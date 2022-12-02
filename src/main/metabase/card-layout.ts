export type Rectangle = {
  row: number;
  col: number;
  sizeX: number;
  sizeY: number;
};

const ROW_WIDTH = 18;

function validateSize(sizeX: number, sizeY: number) {
  if (sizeX <= 0 || sizeX > ROW_WIDTH || sizeY <= 0) {
    throw new Error('Invalid rectangle size.');
  }
}

export class CardLayout {
  private readonly grid2d: boolean[] = [];
  private minRow = 0; // Tracks min starting point.

  /** Finds the next blank row to start a new section. */
  private findEmptyRow() {
    const { length } = this.grid2d;
    if (length === 0) {
      return 0;
    } else {
      const lastUsedRow = Math.floor(length / ROW_WIDTH);
      return lastUsedRow + 1;
    }
  }

  private rectangleIsEmpty(startRow: number, startCol: number, sizeX: number, sizeY: number) {
    for (let row = startRow; row < startRow + sizeY; row++) {
      for (let col = startCol; col < startCol + sizeX; col++) {
        if (this.grid2d[row * ROW_WIDTH + col]) {
          return false;
        }
      }
    }

    return true;
  }

  /** Finds the leftmost and topmost rectangle that fits the given size. */
  private findEmptyRectangle(sizeX: number, sizeY: number) {
    // Sanity checks.
    validateSize(sizeX, sizeY);

    for (let row = this.minRow; ; row++) {
      for (let col = 0; col <= ROW_WIDTH - sizeX; col++) {
        if (this.rectangleIsEmpty(row, col, sizeX, sizeY)) {
          return [row, col];
        }
      }
    }
  }

  private fillGrid(startRow: number, startCol: number, sizeX: number, sizeY: number) {
    // Sanity checks.
    validateSize(sizeX, sizeY);
    if (startRow < 0 || startCol < 0 || startCol + sizeX > ROW_WIDTH) {
      throw new Error('Invalid rectangle bounds.');
    }

    for (let row = startRow; row < startRow + sizeY; row++) {
      for (let col = startCol; col < startCol + sizeX; col++) {
        // Another sanity check.
        if (this.grid2d[row * ROW_WIDTH + col]) {
          throw new Error(`Grid point [${row}, ${col}] is already used.`);
        }

        this.grid2d[row * ROW_WIDTH + col] = true;
      }
    }
  }

  putSection(sizeY: number): Rectangle {
    const emptyRow = this.findEmptyRow();
    if (sizeY > 0) {
      this.fillGrid(emptyRow, 0, ROW_WIDTH, sizeY);
    }
    this.minRow = emptyRow + sizeY; // Cards will start from here.
    return { row: emptyRow, col: 0, sizeX: ROW_WIDTH, sizeY };
  }

  putCard(sizeX: number, sizeY: number): Rectangle {
    const [row, col] = this.findEmptyRectangle(sizeX, sizeY);
    this.fillGrid(row, col, sizeX, sizeY);
    return { row, col, sizeX, sizeY };
  }
}
