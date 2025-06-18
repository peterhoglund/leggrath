import React from 'react';
import { PieceType, Player } from '../types';

interface PieceViewProps {
  type: PieceType;
  player: Player;
  colors: { base: string; border: string; text: string };
  symbol: string;
  isJarl: boolean; 
}

const PieceView: React.FC<PieceViewProps> = ({ type, player, colors, symbol, isJarl }) => {
  const baseSizeClass = isJarl ? 'w-11 h-11 md:w-14 md:h-14' : 'w-9 h-9 md:w-11 md:h-11';
  const symbolSizeClass = isJarl ? 'text-[1.8rem] md:text-[2.2rem]' : 'text-[1.65rem] md:text-[1.8rem]';

  const outerPieceBaseClasses = `
    ${colors.base} 
    border-2 ${colors.border}
    flex items-center justify-center
    font-bold shadow-md select-none 
    ${baseSizeClass} 
  `;

  const symbolSpecificClasses = `
    ${colors.text}
    font-runic
    ${symbolSizeClass}
  `;

  if (type === PieceType.RAVEN) {
    // Raven is Square 
    return (
      <div 
        className={`${outerPieceBaseClasses} ${symbolSpecificClasses}`}
        title={`${player} ${type}`}
      >
        {symbol}
      </div>
    );
  }

  // Jarl and Hirdman are circular.
  // Jarl maintains its larger size due to baseSizeClass and symbolSizeClass.
  return (
    <div 
      className={`${outerPieceBaseClasses} rounded-full ${symbolSpecificClasses}`}
      title={`${player} ${type}`}
    >
      {symbol}
    </div>
  );
};

export default PieceView;