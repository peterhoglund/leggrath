
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
import { INITIAL_PIECES_SETUP } from './constants';

// Initialize Firebase using modern v9+ modular SDK
const app = initializeApp(window.firebaseConfig); 
const db = getFirestore(app);

// FirestoreDataConverter for FirestoreGameDoc
const gameConverter: FirestoreDataConverter<FirestoreGameDoc> = {
  toFirestore: (gameData: FirestoreGameDoc) => {
    // The gameData object should already be in the correct format,
    // especially with Timestamps, as per application logic.
    // This function ensures it matches what Firestore expects.
    return {
      gameId: gameData.gameId,
      gameState: gameData.gameState,
      hostPlayerId: gameData.hostPlayerId,
      hostPlayerName: gameData.hostPlayerName,
      guestPlayerId: gameData.guestPlayerId,
      guestPlayerName: gameData.guestPlayerName,
      status: gameData.status,
      createdAt: gameData.createdAt, // Remains a number as per current design
      updatedAt: gameData.updatedAt, // Should be a Firestore Timestamp
    };
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): FirestoreGameDoc => {
    const data = snapshot.data(options);
    // Firestore SDK automatically converts its timestamp representation
    // to Firestore Timestamp objects on the client.
    // We just need to cast it to our type.
    // Ensure all fields are correctly typed.
    return {
      gameId: data.gameId,
      gameState: data.gameState as GameState, // gameState.lastMoveTimestamp is handled within GameState type
      hostPlayerId: data.hostPlayerId,
      hostPlayerName: data.hostPlayerName,
      guestPlayerId: data.guestPlayerId,
      guestPlayerName: data.guestPlayerName,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt as Timestamp, // Explicitly cast if necessary, but SDK should handle
    } as FirestoreGameDoc; // Casting the whole object for type safety.
  }
};

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
    playerNorthName: null, 
    lastMoveTimestamp: null, 
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
    const gameData = gameSnap.data(); // gameSnap.data() will return FirestoreGameDoc due to converter
    if (gameData.status === 'waiting' && !gameData.guestPlayerId) {
      const updatedGameState: GameState = { 
        ...gameData.gameState,
        playerNorthName: guestPlayerName,
        message: `Turn ${gameData.gameState.turnNumber}: ${gameData.gameState.playerSouthName || Player.SOUTH} (${Player.SOUTH})'s move. Select a piece.`,
      };
      
      const updatePayload: Partial<FirestoreGameDoc> = { // Use Partial for updates
        guestPlayerId: guestPlayerId,
        guestPlayerName: guestPlayerName,
        status: 'active' as const,
        gameState: updatedGameState,
        updatedAt: Timestamp.now(), 
      };
      await updateDoc(gameDocRef, updatePayload);
      
      // Re-fetch or merge to get the full updated document, as updateDoc doesn't return the doc
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
  return onSnapshot(gameDocRef, (docSnap) => { // docSnap type will be QueryDocumentSnapshot<FirestoreGameDoc>
    if (docSnap.exists()) {
      callback(docSnap.data()); // .data() will return FirestoreGameDoc
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
  const updatePayload: Partial<FirestoreGameDoc> = { // Use Partial for updates
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
  const updatePayload: Partial<FirestoreGameDoc> = { // Use Partial for updates
     status, 
     updatedAt: Timestamp.now() 
  };
  await updateDoc(gameDocRef, updatePayload);
};