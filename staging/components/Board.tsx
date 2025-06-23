
import React from 'react';
import { BoardState, PieceOnBoard, Move, Coordinate, Player, PieceType, GamePhase } from '../types';
import SquareCell from './SquareCell';
import { PIECE_COLORS, PIECE_SYMBOLS } from '../constants';

interface BoardProps {
  board: BoardState;
  onSquareClick: (row: number, col: number) => void;
  selectedPiece: PieceOnBoard | null;
  validMoves: Move[];
  playerColors: typeof PIECE_COLORS;
  pieceSymbols: typeof PIECE_SYMBOLS;
  centralThroneCoord: Coordinate; 
  isCheckerboardPattern: boolean;
  isInteractionDisabled?: boolean;
  currentPlayer: Player; 
  gamePhase: GamePhase; 
  onPieceDragStart: (piece: PieceOnBoard, event: React.DragEvent) => void;
  onPieceDragEnd: (event: React.DragEvent) => void;
  onPieceDropOnSquare: (row: number, col: number, event: React.DragEvent) => void;
  boardRows: number; 
  boardCols: number; 
  isReinforcementMode: boolean; // New prop
}

const Board: React.FC<BoardProps> = ({
  board,
  onSquareClick,
  selectedPiece,
  validMoves,
  playerColors,
  pieceSymbols,
  centralThroneCoord, 
  isCheckerboardPattern,
  isInteractionDisabled = false,
  currentPlayer,
  gamePhase,
  onPieceDragStart,
  onPieceDragEnd,
  onPieceDropOnSquare,
  boardRows, 
  boardCols, 
  isReinforcementMode,
}) => {
  const isHighlighted = (row: number, col: number): boolean => {
    if (isReinforcementMode) { // During reinforcement, highlight all empty squares
        return !board[row].squares[col];
    }
    if (isInteractionDisabled && selectedPiece?.player !== currentPlayer) return false;
    return validMoves.some(move => move.to.row === row && move.to.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    if (isReinforcementMode) return false; // No piece selection during reinforcement placement
    if (isInteractionDisabled && selectedPiece?.player !== currentPlayer) return false;
    return !!selectedPiece && selectedPiece.row === row && selectedPiece.col === col;
  };

  const isPieceDraggable = (piece: PieceOnBoard | null): boolean => {
    if (!piece || isInteractionDisabled || gamePhase === GamePhase.GAME_OVER || isReinforcementMode) {
      return false;
    }
    return piece.player === currentPlayer;
  };
  
  const isPotentialDropTarget = (row: number, col: number): boolean => {
    if (isReinforcementMode) return false; // Drag-drop not used for reinforcement
    if (!selectedPiece || isInteractionDisabled) return false;
    return validMoves.some(move => 
      move.from.row === selectedPiece.row &&
      move.from.col === selectedPiece.col &&
      move.to.row === row && 
      move.to.col === col
    );
  };

  const gridColsClass = `grid-cols-${boardCols}`; 

  return (
    <div className={`grid ${gridColsClass} gap-0.5 bg-black border-4 border-black shadow-xl p-2 rounded ${isInteractionDisabled && selectedPiece?.player !== currentPlayer && !isReinforcementMode ? 'cursor-not-allowed opacity-75' : ''}`}>
      {board.map((rowData, rowIndex) =>
        rowData.squares.map((piece, colIndex) => (
          <SquareCell
            key={`${rowIndex}-${colIndex}`}
            piece={piece}
            onClick={() => {
              if (!isInteractionDisabled || isReinforcementMode) { // Allow click for reinforcement
                onSquareClick(rowIndex, colIndex);
              }
            }}
            isHighlighted={isHighlighted(rowIndex, colIndex)}
            isSelected={isSelected(rowIndex, colIndex)}
            isCentralThrone={centralThroneCoord.row === rowIndex && centralThroneCoord.col === colIndex} 
            playerColors={playerColors}
            pieceSymbols={pieceSymbols}
            row={rowIndex}
            col={colIndex}
            isCheckerboardPattern={isCheckerboardPattern}
            isDisabled={isInteractionDisabled && (!selectedPiece || piece?.player !== currentPlayer) && !isReinforcementMode}
            isPieceDraggable={isPieceDraggable(piece)}
            onPieceDragStart={onPieceDragStart}
            onPieceDragEnd={onPieceDragEnd}
            onPieceDropOnSquare={onPieceDropOnSquare}
            isPotentialDropTarget={isPotentialDropTarget(rowIndex, colIndex)}
            selectedPiece={selectedPiece}
            boardRows={boardRows}
            boardCols={boardCols} // Pass boardCols
            isReinforcementMode={isReinforcementMode} // Pass to SquareCell
          />
        ))
      )}
    </div>
  );
};

export default Board;