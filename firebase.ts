
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

import type { GameState, Player, FirestoreGameDoc } from './types';
import { getInitialBoard } from './utils/gameLogic';
import { INITIAL_PIECES_SETUP } from './constants';

// Initialize Firebase using compat
if (!firebase.apps.length) {
  firebase.initializeApp(window.firebaseConfig);
}
const db = firebase.firestore();

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
    gamePhase: 'Playing', // Keep as string literal if GamePhase enum not imported
    winner: null,
    winReason: null,
    turnNumber: 1,
    message: `Turn 1: ${hostPlayerName} (${initialPlayer})'s move. Waiting for opponent...`,
    playerSouthName: hostPlayerName,
  };

  const gameDocRef = db.collection("games").doc(gameId);
  const newGameData: FirestoreGameDoc = {
    gameId,
    gameState: initialGameState,
    hostPlayerId,
    hostPlayerName,
    status: 'waiting',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await gameDocRef.set(newGameData);
  // Firestore compat's set doesn't return the written data directly like v9 setDoc.
  // The newGameData here has client-side timestamps. If server timestamps were used and needed back, a get() would follow.
  // For current structure, returning newGameData is fine.
  return newGameData;
};

export const joinGameInFirestore = async (
  gameId: string,
  guestPlayerId: string,
  guestPlayerName: string
): Promise<FirestoreGameDoc | null> => {
  const gameDocRef = db.collection("games").doc(gameId);
  const gameSnap = await gameDocRef.get();

  if (gameSnap.exists) {
    const gameData = gameSnap.data() as FirestoreGameDoc;
    if (gameData.status === 'waiting' && !gameData.guestPlayerId) {
      const updatedGameState = {
        ...gameData.gameState,
        playerNorthName: guestPlayerName,
        message: `Turn ${gameData.gameState.turnNumber}: ${gameData.gameState.playerSouthName} (${Player.SOUTH})'s move. Select a piece.`,
      };
      await gameDocRef.update({
        guestPlayerId: guestPlayerId,
        guestPlayerName: guestPlayerName,
        status: 'active',
        gameState: updatedGameState,
        updatedAt: Date.now(),
      });
      // Construct the returned object to match FirestoreGameDoc structure
      const updatedDocData = { 
        ...gameData, 
        guestPlayerId, 
        guestPlayerName, 
        status: 'active' as const, // Ensure status type is literal
        gameState: updatedGameState,
        updatedAt: Date.now() // Reflect update time, though gameData.updatedAt would be stale
      };
      return updatedDocData;
    } else {
      console.error("Game is not available to join or already has a guest.");
      return null;
    }
  } else {
    console.error("Game not found");
    return null;
  }
};

// The Unsubscribe type in App.tsx (imported from 'firebase/firestore') is typically () => void,
// which is compatible with the return type of compat onSnapshot.
export const getGameStream = (gameId: string, callback: (gameData: FirestoreGameDoc | null) => void): (() => void) => {
  const gameDocRef = db.collection("games").doc(gameId);
  return gameDocRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
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
  const gameDocRef = db.collection("games").doc(gameId);
  newGameState.lastMoveTimestamp = Date.now();
  await gameDocRef.update({
    gameState: newGameState,
    updatedAt: Date.now(),
  });
};

export const generateUniqueId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const setGameStatus = async (gameId: string, status: FirestoreGameDoc['status']): Promise<void> => {
  const gameDocRef = db.collection("games").doc(gameId);
  await gameDocRef.update({ status, updatedAt: Date.now() });
};
