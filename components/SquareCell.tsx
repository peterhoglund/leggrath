
import React, { useState } from 'react';
import { PieceOnBoard, Move, PieceType, Player } from '../types';
import PieceView from './PieceView';
import { PIECE_COLORS, PIECE_SYMBOLS, PORTAL_A_COORD, PORTAL_B_COORD, BOARD_SIZE } from '../constants';

interface SquareCellProps {
  piece: PieceOnBoard | null;
  onClick: () => void;
  isHighlighted: boolean;
  isSelected: boolean;
  isNorthThrone: boolean;
  isSouthThrone: boolean;
  isPortalA: boolean;
  isPortalB: boolean;
  playerColors: typeof PIECE_COLORS;
  pieceSymbols: typeof PIECE_SYMBOLS;
  row: number;
  col: number;
  isCheckerboardPattern: boolean;
  isPortalModeActive: boolean;
  isDisabled?: boolean;
  // Drag and drop related props
  isPieceDraggable: boolean;
  onPieceDragStart: (piece: PieceOnBoard, event: React.DragEvent) => void;
  onPieceDragEnd: (event: React.DragEvent) => void;
  onPieceDropOnSquare: (row: number, col: number, event: React.DragEvent) => void;
  isPotentialDropTarget: boolean;
  selectedPiece: PieceOnBoard | null; // Needed to check if drag is active from this cell
}

const SquareCell: React.FC<SquareCellProps> = ({
  piece,
  onClick,
  isHighlighted,
  isSelected,
  isNorthThrone,
  isSouthThrone,
  isPortalA,
  isPortalB,
  playerColors,
  pieceSymbols,
  row,
  col,
  isCheckerboardPattern,
  isPortalModeActive,
  isDisabled = false,
  isPieceDraggable,
  onPieceDragStart,
  onPieceDragEnd,
  onPieceDropOnSquare,
  isPotentialDropTarget,
  selectedPiece,
}) => {
  const [isBeingDraggedOver, setIsBeingDraggedOver] = useState(false);

  let determinedBgColor = 'bg-[#6B574E]';
  if (isCheckerboardPattern && (row + col) % 2 === 0) {
    determinedBgColor = 'bg-[#5A4D46]';
  }

  let specialMarkingContent: React.ReactNode = null;
  let cellTitle = '';

  if (isPortalA) {
    specialMarkingContent = (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polygon points="0,0 75,50 0,100" fill="#342620" />
      </svg>
    );
    cellTitle = `Portal to ${String.fromCharCode(65+PORTAL_B_COORD.col)}${BOARD_SIZE-PORTAL_B_COORD.row}`;
  } else if (isPortalB) {
    specialMarkingContent = (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polygon points="100,0 25,50 100,100" fill="#342620" />
      </svg>
    );
    cellTitle = `Portal to ${String.fromCharCode(65+PORTAL_A_COORD.col)}${BOARD_SIZE-PORTAL_A_COORD.row}`;
  } else if (isNorthThrone || isSouthThrone) {
    determinedBgColor = 'bg-[#342620]';
    specialMarkingContent = <span className="text-2xl opacity-90 text-[#AE9D88] select-none">♦</span>;
    cellTitle = isNorthThrone ? "North's Throne (South's Goal)" : "South's Throne (North's Goal)";
  }

  // Visual feedback for drag and drop
  if (isPotentialDropTarget && isBeingDraggedOver && !isDisabled && selectedPiece) {
    determinedBgColor = 'bg-[#7E9975]'; // Greenish tint for valid drop target hover
  } else if (isHighlighted && !isDisabled && (!selectedPiece || piece?.player === selectedPiece.player || !piece)) {
    // Show highlight only if not actively dragging over, or if it's for the current player's selection
    determinedBgColor = 'bg-[#9D867C]';
  }
  
  if (isSelected && !isDisabled && (!selectedPiece || piece?.id === selectedPiece.id)) {
     // Show selection only if not actively dragging something else over this selected piece
    if (!(isPotentialDropTarget && isBeingDraggedOver && selectedPiece && piece && selectedPiece.id !== piece.id)) {
        determinedBgColor = 'bg-[#846F65]';
    }
  }


  const handleDragEnter = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece) return;
    // Prevent event bubbling to parent if not needed, or check e.target
    e.preventDefault(); 
    e.stopPropagation();
    setIsBeingDraggedOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isDisabled || !selectedPiece) return;
     // Check if leaving to an actual other element, not child elements within the cell
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    e.stopPropagation();
    setIsBeingDraggedOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece) {
        return; // Do not allow drop if not a potential target or disabled
    }
    e.preventDefault(); // This is crucial to allow dropping
    e.stopPropagation();
    if (!isBeingDraggedOver) setIsBeingDraggedOver(true); // Ensure hover state is active
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isDisabled || !isPotentialDropTarget || !selectedPiece) return;
    e.preventDefault();
    e.stopPropagation();
    onPieceDropOnSquare(row, col, e);
    setIsBeingDraggedOver(false);
  };

  const squareClasses = `
    w-[51px] h-[51px] md:w-[67px] md:h-[67px]
    flex items-center justify-center ${determinedBgColor}
    ${isDisabled && (!piece || piece.player !== selectedPiece?.player) ? 'cursor-not-allowed' : 'cursor-pointer'}
    transition-colors duration-150
    relative overflow-hidden
  `;

  return (
    <div
      className={squareClasses}
      onClick={!isDisabled ? onClick : undefined}
      title={cellTitle || undefined}
      aria-disabled={isDisabled}
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
      {piece && (
        <div className="relative z-10">
          <PieceView
            type={piece.type}
            player={piece.player}
            colors={playerColors[piece.player]}
            symbol={pieceSymbols[piece.type]}
            isJarl={piece.type === PieceType.JARL}
            isDraggable={isPieceDraggable}
            onDragStart={(event) => onPieceDragStart(piece, event)}
            onDragEnd={onPieceDragEnd}
            pieceId={piece.id} // For debug or more specific drag logic if needed
          />
        </div>
      )}
    </div>
  );
};

export default SquareCell;
