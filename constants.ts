
import { Coordinate, Player, PieceType } from './types';

export const BOARD_SIZE = 7; // Remains 7x7

export const NORTH_THRONE_COORD: Coordinate = { row: 0, col: 3 }; // North's Throne (South aims for this)
export const SOUTH_THRONE_COORD: Coordinate = { row: 6, col: 3 }; // South's Throne (North aims for this)

export const PORTAL_A_COORD: Coordinate = { row: 3, col: 0 }; // Center row, column A (A4)
export const PORTAL_B_COORD: Coordinate = { row: 3, col: 6 }; // Center row, column G (G4)


// INITIAL_PIECES_SETUP's Jarl positions match these new Throne coordinates by design.
export const INITIAL_PIECES_SETUP: { player: Player; type: PieceType; coords: Coordinate[] }[] = [
  {
    player: Player.NORTH, // Pieces for the player starting at the top of the board
    type: PieceType.JARL,
    coords: [{ row: 0, col: 3 }] 
  },
  {
    player: Player.NORTH,
    type: PieceType.RAVEN, 
    coords: [ 
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 0, col: 5 }, { row: 0, col: 6 }
    ]
  },
  {
    player: Player.NORTH,
    type: PieceType.HIRDMAN, 
    coords: [ 
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }
    ]
  },
  {
    player: Player.SOUTH, // Pieces for the player starting at the bottom of the board
    type: PieceType.JARL,
    coords: [{ row: 6, col: 3 }] 
  },
  {
    player: Player.SOUTH,
    type: PieceType.RAVEN, 
    coords: [ 
      { row: 6, col: 0 }, { row: 6, col: 1 },
      { row: 6, col: 5 }, { row: 6, col: 6 }
    ]
  },
  {
    player: Player.SOUTH,
    type: PieceType.HIRDMAN, 
    coords: [ 
      { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }
    ]
  }
];

export const PIECE_COLORS: Record<Player, { base: string; border: string; text: string }> = {
  [Player.SOUTH]: { base: 'bg-[#D8D1CC]', border: 'border-[#000000]', text: 'text-[#373737]' }, // South is now Light
  [Player.NORTH]: { base: 'bg-[#373737]', border: 'border-[#000000]', text: 'text-[#D8D1CC]' }  // North is now Dark
};

export const PIECE_SYMBOLS: Record<PieceType, string> = {
  [PieceType.JARL]: 'ᛟ',
  [PieceType.HIRDMAN]: 'ᚼ',
  [PieceType.RAVEN]: 'ᛉ'
};