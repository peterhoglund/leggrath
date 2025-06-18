import React from 'react';
import { BoardState, PieceOnBoard, Move, Coordinate, Player, PieceType } from '../types';
import SquareCell from './SquareCell'; 
import { PIECE_COLORS, PIECE_SYMBOLS } from '../constants'; 

interface BoardProps {
  board: BoardState; // BoardState is now RowData[]
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
}) => {
  const isHighlighted = (row: number, col: number): boolean => {
    return validMoves.some(move => move.to.row === row && move.to.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    return !!selectedPiece && selectedPiece.row === row && selectedPiece.col === col;
  };
  
  return (
    <div className={`grid grid-cols-7 gap-0.5 bg-black border-4 border-black shadow-xl p-2 rounded ${isInteractionDisabled ? 'cursor-not-allowed opacity-75' : ''}`}>
      {/* Iterate over board (array of RowData) and then over rowData.squares */}
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
            isDisabled={isInteractionDisabled}
          />
        ))
      )}
    </div>
  );
};

export default Board;