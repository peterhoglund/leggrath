
import {
  BoardState,
  PieceOnBoard,
  Player,
  PieceType,
  Coordinate,
  Move,
  SquareState,
  RowData,
} from '../types';

let pieceIdCounter = 0;

export function getInitialBoard(
  setup: { player: Player; type: PieceType; coords: Coordinate[] }[],
  boardRows: number,
  boardCols: number
): BoardState {
  pieceIdCounter = 0; 
  const board: BoardState = Array(boardRows)
    .fill(null)
    .map(() => ({ squares: Array(boardCols).fill(null) } as RowData));

  setup.forEach(playerSetup => {
    playerSetup.coords.forEach(coord => {
      if (coord.row < boardRows && coord.col < boardCols) {
        board[coord.row].squares[coord.col] = {
          id: `p${pieceIdCounter++}`,
          player: playerSetup.player,
          type: playerSetup.type,
          row: coord.row,
          col: coord.col,
        };
      } else {
        console.warn(`Skipping piece setup at invalid coordinate for ${boardRows}x${boardCols} board: R${coord.row},C${coord.col}`);
      }
    });
  });
  return board;
}

export function isCoordinateValid(row: number, col: number, boardRows: number, boardCols: number): boolean {
  return row >= 0 && row < boardRows && col >= 0 && col < boardCols;
}

export function isCoordinateEqual(c1: Coordinate, c2: Coordinate): boolean {
  return c1.row === c2.row && c1.col === c2.col;
}

function getPieceAt(board: BoardState, coord: Coordinate, boardRows: number, boardCols: number): SquareState {
  if (!isCoordinateValid(coord.row, coord.col, boardRows, boardCols)) return null;
  return board[coord.row].squares[coord.col];
}

// Generates raw moves based on piece type, without considering Jarl self-preservation.
function generateRawMovesBasedOnPieceType(
  piece: PieceOnBoard,
  board: BoardState,
  boardRows: number,
  boardCols: number
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
    const orthogonalDirections = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
    ];

    orthogonalDirections.forEach(offset => {
      const to = { row: row + offset.dr, col: col + offset.dc };
      if (isCoordinateValid(to.row, to.col, boardRows, boardCols)) {
        const targetSquare = board[to.row].squares[to.col];
        if (targetSquare && targetSquare.player !== player) { // Capture condition
          addMoveIfValid(to);
        } else if (!targetSquare) { // Move to empty square condition
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
      if (isCoordinateValid(to.row, to.col, boardRows, boardCols)) {
        const targetSquare = board[to.row].squares[to.col];
        if (!targetSquare || targetSquare.player !== player) {
          addMoveIfValid(to);
        }
      }
    });
  } else if (type === PieceType.RAVEN) {
    const slideDirections = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },  
    ];
    slideDirections.forEach(dir => {
      for (let i = 1; i < Math.max(boardRows, boardCols); i++) {
        const to = { row: row + dir.dr * i, col: col + dir.dc * i };
        if (!isCoordinateValid(to.row, to.col, boardRows, boardCols)) break; 
        const targetSquare = board[to.row].squares[to.col];
        if (targetSquare) {
          if (targetSquare.player !== player) addMoveIfValid(to);
          break; 
        }
        addMoveIfValid(to);
      }
    });
    const jumpOffsets = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
    ];
    jumpOffsets.forEach(offset => {
      const pieceToJumpCoord = { row: row + offset.dr, col: col + offset.dc };
      const landCoord = { row: row + offset.dr * 2, col: col + offset.dc * 2 };
      if (isCoordinateValid(landCoord.row, landCoord.col, boardRows, boardCols) && !board[landCoord.row].squares[landCoord.col]) {
        const pieceToJump = getPieceAt(board, pieceToJumpCoord, boardRows, boardCols);
        if (pieceToJump) addMoveIfValid(landCoord, true, pieceToJumpCoord);
      }
    });
  } else if (type === PieceType.ROOK_RAVEN) {
    const slideDirections = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }, 
    ];
    slideDirections.forEach(dir => {
      for (let i = 1; i < Math.max(boardRows, boardCols); i++) {
        const to = { row: row + dir.dr * i, col: col + dir.dc * i };
        if (!isCoordinateValid(to.row, to.col, boardRows, boardCols)) break;
        const targetSquare = board[to.row].squares[to.col];
        if (targetSquare) {
          if (targetSquare.player !== player) addMoveIfValid(to); 
          break; 
        }
        addMoveIfValid(to); 
      }
    });
  }
  return moves;
}

// Simulates a move on a given board state and returns the new board state.
// Does not mutate the original board.
function simulateMove(originalBoard: BoardState, move: Move): BoardState {
  const newBoard = originalBoard.map(rowData => ({
    squares: rowData.squares.map(sq => sq ? { ...sq } : null) // Deep copy pieces
  }));
  const pieceToMove = newBoard[move.from.row].squares[move.from.col];
  if (pieceToMove) {
    newBoard[move.to.row].squares[move.to.col] = { ...pieceToMove, row: move.to.row, col: move.to.col };
    newBoard[move.from.row].squares[move.from.col] = null;
  }
  return newBoard;
}

// Checks if a given square is under attack by any piece of the attackingPlayer.
// Uses raw moves for attackers (doesn't consider if attacker's Jarl would be in check).
function isSquareUnderAttack(
  targetSquare: Coordinate,
  board: BoardState,
  attackingPlayer: Player,
  boardRows: number,
  boardCols: number
): boolean {
  for (let r = 0; r < boardRows; r++) {
    for (let c = 0; c < boardCols; c++) {
      const piece = board[r].squares[c];
      if (piece && piece.player === attackingPlayer) {
        const attackerRawMoves = generateRawMovesBasedOnPieceType(piece, board, boardRows, boardCols);
        if (attackerRawMoves.some(move => isCoordinateEqual(move.to, targetSquare))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function getAllValidMovesForPiece(
  piece: PieceOnBoard,
  board: BoardState,
  boardRows: number,
  boardCols: number,
  isSecureThroneRequired: boolean, 
  centralThroneCoord: Coordinate 
): Move[] {
  const rawMoves = generateRawMovesBasedOnPieceType(piece, board, boardRows, boardCols);

  if (piece.type !== PieceType.JARL) {
    return rawMoves;
  }

  // Jarl specific logic:
  // - Field safety: Jarl can always move into 'check' on non-Throne squares.
  // - Throne safety: Conditional based on isSecureThroneRequired.
  const legalMoves: Move[] = [];
  const opponent = piece.player === Player.SOUTH ? Player.NORTH : Player.SOUTH;

  for (const move of rawMoves) {
    const destinationIsThrone = isCoordinateEqual(move.to, centralThroneCoord);

    if (destinationIsThrone) {
      // Throne move:
      if (isSecureThroneRequired) {
        // If throne safety is required, check if throne is under attack
        // This check is performed on the current board state *before* the Jarl's potential move.
        if (!isSquareUnderAttack(move.to, board, opponent, boardRows, boardCols)) {
          legalMoves.push(move);
        }
      } else {
        // Throne safety is NOT required, Jarl can move to throne even if attacked.
        legalMoves.push(move);
      }
    } else {
      // Non-Throne square: Jarl can always move into 'check'. No filtering needed here based on safety.
      legalMoves.push(move);
    }
  }
  return legalMoves;
}
