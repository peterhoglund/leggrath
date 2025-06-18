
import {
  BoardState,
  PieceOnBoard,
  Player,
  PieceType,
  Coordinate,
  Move,
  SquareState,
  RowData, // Import RowData
} from '../types';
import {
  BOARD_SIZE,
  PORTAL_A_COORD, 
  PORTAL_B_COORD
} from '../constants'; 

let pieceIdCounter = 0;

import { INITIAL_PIECES_SETUP } from '../constants';


export function getInitialBoard(
  setup: typeof INITIAL_PIECES_SETUP
): BoardState {
  pieceIdCounter = 0; 
  // Initialize board as an array of RowData objects
  const board: BoardState = Array(BOARD_SIZE)
    .fill(null)
    .map(() => ({ squares: Array(BOARD_SIZE).fill(null) } as RowData));

  setup.forEach(playerSetup => {
    playerSetup.coords.forEach(coord => {
      // Access squares array within the row object
      board[coord.row].squares[coord.col] = {
        id: `p${pieceIdCounter++}`,
        player: playerSetup.player,
        type: playerSetup.type,
        row: coord.row,
        col: coord.col,
      };
    });
  });
  return board;
}

export function isCoordinateValid(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function isCoordinateEqual(c1: Coordinate, c2: Coordinate): boolean {
  return c1.row === c2.row && c1.col === c2.col;
}

function getPieceAt(board: BoardState, coord: Coordinate): SquareState {
  if (!isCoordinateValid(coord.row, coord.col)) return null;
  // Access squares array within the row object
  return board[coord.row].squares[coord.col];
}

export function getAllValidMovesForPiece(
  piece: PieceOnBoard,
  board: BoardState,
  isPortalModeActive: boolean,
  portalACoord: Coordinate,
  portalBCoord: Coordinate
): Move[] {
  const moves: Move[] = [];
  const { row, col, type, player } = piece;

  const addMoveIfValid = (to: Coordinate, isJump: boolean = false, jumpedPieceCoord?: Coordinate) => {
    const moveToAdd: Move = { from: { row, col }, to };
    if (isJump) moveToAdd.isJump = true;
    if (jumpedPieceCoord) moveToAdd.jumpedPieceCoord = jumpedPieceCoord;
    moves.push(moveToAdd);
  };

  if (type === PieceType.HIRDMAN) {
    const offsets = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, 
      { dr: 0, dc: -1 }, { dr: 0, dc: 1 }, 
    ];
    offsets.forEach(offset => {
      const to = { row: row + offset.dr, col: col + offset.dc };
      if (isCoordinateValid(to.row, to.col)) {
        // Access squares array within the row object
        const targetSquare = board[to.row].squares[to.col];
        if (!targetSquare || targetSquare.player !== player) {
          addMoveIfValid(to);
        }
      }
    });
  } else if (type === PieceType.JARL) {
    const offsets = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }, 
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }, 
    ];
    offsets.forEach(offset => {
      const to = { row: row + offset.dr, col: col + offset.dc };
      if (isCoordinateValid(to.row, to.col)) {
        // Access squares array within the row object
        const targetSquare = board[to.row].squares[to.col];
        if (!targetSquare || targetSquare.player !== player) {
          addMoveIfValid(to);
        }
      }
    });
  } else if (type === PieceType.RAVEN) {
    const slideDirections = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, 
      { dr: 1, dc: -1 }, { dr: 1, dc: 1 },  
    ];

    slideDirections.forEach(dir => {
      for (let i = 1; i < BOARD_SIZE; i++) {
        const toRow = row + dir.dr * i;
        const toCol = col + dir.dc * i;
        const to = { row: toRow, col: toCol };

        if (!isCoordinateValid(toRow, toCol)) break; 

        // Access squares array within the row object
        const targetSquare = board[toRow].squares[toCol];
        if (targetSquare) {
          if (targetSquare.player !== player) {
            addMoveIfValid(to);
          }
          break; 
        }
        addMoveIfValid(to);
      }
    });

    const jumpOffsets = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
      { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
    ];

    jumpOffsets.forEach(offset => {
      const pieceToJumpCoord = { row: row + offset.dr, col: col + offset.dc };
      const landCoord = { row: row + offset.dr * 2, col: col + offset.dc * 2 };

      // Access squares array for landCoord
      if (isCoordinateValid(landCoord.row, landCoord.col) && !board[landCoord.row].squares[landCoord.col]) {
        const pieceToJump = getPieceAt(board, pieceToJumpCoord); // getPieceAt already handles the .squares access
        if (pieceToJump) {
          addMoveIfValid(landCoord, true, pieceToJumpCoord);
        }
      }
    });
  }

  if (isPortalModeActive) {
    let destinationPortalCoord: Coordinate | null = null;
    let currentPieceIsOnPortalA = isCoordinateEqual({row, col}, portalACoord);
    let currentPieceIsOnPortalB = isCoordinateEqual({row, col}, portalBCoord);

    if (currentPieceIsOnPortalA) {
      destinationPortalCoord = portalBCoord;
    } else if (currentPieceIsOnPortalB) {
      destinationPortalCoord = portalACoord;
    }

    if (destinationPortalCoord) {
      const pieceAtDestination = getPieceAt(board, destinationPortalCoord); // getPieceAt handles .squares
      if (!pieceAtDestination || pieceAtDestination.player !== player) {
        moves.push({
          from: { row, col },
          to: destinationPortalCoord,
          isTeleport: true,
        });
      }
    }
  }

  return moves;
}