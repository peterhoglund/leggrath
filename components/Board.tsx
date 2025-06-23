
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
  northThroneCoord: Coordinate;
  southThroneCoord: Coordinate;
  portalACoord: Coordinate;
  portalBCoord: Coordinate;
  isCheckerboardPattern: boolean;
  isPortalModeActive: boolean;
  isInteractionDisabled?: boolean;
  currentPlayer: Player; // For determining draggable pieces
  gamePhase: GamePhase; // For determining draggable pieces
  onPieceDragStart: (piece: PieceOnBoard, event: React.DragEvent) => void;
  onPieceDragEnd: (event: React.DragEvent) => void;
  onPieceDropOnSquare: (row: number, col: number, event: React.DragEvent) => void;
}

const Board: React.FC<BoardProps> = ({
  board,
  onSquareClick,
  selectedPiece,
  validMoves,
  playerColors,
  pieceSymbols,
  northThroneCoord,
  southThroneCoord,
  portalACoord,
  portalBCoord,
  isCheckerboardPattern,
  isPortalModeActive,
  isInteractionDisabled = false,
  currentPlayer,
  gamePhase,
  onPieceDragStart,
  onPieceDragEnd,
  onPieceDropOnSquare,
}) => {
  const isHighlighted = (row: number, col: number): boolean => {
    if (isInteractionDisabled && selectedPiece?.player !== currentPlayer) return false; // Don't show opponent's highlights
    return validMoves.some(move => move.to.row === row && move.to.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    if (isInteractionDisabled && selectedPiece?.player !== currentPlayer) return false;
    return !!selectedPiece && selectedPiece.row === row && selectedPiece.col === col;
  };

  const isPieceDraggable = (piece: PieceOnBoard | null): boolean => {
    if (!piece || isInteractionDisabled || gamePhase === GamePhase.GAME_OVER) {
      return false;
    }
    return piece.player === currentPlayer;
  };
  
  // Determine if a square is a potential drop target for the currently selected/dragged piece
  const isPotentialDropTarget = (row: number, col: number): boolean => {
    if (!selectedPiece || isInteractionDisabled) return false;
    return validMoves.some(move => 
      move.from.row === selectedPiece.row &&
      move.from.col === selectedPiece.col &&
      move.to.row === row && 
      move.to.col === col
    );
  };

  return (
    <div className={`grid grid-cols-7 gap-0.5 bg-black border-4 border-black shadow-xl p-2 rounded ${isInteractionDisabled && selectedPiece?.player !== currentPlayer ? 'cursor-not-allowed opacity-75' : ''}`}>
      {board.map((rowData, rowIndex) =>
        rowData.squares.map((piece, colIndex) => (
          <SquareCell
            key={`${rowIndex}-${colIndex}`}
            piece={piece}
            onClick={() => {
              if (!isInteractionDisabled) {
                onSquareClick(rowIndex, colIndex);
              }
            }}
            isHighlighted={isHighlighted(rowIndex, colIndex)}
            isSelected={isSelected(rowIndex, colIndex)}
            isNorthThrone={northThroneCoord.row === rowIndex && northThroneCoord.col === colIndex}
            isSouthThrone={southThroneCoord.row === rowIndex && southThroneCoord.col === colIndex}
            isPortalA={isPortalModeActive && portalACoord.row === rowIndex && portalACoord.col === colIndex}
            isPortalB={isPortalModeActive && portalBCoord.row === rowIndex && portalBCoord.col === colIndex}
            playerColors={playerColors}
            pieceSymbols={pieceSymbols}
            row={rowIndex}
            col={colIndex}
            isCheckerboardPattern={isCheckerboardPattern}
            isPortalModeActive={isPortalModeActive}
            isDisabled={isInteractionDisabled && (!selectedPiece || piece?.player !== currentPlayer)} // More refined disabled logic
            // Drag and drop related props
            isPieceDraggable={isPieceDraggable(piece)}
            onPieceDragStart={onPieceDragStart}
            onPieceDragEnd={onPieceDragEnd}
            onPieceDropOnSquare={onPieceDropOnSquare}
            isPotentialDropTarget={isPotentialDropTarget(rowIndex, colIndex)}
            selectedPiece={selectedPiece}
          />
        ))
      )}
    </div>
  );
};

export default Board;
