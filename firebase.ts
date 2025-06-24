
import { initializeApp } from "firebase/app"; 
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  Timestamp, // Import Timestamp
  FirestoreDataConverter, // Import FirestoreDataConverter
  QueryDocumentSnapshot, // Import for fromFirestore
  SnapshotOptions // Import for fromFirestore
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore"; 

import { GameState, Player, FirestoreGameDoc, GamePhase } from './types'; 
import { getInitialBoard } from './utils/gameLogic';
import { 
    INITIAL_PIECES_SETUP_7_COLUMN, 
    INITIAL_PIECES_SETUP_5_COLUMN,
    BOARD_ROWS_DEFAULT,
    BOARD_COLS_7_COLUMN,
    BOARD_COLS_5_COLUMN,
    CENTRAL_THRONE_COORD_7_COLUMN,
    CENTRAL_THRONE_COORD_5_COLUMN
} from './constants';

// Initialize Firebase using modern v9+ modular SDK
const app = initializeApp(window.firebaseConfig); 
const db = getFirestore(app);

// FirestoreDataConverter for FirestoreGameDoc
const gameConverter: FirestoreDataConverter<FirestoreGameDoc> = {
  toFirestore: (gameData: FirestoreGameDoc) => {
    return {
      gameId: gameData.gameId,
      gameState: gameData.gameState, 
      hostPlayerId: gameData.hostPlayerId,
      hostPlayerName: gameData.hostPlayerName,
      guestPlayerId: gameData.guestPlayerId,
      guestPlayerName: gameData.guestPlayerName,
      status: gameData.status,
      createdAt: gameData.createdAt,
      updatedAt: gameData.updatedAt,
    };
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): FirestoreGameDoc => {
    const data = snapshot.data(options);
    const gameStateFromDb = data.gameState as Partial<GameState>; 
    const fullGameState: GameState = {
        board: gameStateFromDb.board || getInitialBoard(INITIAL_PIECES_SETUP_7_COLUMN, BOARD_ROWS_DEFAULT, BOARD_COLS_7_COLUMN),
        currentPlayer: gameStateFromDb.currentPlayer || Player.SOUTH,
        selectedPiece: gameStateFromDb.selectedPiece || null,
        validMoves: gameStateFromDb.validMoves || [],
        gamePhase: gameStateFromDb.gamePhase || GamePhase.PLAYING,
        winner: gameStateFromDb.winner || null,
        winReason: gameStateFromDb.winReason || null,
        turnNumber: gameStateFromDb.turnNumber || 1,
        message: gameStateFromDb.message || "Game loaded.",
        playerSouthName: gameStateFromDb.playerSouthName || "South",
        playerNorthName: gameStateFromDb.playerNorthName || "North",
        lastMoveTimestamp: gameStateFromDb.lastMoveTimestamp instanceof Timestamp ? gameStateFromDb.lastMoveTimestamp : null,
        awaitingPromotionChoice: gameStateFromDb.awaitingPromotionChoice || null,
        southsLostPieces: gameStateFromDb.southsLostPieces || [], // Updated field
        northsLostPieces: gameStateFromDb.northsLostPieces || [], // Updated field
        awaitingReinforcementPlacement: gameStateFromDb.awaitingReinforcementPlacement || null,
        boardRows: gameStateFromDb.boardRows || BOARD_ROWS_DEFAULT,
        boardCols: gameStateFromDb.boardCols || BOARD_COLS_7_COLUMN,
        centralThroneCoord: gameStateFromDb.centralThroneCoord || CENTRAL_THRONE_COORD_7_COLUMN,
        isSecureThroneRequired: typeof gameStateFromDb.isSecureThroneRequired === 'boolean' ? gameStateFromDb.isSecureThroneRequired : true, // Default true if missing
    };

    return {
      gameId: data.gameId,
      gameState: fullGameState,
      hostPlayerId: data.hostPlayerId,
      hostPlayerName: data.hostPlayerName,
      guestPlayerId: data.guestPlayerId,
      guestPlayerName: data.guestPlayerName,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt as Timestamp,
    } as FirestoreGameDoc;
  }
};

export const createGameInFirestore = async (
  gameId: string,
  hostPlayerId: string,
  hostPlayerName: string,
  is5ColumnMode: boolean,
  isSecureThroneRequired: boolean 
): Promise<FirestoreGameDoc> => {
  const boardRows = BOARD_ROWS_DEFAULT;
  const boardCols = is5ColumnMode ? BOARD_COLS_5_COLUMN : BOARD_COLS_7_COLUMN;
  const centralThrone = is5ColumnMode ? CENTRAL_THRONE_COORD_5_COLUMN : CENTRAL_THRONE_COORD_7_COLUMN;
  const initialSetup = is5ColumnMode ? INITIAL_PIECES_SETUP_5_COLUMN : INITIAL_PIECES_SETUP_7_COLUMN;

  const initialBoard = getInitialBoard(initialSetup, boardRows, boardCols);
  const initialPlayer = Player.SOUTH; 

  const initialGameState: GameState = {
    board: initialBoard,
    currentPlayer: initialPlayer,
    selectedPiece: null,
    validMoves: [],
    gamePhase: GamePhase.PLAYING, 
    winner: null,
    winReason: null,
    turnNumber: 1,
    message: `Turn 1: ${hostPlayerName} (${initialPlayer})'s move. Waiting for opponent...`,
    playerSouthName: hostPlayerName,
    playerNorthName: null, 
    lastMoveTimestamp: null,
    awaitingPromotionChoice: null,
    southsLostPieces: [], // Initialize new field
    northsLostPieces: [], // Initialize new field
    awaitingReinforcementPlacement: null,
    boardRows: boardRows,
    boardCols: boardCols,
    centralThroneCoord: centralThrone,
    isSecureThroneRequired: isSecureThroneRequired, 
  };

  const gameDocRef = doc(db, "games", gameId).withConverter(gameConverter);
  const newGameData: FirestoreGameDoc = {
    gameId,
    gameState: initialGameState,
    hostPlayerId,
    hostPlayerName,
    guestPlayerId: null, 
    guestPlayerName: null, 
    status: 'waiting',
    createdAt: Date.now(), 
    updatedAt: Timestamp.now(), 
  };

  await setDoc(gameDocRef, newGameData);
  return newGameData; 
};

export const joinGameInFirestore = async (
  gameId: string,
  guestPlayerId: string,
  guestPlayerName: string
): Promise<FirestoreGameDoc | null> => {
  const gameDocRef = doc(db, "games", gameId).withConverter(gameConverter);
  const gameSnap = await getDoc(gameDocRef);

  if (gameSnap.exists()) {
    const gameData = gameSnap.data();
    if (gameData.status === 'waiting' && !gameData.guestPlayerId) {
      const updatedGameState: GameState = { 
        ...gameData.gameState,
        playerNorthName: guestPlayerName,
        message: `Turn ${gameData.gameState.turnNumber}: ${gameData.gameState.playerSouthName || Player.SOUTH} (${Player.SOUTH})'s move. Select a piece.`,
      };
      
      const updatePayload: Partial<FirestoreGameDoc> = { 
        guestPlayerId: guestPlayerId,
        guestPlayerName: guestPlayerName,
        status: 'active' as const,
        gameState: updatedGameState,
        updatedAt: Timestamp.now(), 
      };
      await updateDoc(gameDocRef, updatePayload);
      
      const updatedSnap = await getDoc(gameDocRef);
      return updatedSnap.exists() ? updatedSnap.data() : null;

    } else {
      console.error("Game is not available to join or already has a guest.");
      return null;
    }
  } else {
    console.error("Game not found");
    return null;
  }
};

export const getGameStream = (gameId: string, callback: (gameData: FirestoreGameDoc | null) => void): Unsubscribe => {
  const gameDocRef = doc(db, "games", gameId).withConverter(gameConverter);
  return onSnapshot(gameDocRef, (docSnap) => { 
    if (docSnap.exists()) {
      callback(docSnap.data()); 
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to game stream:", error);
    callback(null);
  });
};

export const updateGameStateInFirestore = async (gameId: string, newGameState: GameState): Promise<void> => {
  const gameDocRef = doc(db, "games", gameId).withConverter(gameConverter);
  const updatePayload: Partial<FirestoreGameDoc> = { 
    gameState: newGameState, 
    updatedAt: Timestamp.now(), 
  };
  await updateDoc(gameDocRef, updatePayload);
};

export const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 11); 
};

export const setGameStatus = async (gameId: string, status: FirestoreGameDoc['status']): Promise<void> => {
  const gameDocRef = doc(db, "games", gameId).withConverter(gameConverter);
  const updatePayload: Partial<FirestoreGameDoc> = { 
     status, 
     updatedAt: Timestamp.now() 
  };
  await updateDoc(gameDocRef, updatePayload);
};
