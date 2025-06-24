
import type { Timestamp } from "firebase/firestore"; // Added import

export enum Player {
  NORTH = 'North', // Player 1
  SOUTH = 'South'  // Player 2
}

export enum PieceType {
  JARL = 'Jarl',
  HIRDMAN = 'Hirdman',
  RAVEN = 'Raven',
  ROOK_RAVEN = 'Rook Raven' // New piece type
}

export interface Piece {
  id: string;
  player: Player;
  type: PieceType;
}

export interface PieceOnBoard extends Piece {
  row: number;
  col: number;
}

export type SquareState = PieceOnBoard | null;

// New interface to represent a row as an object containing an array of squares
export interface RowData {
  squares: SquareState[];
}

// BoardState is now an array of RowData objects
export type BoardState = RowData[];

export interface Coordinate {
  row: number;
  col:number;
}

export interface Move {
  from: Coordinate;
  to: Coordinate;
  isJump?: boolean; // True if this move is a Raider's non-capturing jump-over
  jumpedPieceCoord?: Coordinate; // The coordinate of the piece being jumped over by a Raider (not captured by the jump itself)
  isTeleport?: boolean; // True if this move is a portal teleportation
}

export enum GamePhase {
  PLAYING = 'Playing',
  GAME_OVER = 'Game Over'
}

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  selectedPiece: PieceOnBoard | null; 
  validMoves: Move[]; 
  gamePhase: GamePhase;
  winner: Player | null;
  winReason: string | null;
  turnNumber: number;
  message: string;
  playerSouthName: string | null; 
  playerNorthName: string | null; 
  lastMoveTimestamp: Timestamp | null; // Changed from number | null
  awaitingPromotionChoice: { pieceId: string; at: Coordinate } | null; // For Raven promotion
  southsLostPieces: Piece[]; // South's own pieces captured by North
  northsLostPieces: Piece[]; // North's own pieces captured by South
  awaitingReinforcementPlacement: { pieceToPlace: Piece; originalPlayer: Player } | null; // For placing a captured piece
  // Dynamic board properties, initialized based on mode
  boardRows: number;
  boardCols: number;
  centralThroneCoord: Coordinate;
  isSecureThroneRequired: boolean; // Renamed from isJarlSelfPreservationActive
}

// Defines the overall state of the application UI
export type AppMode = 
  | 'MAIN_MENU'             // Initial screen: "Play Local" or "Play Online"
  | 'MULTIPLAYER_SETUP'     // Screen for entering name and game room, then "Create" or "Join"
  | 'WAITING_FOR_OPPONENT'  // Host is waiting for someone to join
  | 'PLAYING_ONLINE'        // Actively in an online multiplayer game
  | 'LOCAL_PLAY';           // Original single-device play mode

// Structure for the game document in Firestore
export interface FirestoreGameDoc {
  gameId: string;
  gameState: GameState; // This now includes isSecureThroneRequired and new lost piece arrays
  hostPlayerId: string; 
  guestPlayerId: string | null; 
  hostPlayerName: string;
  guestPlayerName: string | null; 
  status: 'waiting' | 'active' | 'finished' | 'aborted';
  createdAt: number; // Timestamp (kept as number for Date.now() compatibility)
  updatedAt: Timestamp; // Changed from number
}

declare global {
  interface Window {
    firebaseConfig: any; // This is used to pass the Firebase config from index.html to firebase.ts
  }
}
