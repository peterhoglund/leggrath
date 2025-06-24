import React from 'react';
import { PieceType, Player } from '../types';

interface PieceViewProps {
  type: PieceType;
  player: Player;
  colors: { base: string; border: string; text: string };
  symbol: string;
  isJarl: boolean; // Kept for prop compatibility, but type check is primary
  isDraggable: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  pieceId: string;
  sizeVariant?: 'normal' | 'small'; // New optional prop
}

const PieceView: React.FC<PieceViewProps> = ({ 
  type, 
  player, 
  colors, 
  symbol, 
  isJarl, 
  isDraggable,
  onDragStart,
  onDragEnd,
  pieceId,
  sizeVariant = 'normal' // Default to normal size
}) => {
  let baseSizeClass = '';
  let symbolSizeClass = '';

  if (sizeVariant === 'small') {
    baseSizeClass = (type === PieceType.JARL) ? 'w-8 h-8 md:w-9 md:h-9' : 'w-7 h-7 md:w-8 md:h-8';
    symbolSizeClass = (type === PieceType.JARL) ? 'text-lg md:text-xl' : 'text-base md:text-lg';
  } else { // normal size
    baseSizeClass = (type === PieceType.JARL) ? 'w-11 h-11 md:w-14 md:h-14' : 'w-9 h-9 md:w-11 md:h-11';
    symbolSizeClass = (type === PieceType.JARL) ? 'text-[1.8rem] md:text-[2.2rem]' : 'text-[1.65rem] md:text-[1.8rem]';
  }

  const outerPieceBaseClasses = `
    ${colors.base}
    border-2 ${colors.border}
    flex items-center justify-center
    font-bold shadow-md select-none
    ${baseSizeClass}
    ${isDraggable ? 'cursor-grab' : ''}
  `;

  const symbolSpecificClasses = `
    ${colors.text}
    font-runic
    ${symbolSizeClass}
  `;
  
  const handleDragStartInternal = (e: React.DragEvent) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    onDragStart(e);
  };

  let shapeSpecificStyles = ''; 
  if (type === PieceType.JARL || type === PieceType.HIRDMAN) {
    shapeSpecificStyles = 'rounded-full';
  } else if (type === PieceType.RAVEN) {
    // Standard Raven is a rhombus
    shapeSpecificStyles = '';
  } else if (type === PieceType.ROOK_RAVEN) {
    // Rook Raven is a square (default div shape, no rounded corners or clip-path)
    shapeSpecificStyles = ''; 
  }

  return (
    <div
      className={`${outerPieceBaseClasses} ${shapeSpecificStyles} ${symbolSpecificClasses}`}
      title={`${player} ${type}`}
      draggable={isDraggable}
      onDragStart={handleDragStartInternal}
      onDragEnd={onDragEnd}
      id={`piece-${pieceId}`}
    >
      {symbol}
    </div>
  );
};

export default PieceView;