
import React, { useState } from 'react';
import { PieceOnBoard, Move, PieceType, Player } from '../types';
import PieceView from './PieceView';
import { PIECE_COLORS, PIECE_SYMBOLS } from '../constants'; 

interface SquareCellProps {
  piece: PieceOnBoard | null;
  onClick: () => void;
  isHighlighted: boolean;
  isSelected: boolean;
  isCentralThrone: boolean; 
  playerColors: typeof PIECE_COLORS;
  pieceSymbols: typeof PIECE_SYMBOLS;
  row: number;
  col: number;
  isCheckerboardPattern: boolean;
  isDisabled?: boolean;
  isPieceDraggable: boolean;
  onPieceDragStart: (piece: PieceOnBoard, event: React.DragEvent) => void;
  onPieceDragEnd: (event: React.DragEvent) => void;
  onPieceDropOnSquare: (row: number, col: number, event: React.DragEvent) => void;
  isPotentialDropTarget: boolean;
  selectedPiece: PieceOnBoard | null;
  boardRows: number; 
  boardCols: number; // Added boardCols
  isReinforcementMode: boolean; // Added isReinforcementMode
}

const SquareCell: React.FC<SquareCellProps> = ({
  piece,
  onClick,
  isHighlighted,
  isSelected,
  isCentralThrone, 
  playerColors,
  pieceSymbols,
  row,
  col,
  isCheckerboardPattern,
  isDisabled = false,
  isPieceDraggable,
  onPieceDragStart,
  onPieceDragEnd,
  onPieceDropOnSquare,
  isPotentialDropTarget,
  selectedPiece,
  boardRows, 
  boardCols,
  isReinforcementMode,
}) => {
  const [isBeingDraggedOver, setIsBeingDraggedOver] = useState(false);

  // Promotion zones are the first two and last two rows
  const isVisuallyAPromotionZone = row === 0 || row === 1 || row === (boardRows - 2) || row === (boardRows - 1);

  let determinedBgColor = 'bg-[#6B574E]'; // Default dark square
  if (isCheckerboardPattern && (row + col) % 2 === 0) {
    determinedBgColor = 'bg-[#5A4D46]'; // Default light square for checkerboard
  }

  let specialMarkingContent: React.ReactNode = null;
  let promotionZoneOverlay: React.ReactNode = null;
  let cellTitle = `Square ${String.fromCharCode(65+col)}${boardRows-row}`;
  let borderClasses = "border-transparent"; 

  if (isCentralThrone) { 
    determinedBgColor = 'bg-[#342620]'; // Darker for throne
    specialMarkingContent = <span className="text-2xl opacity-90 text-[#AE9D88] select-none">♦</span>;
    cellTitle = "Central Throne (Goal)";
  } else if (isVisuallyAPromotionZone) {
    promotionZoneOverlay = (
      <div className="absolute inset-0 w-full h-full bg-[#373737] opacity-25 pointer-events-none z-[5]"></div>
    );
    cellTitle = `Promotion Zone (${cellTitle})`;
  }

  if (isReinforcementMode && isHighlighted && !piece) { // isHighlighted means it's an empty square in this mode
    determinedBgColor = 'bg-[#6DA36D]'; // Specific highlight for reinforcement placement
    cellTitle = `Place reinforcement here (${cellTitle})`;
  } else if (isPotentialDropTarget && isBeingDraggedOver && !isDisabled && selectedPiece) {
    determinedBgColor = 'bg-[#7E9975]'; // Greenish for valid drop target (drag/drop)
  } else if (isHighlighted && !isDisabled && !isReinforcementMode) { // Normal move highlight
    determinedBgColor = 'bg-[#9D867C]'; 
  }
  
  if (isSelected && !isDisabled && (!selectedPiece || (piece && piece.id === selectedPiece.id)) && !isReinforcementMode) {
    if (!(isPotentialDropTarget && isBeingDraggedOver && selectedPiece && piece && selectedPiece.id !== piece.id)) {
        determinedBgColor = 'bg-[#846F65]'; 
    }
  }


  const handleDragEnter = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece || isReinforcementMode) return;
    e.preventDefault(); 
    e.stopPropagation();
    setIsBeingDraggedOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isDisabled || !selectedPiece || isReinforcementMode) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    e.stopPropagation();
    setIsBeingDraggedOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece || isReinforcementMode) {
        return; 
    }
    e.preventDefault(); 
    e.stopPropagation();
    if (!isBeingDraggedOver) setIsBeingDraggedOver(true); 
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece || isReinforcementMode) return;
    e.preventDefault();
    e.stopPropagation();
    onPieceDropOnSquare(row, col, e);
    setIsBeingDraggedOver(false);
  };

  const squareClasses = `
    w-[40px] h-[40px] md:w-[50px] md:h-[50px]
    flex items-center justify-center ${determinedBgColor}
    ${isDisabled && (!piece || (selectedPiece && piece.player !== selectedPiece.player)) && !isReinforcementMode ? 'cursor-not-allowed' : 'cursor-pointer'}
    transition-colors duration-150
    relative overflow-hidden
    ${borderClasses} 
  `;

  return (
    <div
      className={squareClasses}
      onClick={(!isDisabled || isReinforcementMode) ? onClick : undefined} // Allow click in reinforcement mode for placement
      title={cellTitle || undefined}
      aria-label={cellTitle || `Board square ${String.fromCharCode(65+col)}${boardRows-row}`}
      aria-disabled={isDisabled && !isReinforcementMode}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {specialMarkingContent && (
        <div className="absolute inset-0 flex items-center justify-center w-full h-full pointer-events-none z-0">
            {specialMarkingContent}
        </div>
      )}
      {promotionZoneOverlay}
      {piece && (
        <div className="relative z-10"> {/* Ensure piece is above special markings and overlay */}
          <PieceView
            type={piece.type}
            player={piece.player}
            colors={playerColors[piece.player]}
            symbol={pieceSymbols[piece.type]}
            isJarl={piece.type === PieceType.JARL}
            isDraggable={isPieceDraggable}
            onDragStart={(event) => onPieceDragStart(piece, event)}
            onDragEnd={onPieceDragEnd}
            pieceId={piece.id}
          />
        </div>
      )}
    </div>
  );
};

export default SquareCell;