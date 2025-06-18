
import * as firebaseAppModule from "firebase/app"; // Changed import
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  Timestamp // For consistency if server timestamps are ever used
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore"; // Ensure Unsubscribe type is available

import { GameState, Player, FirestoreGameDoc, GamePhase } from './types'; // Changed type-only import for Player, added GamePhase
import { getInitialBoard } from './utils/gameLogic';
import { INITIAL_PIECES_SETUP } from './constants';

// Initialize Firebase using modern v9+ modular SDK
const app = firebaseAppModule.initializeApp(window.firebaseConfig); // Updated call
const db = getFirestore(app);

export const createGameInFirestore = async (
  gameId: string,
  hostPlayerId: string,
  hostPlayerName: string
): Promise<FirestoreGameDoc> => {
  const initialBoard = getInitialBoard(INITIAL_PIECES_SETUP);
  const initialPlayer = Player.SOUTH; // Host is South by default

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
    playerNorthName: null, // Explicitly null
    lastMoveTimestamp: null, // Explicitly null
  };

  const gameDocRef = doc(db, "games", gameId);
  const newGameData: FirestoreGameDoc = {
    gameId,
    gameState: initialGameState,
    hostPlayerId,
    hostPlayerName,
    guestPlayerId: null, // Explicitly null
    guestPlayerName: null, // Explicitly null
    status: 'waiting',
    createdAt: Date.now(), 
    updatedAt: Date.now(), 
  };

  await setDoc(gameDocRef, newGameData);
  return newGameData; 
};

export const joinGameInFirestore = async (
  gameId: string,
  guestPlayerId: string,
  guestPlayerName: string
): Promise<FirestoreGameDoc | null> => {
  const gameDocRef = doc(db, "games", gameId);
  const gameSnap = await getDoc(gameDocRef);

  if (gameSnap.exists()) {
    const gameData = gameSnap.data() as FirestoreGameDoc;
    if (gameData.status === 'waiting' && !gameData.guestPlayerId) {
      const updatedGameState = {
        ...gameData.gameState,
        playerNorthName: guestPlayerName,
        message: `Turn ${gameData.gameState.turnNumber}: ${gameData.gameState.playerSouthName} (${Player.SOUTH})'s move. Select a piece.`,
      };
      const updatePayload = {
        guestPlayerId: guestPlayerId,
        guestPlayerName: guestPlayerName,
        status: 'active' as const,
        gameState: updatedGameState,
        updatedAt: Date.now(),
      };
      await updateDoc(gameDocRef, updatePayload);
      
      return { 
        ...gameData, 
        ...updatePayload 
      };
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
  const gameDocRef = doc(db, "games", gameId);
  return onSnapshot(gameDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as FirestoreGameDoc);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to game stream:", error);
    callback(null);
  });
};

export const updateGameStateInFirestore = async (gameId: string, newGameState: GameState): Promise<void> => {
  const gameDocRef = doc(db, "games", gameId);
  // Ensure newGameState doesn't have undefined values before sending to Firestore
  // For now, assuming newGameState is constructed correctly in App.tsx to use nulls
  const updatePayload = {
    gameState: {
        ...newGameState,
        lastMoveTimestamp: newGameState.lastMoveTimestamp === undefined ? Date.now() : newGameState.lastMoveTimestamp // Prefer existing, else set
    },
    updatedAt: Date.now(),
  };
   // If newGameState.lastMoveTimestamp itself can be undefined, ensure it becomes null or a value.
   // The current logic in App.tsx for endTurn likely doesn't set lastMoveTimestamp itself.
   // The spread will carry over previous value or undefined if not set.
   // Setting it here directly is safer.
  if (updatePayload.gameState.lastMoveTimestamp === undefined) {
    updatePayload.gameState.lastMoveTimestamp = Date.now();
  }


  await updateDoc(gameDocRef, updatePayload);
};

export const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 11); 
};

export const setGameStatus = async (gameId: string, status: FirestoreGameDoc['status']): Promise<void> => {
  const gameDocRef = doc(db, "games", gameId);
  await updateDoc(gameDocRef, { status, updatedAt: Date.now() });
};