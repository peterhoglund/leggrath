
import React from 'react';
import { PieceType, Player } from '../types';

interface PieceViewProps {
  type: PieceType;
  player: Player;
  colors: { base: string; border: string; text: string };
  symbol: string;
  isJarl: boolean;
  isDraggable: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  pieceId: string;
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
  pieceId
}) => {
  const baseSizeClass = isJarl ? 'w-11 h-11 md:w-14 md:h-14' : 'w-9 h-9 md:w-11 md:h-11';
  const symbolSizeClass = isJarl ? 'text-[1.8rem] md:text-[2.2rem]' : 'text-[1.65rem] md:text-[1.8rem]';

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

  let shapeClass = ''; // Default to square (due to equal w/h in baseSizeClass)
  if (type === PieceType.JARL || type === PieceType.HIRDMAN) {
    shapeClass = 'rounded-full';
  } 
  // Both PieceType.RAVEN and PieceType.ROOK_RAVEN will now use the default square shape.
  // The hexagonal clip-path for PieceType.RAVEN has been removed.

  return (
    <div
      className={`${outerPieceBaseClasses} ${shapeClass} ${symbolSpecificClasses}`}
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
