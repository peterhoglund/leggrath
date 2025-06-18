export enum Player {
  NORTH = 'North', // Player 1
  SOUTH = 'South'  // Player 2
}

export enum PieceType {
  JARL = 'Jarl',
  HIRDMAN = 'Hirdman',
  RAVEN = 'Raven'
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
  col: number;
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
  selectedPiece: PieceOnBoard | null; // Will be null for opponent when viewing
  validMoves: Move[]; // Will be empty for opponent
  gamePhase: GamePhase;
  winner: Player | null;
  winReason: string | null;
  turnNumber: number;
  message: string;
  // Multiplayer specific fields, could be part of a larger Firestore document
  playerSouthName?: string;
  playerNorthName?: string;
  lastMoveTimestamp?: number; // For potential ordering or debugging
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
  gameState: GameState;
  hostPlayerId: string; // Could be a unique session ID or Firebase User ID if auth is added
  guestPlayerId?: string;
  hostPlayerName: string;
  guestPlayerName?: string;
  status: 'waiting' | 'active' | 'finished' | 'aborted';
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

declare global {
  interface Window {
    firebaseConfig: any; // This is used to pass the Firebase config from index.html to firebase.ts
  }
}