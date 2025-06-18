import React from 'react';
import { PieceOnBoard } from '../types'; 
import PieceView from './PieceView';
import { PIECE_COLORS, PIECE_SYMBOLS, PORTAL_A_COORD, PORTAL_B_COORD, BOARD_SIZE } from '../constants'; 
import { PieceType } from '../types'; 

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
  isDisabled?: boolean; // Added
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
  isDisabled = false, // Default to false
}) => {
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


  if (isHighlighted && !isDisabled) { // Only highlight if not disabled
    determinedBgColor = 'bg-[#9D867C]'; 
  }
  if (isSelected && !isDisabled) { // Only show selection if not disabled
    determinedBgColor = 'bg-[#846F65]'; 
  }
  
  const squareClasses = `
    w-[51px] h-[51px] md:w-[67px] md:h-[67px] 
    flex items-center justify-center ${determinedBgColor}
    ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
    transition-colors duration-150
    relative overflow-hidden 
  `;

  return (
    <div 
      className={squareClasses} 
      onClick={!isDisabled ? onClick : undefined}  // Only attach onClick if not disabled
      title={cellTitle || undefined}
      aria-disabled={isDisabled}
    >
      {specialMarkingContent && (
        <div className="absolute inset-0 flex items-center justify-center w-full h-full pointer-events-none z-0">
            {specialMarkingContent}
        </div>
      )}
      {piece && (
        <div className="relative z-10"> {/* Ensures piece is on top of the special marking */}
          <PieceView 
            type={piece.type} 
            player={piece.player} 
            colors={playerColors[piece.player]} 
            symbol={pieceSymbols[piece.type]}
            isJarl={piece.type === PieceType.JARL}
          />
        </div>
      )}
    </div>
  );
};

export default SquareCell;
