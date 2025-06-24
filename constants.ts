
import { Coordinate, Player, PieceType } from './types';

export const BOARD_ROWS_DEFAULT = 9; // 9 rows (height) - This remains constant for now

// --- 7-Column Mode Constants ---
export const BOARD_COLS_7_COLUMN = 7; // 7 columns (width)
export const CENTRAL_THRONE_COORD_7_COLUMN: Coordinate = { row: 4, col: 3 }; // Center of 9x7 board (D5, 0-indexed)
export const INITIAL_PIECES_SETUP_7_COLUMN: { player: Player; type: PieceType; coords: Coordinate[] }[] = [
  // Player NORTH (Dark pieces, starts at top rows 0, 1 - displayed as 9, 8)
  {
    player: Player.NORTH,
    type: PieceType.JARL,
    coords: [{ row: 0, col: 3 }] // D9
  },
  {
    player: Player.NORTH,
    type: PieceType.RAVEN, // All start as Standard Ravens
    coords: [
      { row: 0, col: 0 }, // A9
      { row: 0, col: 1 }, // B9
      { row: 0, col: 5 }, // F9
      { row: 0, col: 6 }  // G9
    ]
  },
  {
    player: Player.NORTH,
    type: PieceType.HIRDMAN,
    coords: [
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 } // B8, C8, D8, E8, F8
    ]
  },
  // Player SOUTH (Light pieces, starts at bottom rows 8, 7 - displayed as 1, 2)
  {
    player: Player.SOUTH,
    type: PieceType.JARL,
    coords: [{ row: 8, col: 3 }] // D1
  },
  {
    player: Player.SOUTH,
    type: PieceType.RAVEN, // All start as Standard Ravens
    coords: [
      { row: 8, col: 0 }, // A1
      { row: 8, col: 1 }, // B1
      { row: 8, col: 5 }, // F1
      { row: 8, col: 6 }  // G1
    ]
  },
  {
    player: Player.SOUTH,
    type: PieceType.HIRDMAN,
    coords: [
      { row: 7, col: 1 }, { row: 7, col: 2 }, { row: 7, col: 3 }, { row: 7, col: 4 }, { row: 7, col: 5 } // B2, C2, D2, E2, F2
    ]
  }
];


// --- 5-Column Mode Constants ---
export const BOARD_COLS_5_COLUMN = 5; // 5 columns (width)
export const CENTRAL_THRONE_COORD_5_COLUMN: Coordinate = { row: 4, col: 2 }; // Center of 9x5 board (C5, 0-indexed)
// Player pieces: 1 Jarl, 3 Hirdmen, 2 Ravens, 2 Rook Ravens = 8 pieces per player
export const INITIAL_PIECES_SETUP_5_COLUMN: { player: Player; type: PieceType; coords: Coordinate[] }[] = [
  // Player NORTH (Dark pieces, starts at top rows 0, 1 - displayed as 9, 8)
  { player: Player.NORTH, type: PieceType.JARL, coords: [{ row: 0, col: 2 }] }, // C8 (Jarl)
  { player: Player.NORTH, type: PieceType.HIRDMAN, coords: [
      { row: 1, col: 1 }, 
      { row: 1, col: 2 }, 
      { row: 1, col: 3 } // B9, C9, D9 (Hirdmen)
    ] 
  },
  { player: Player.NORTH, type: PieceType.RAVEN, coords: [
      { row: 0, col: 4 }, // A9 (Raven)
      { row: 1, col: 0 }  // E8 (Raven)
    ] 
  },
  { player: Player.NORTH, type: PieceType.ROOK_RAVEN, coords: [
      { row: 0, col: 0 }, // E9 (Rook Raven)
      { row: 1, col: 4 }  // A8 (Rook Raven)
    ]
  },
  
  // Player SOUTH (Light pieces, starts at bottom rows 8, 7 - displayed as 1, 2)
  { player: Player.SOUTH, type: PieceType.JARL, coords: [{ row: 8, col: 2 }] }, // C2 (Jarl)
  { player: Player.SOUTH, type: PieceType.HIRDMAN, coords: [
      { row: 7, col: 1 }, 
      { row: 7, col: 2 }, 
      { row: 7, col: 3 }, // B1, C1, D1 (Hirdmen)
    ] 
  },
  { player: Player.SOUTH, type: PieceType.RAVEN, coords: [
      { row: 8, col: 0 }, // A1 (Raven)
      { row: 7, col: 4 }  // E2 (Raven)
    ] 
  },
  { player: Player.SOUTH, type: PieceType.ROOK_RAVEN, coords: [
      { row: 8, col: 4 }, // E1 (Rook Raven)
      { row: 7, col: 0 }  // A2 (Rook Raven)
    ]
  }
];


export const PIECE_COLORS: Record<Player, { base: string; border: string; text: string }> = {
  [Player.SOUTH]: { base: 'bg-[#D8D1CC]', border: 'border-[#000000]', text: 'text-[#373737]' }, // South is Light
  [Player.NORTH]: { base: 'bg-[#373737]', border: 'border-[#000000]', text: 'text-[#D8D1CC]' }  // North is Dark
};

export const PIECE_SYMBOLS: Record<PieceType, string> = {
  [PieceType.JARL]: 'ᛟ',
  [PieceType.HIRDMAN]: 'ᚼ',
  [PieceType.RAVEN]: 'ᛉ', // Standard Raven
  [PieceType.ROOK_RAVEN]: 'ᚢ' // Rook Raven (promoted) - new symbol
};