
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Unsubscribe } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

import { BoardState, Player, PieceOnBoard, GameState, GamePhase, Coordinate, PieceType, Move, AppMode, FirestoreGameDoc, Piece } from './types';
import {
    BOARD_ROWS_DEFAULT,
    BOARD_COLS_7_COLUMN,
    BOARD_COLS_5_COLUMN,
    CENTRAL_THRONE_COORD_7_COLUMN,
    CENTRAL_THRONE_COORD_5_COLUMN,
    INITIAL_PIECES_SETUP_7_COLUMN,
    INITIAL_PIECES_SETUP_5_COLUMN,
    PIECE_SYMBOLS,
    PIECE_COLORS,
} from './constants';
import Board from './components/Board';
import ResetControls from './components/ResetControls';
import MultiplayerSetup from './components/MultiplayerSetup';
import {
  getInitialBoard,
  getAllValidMovesForPiece,
  isCoordinateEqual,
} from './utils/gameLogic';
import {
  createGameInFirestore,
  joinGameInFirestore,
  getGameStream,
  updateGameStateInFirestore,
  generateUniqueId,
  setGameStatus,
} from './firebase';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('MAIN_MENU');
  const [is5ColumnModeActive, setIs5ColumnModeActive] = useState(false);
  const [isSecureThroneRequired, setIsSecureThroneRequired] = useState(true); // New setting, default ON
  const [gameState, setGameState] = useState<GameState>(getInitialLocalGameState(is5ColumnModeActive, isSecureThroneRequired));
  const [showRules, setShowRules] = useState(false);
  const [isCheckerboardPattern, setIsCheckerboardPattern] = useState(false);
  const [showDebugFeatures, setShowDebugFeatures] = useState<boolean>(false);
  const [selectedCapturedPieceForReinforcement, setSelectedCapturedPieceForReinforcement] = useState<Piece | null>(null);


  const [playerName, setPlayerName] = useState<string>('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [localPlayerRole, setLocalPlayerRole] = useState<Player | null>(null);
  const [firestoreGameDoc, setFirestoreGameDoc] = useState<FirestoreGameDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId] = useState<string>(generateUniqueId());
  const [copyNotification, setCopyNotification] = useState<{ text: string; visible: boolean }>({ text: '', visible: false });
  const copyRoomNameButtonRef = useRef<HTMLButtonElement>(null);

  const [draggedPieceImage, setDraggedPieceImage] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const imgContainer = document.createElement('div');
    imgContainer.style.position = 'absolute';
    imgContainer.style.top = '-1000px'; 
    imgContainer.style.opacity = '0.75'; 
    document.body.appendChild(imgContainer);
    setDraggedPieceImage(imgContainer);

    return () => {
      if (imgContainer.parentNode) {
        imgContainer.parentNode.removeChild(imgContainer);
      }
      setDraggedPieceImage(null);
    };
  }, []);


  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    if (appMode === 'PLAYING_ONLINE' && gameId) {
      unsubscribe = getGameStream(gameId, (gameData) => {
        if (gameData) {
          const incomingIs5ColMode = gameData.gameState.boardCols === BOARD_COLS_5_COLUMN;
          const incomingSecureThrone = gameData.gameState.isSecureThroneRequired;

          if (is5ColumnModeActive !== incomingIs5ColMode) {
            setIs5ColumnModeActive(incomingIs5ColMode); 
          }
          if (isSecureThroneRequired !== incomingSecureThrone) {
            setIsSecureThroneRequired(incomingSecureThrone);
          }

          setFirestoreGameDoc(gameData);
          setGameState(prev => ({
            ...gameData.gameState,
            selectedPiece: prev.selectedPiece && 
                           prev.selectedPiece.player === gameData.gameState.currentPlayer && 
                           !gameData.gameState.awaitingPromotionChoice &&
                           !gameData.gameState.awaitingReinforcementPlacement ? prev.selectedPiece : null,
            validMoves: prev.selectedPiece && 
                        prev.selectedPiece.player === gameData.gameState.currentPlayer &&
                        !gameData.gameState.awaitingPromotionChoice &&
                        !gameData.gameState.awaitingReinforcementPlacement ? prev.validMoves : [],
            awaitingPromotionChoice: gameData.gameState.awaitingPromotionChoice || null, 
            awaitingReinforcementPlacement: gameData.gameState.awaitingReinforcementPlacement || null,
          }));

          if (gameData.status === 'aborted' && gameData.gameState.winner === null) {
             setGameState(prev => ({
                ...prev,
                gamePhase: GamePhase.GAME_OVER,
                winner: localPlayerRole, 
                winReason: `${localPlayerRole === Player.SOUTH ? firestoreGameDoc?.hostPlayerName || Player.SOUTH : firestoreGameDoc?.guestPlayerName || Player.NORTH} wins! Opponent left the game.`,
                message: `${localPlayerRole === Player.SOUTH ? firestoreGameDoc?.hostPlayerName || Player.SOUTH : firestoreGameDoc?.guestPlayerName || Player.NORTH} wins! Opponent left the game.`,
              }));
          }
        } else {
          if (gameId !== "DEBUGROOM") {
            setErrorMessage("Game not found or an error occurred.");
            handleLeaveGame();
          }
        }
        setLoading(false);
      });
    } else if (appMode === 'WAITING_FOR_OPPONENT' && gameId) {
       unsubscribe = getGameStream(gameId, (gameData) => {
        if (gameId === "DEBUGROOM") {
            setLoading(false);
            return;
        }
        if (gameData) {
          setFirestoreGameDoc(gameData);
          if (gameData.status === 'active' && gameData.guestPlayerId) {
            const incomingIs5ColMode = gameData.gameState.boardCols === BOARD_COLS_5_COLUMN;
            const incomingSecureThrone = gameData.gameState.isSecureThroneRequired;
            if (is5ColumnModeActive !== incomingIs5ColMode) {
              setIs5ColumnModeActive(incomingIs5ColMode);
            }
            if (isSecureThroneRequired !== incomingSecureThrone) {
                setIsSecureThroneRequired(incomingSecureThrone);
            }
            setGameState(gameData.gameState);
            setAppMode('PLAYING_ONLINE');
            setLoading(false);
          } else if (gameData.status === 'aborted') {
             setErrorMessage("Game was aborted by host.");
             handleLeaveGame();
          }
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, gameId, localPlayerRole]);

  function getInitialLocalGameState(is5ColMode: boolean, secureThrone: boolean): GameState {
    const boardRows = BOARD_ROWS_DEFAULT;
    const boardCols = is5ColMode ? BOARD_COLS_5_COLUMN : BOARD_COLS_7_COLUMN;
    const centralThrone = is5ColMode ? CENTRAL_THRONE_COORD_5_COLUMN : CENTRAL_THRONE_COORD_7_COLUMN;
    const initialSetup = is5ColMode ? INITIAL_PIECES_SETUP_5_COLUMN : INITIAL_PIECES_SETUP_7_COLUMN;

    const initialBoard = getInitialBoard(initialSetup, boardRows, boardCols);
    const initialPlayer = Player.SOUTH;
    return {
      board: initialBoard,
      currentPlayer: initialPlayer,
      selectedPiece: null,
      validMoves: [],
      gamePhase: GamePhase.PLAYING,
      winner: null,
      winReason: null,
      turnNumber: 1,
      message: `Turn 1: South (${initialPlayer})'s move. Select a piece.`,
      playerSouthName: "South",
      playerNorthName: "North",
      lastMoveTimestamp: null,
      awaitingPromotionChoice: null,
      capturedBySouth: [],
      capturedByNorth: [],
      awaitingReinforcementPlacement: null,
      boardRows: boardRows,
      boardCols: boardCols,
      centralThroneCoord: centralThrone,
      isSecureThroneRequired: secureThrone,
    };
  }

  const resetLocalGame = useCallback(() => {
    setGameState(getInitialLocalGameState(is5ColumnModeActive, isSecureThroneRequired)); // Pass current toggle states
    setShowRules(false);
    setSelectedCapturedPieceForReinforcement(null);
  }, [is5ColumnModeActive, isSecureThroneRequired]);

  const handleGoToMultiplayerSetup = () => {
    setErrorMessage(null);
    setAppMode('MULTIPLAYER_SETUP');
  };

  const handleBackToMainMenu = () => {
    setAppMode('MAIN_MENU');
    setGameId(null);
    setLocalPlayerRole(null);
    setFirestoreGameDoc(null);
    setPlayerName('');
    setIs5ColumnModeActive(false); 
    setIsSecureThroneRequired(true); // Reset to default
    setGameState(getInitialLocalGameState(false, true)); 
    setErrorMessage(null);
    setLoading(false);
    setCopyNotification({ text: '', visible: false });
    setSelectedCapturedPieceForReinforcement(null);
  }

  const handleCreateGame = async (pName: string, roomName: string) => {
    setLoading(true);
    setErrorMessage(null);
    setPlayerName(pName);
    const normalizedRoomName = roomName.trim().toUpperCase();
    setGameId(normalizedRoomName);

    try {
      // Pass current mode states when creating the game
      const gameDoc = await createGameInFirestore(normalizedRoomName, sessionId, pName, is5ColumnModeActive, isSecureThroneRequired);
      setLocalPlayerRole(Player.SOUTH); 
      setFirestoreGameDoc(gameDoc);
      setGameState(gameDoc.gameState); 
      setAppMode('WAITING_FOR_OPPONENT');
      setLoading(false);
    } catch (error) {
      console.error("Error creating game:", error);
      setErrorMessage("Failed to create game. The room name might be taken or invalid, or a data error occurred. Please try again.");
      setGameId(null);
      setLoading(false);
    }
  };

  const handleJoinGame = async (pName: string, roomName: string) => {
    setLoading(true);
    setErrorMessage(null);
    setPlayerName(pName);
    const normalizedRoomName = roomName.trim().toUpperCase();
    setGameId(normalizedRoomName);

    try {
      const gameDoc = await joinGameInFirestore(normalizedRoomName, sessionId, pName);
      if (gameDoc) {
        setLocalPlayerRole(Player.NORTH); 
        setFirestoreGameDoc(gameDoc);
        // Sync the UI toggles with the joined game's state
        const joinedGameIs5Col = gameDoc.gameState.boardCols === BOARD_COLS_5_COLUMN;
        const joinedGameSecureThrone = gameDoc.gameState.isSecureThroneRequired;
        setIs5ColumnModeActive(joinedGameIs5Col);
        setIsSecureThroneRequired(joinedGameSecureThrone);
        setGameState(gameDoc.gameState);
        setAppMode('PLAYING_ONLINE');
      } else {
        setErrorMessage("Could not join game. Check Game Room Name or game may be full/unavailable.");
        setGameId(null);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      setErrorMessage("Failed to join game. An error occurred.");
      setGameId(null);
      setLoading(false);
    }
  };

  const handleSwitchToLocalPlay = () => {
    setAppMode('LOCAL_PLAY');
    resetLocalGame(); 
    setErrorMessage(null);
  };

  const handleLeaveGame = async () => {
    setLoading(true);
    const currentAppMode = appMode;
    const currentGameId = gameId;

    if (currentGameId && currentGameId !== "DEBUGROOM" && (currentAppMode === 'PLAYING_ONLINE' || currentAppMode === 'WAITING_FOR_OPPONENT')) {
      const currentDoc = firestoreGameDoc;
      if (currentDoc) {
         if (currentDoc.status === 'active') {
            const winner = localPlayerRole === Player.SOUTH ? Player.NORTH : Player.SOUTH;
            const winnerName = winner === Player.SOUTH ? currentDoc.hostPlayerName : currentDoc.guestPlayerName;
            const finalGameState: GameState = { 
              ...currentDoc.gameState,
              gamePhase: GamePhase.GAME_OVER,
              winner: winner,
              winReason: `${winnerName || winner} wins! Opponent left the game.`,
              message: `${winnerName || winner} wins! Opponent left the game.`,
              lastMoveTimestamp: Timestamp.now(),
              awaitingPromotionChoice: null, 
              awaitingReinforcementPlacement: null,
            };
            await updateGameStateInFirestore(currentGameId, finalGameState);
            await setGameStatus(currentGameId, 'finished');
         } else if (currentDoc.status === 'waiting') {
            await setGameStatus(currentGameId, 'aborted');
         }
      }
    }
    handleBackToMainMenu();
  };
  
  const handleDebugGoToWaitingScreen = () => {
    setPlayerName("Debugger");
    setGameId("DEBUGROOM");
    setLocalPlayerRole(Player.SOUTH);
    setFirestoreGameDoc(null);
    setGameState(prev => ({
        ...getInitialLocalGameState(is5ColumnModeActive, isSecureThroneRequired), 
        playerSouthName: "Debugger",
        message: "Waiting for opponent... (Debug Mode)"
    }));
    setErrorMessage(null);
    setLoading(false);
    setCopyNotification({ text: '', visible: false });
    setAppMode('WAITING_FOR_OPPONENT');
  };

  const handleCopyRoomName = useCallback(async (currentRoomId: string | null) => {
    if (!currentRoomId) return;

    if (!navigator.clipboard) {
      setCopyNotification({ text: 'Clipboard not available.', visible: true });
      setTimeout(() => {
        setCopyNotification(prev => ({ ...prev, visible: false }));
        copyRoomNameButtonRef.current?.blur();
      }, 2500);
      return;
    }

    try {
      await navigator.clipboard.writeText(currentRoomId);
      setCopyNotification({ text: 'Room name copied!', visible: true });
    } catch (err) {
      console.error('Failed to copy room name:', err);
      setCopyNotification({ text: 'Failed to copy.', visible: true });
    } finally {
      setTimeout(() => {
        setCopyNotification(prev => ({ ...prev, visible: false }));
        copyRoomNameButtonRef.current?.blur();
      }, 2000);
    }
  }, []);

  const endTurn = useCallback((boardAfterAction: BoardState, moverPlayer: Player, pieceThatMovedOrPlaced: PieceOnBoard | Piece | null, currentGameState: GameState): GameState => {
    const opponent = moverPlayer === Player.NORTH ? Player.SOUTH : Player.NORTH;
    let gameIsOver = false;
    let winner: Player | null = null;
    let localWinReason = "";

    const moverDisplayName = moverPlayer === Player.SOUTH ? (currentGameState.playerSouthName || Player.SOUTH) : (currentGameState.playerNorthName || Player.NORTH);

    if (pieceThatMovedOrPlaced && pieceThatMovedOrPlaced.type === PieceType.JARL && 'row' in pieceThatMovedOrPlaced) { 
      if (isCoordinateEqual({row: pieceThatMovedOrPlaced.row, col: pieceThatMovedOrPlaced.col}, currentGameState.centralThroneCoord)) {
        // Throne safety is checked before the move is allowed by getAllValidMovesForPiece if isSecureThroneRequired is true
        gameIsOver = true;
        winner = moverPlayer;
        localWinReason = `wins by reaching the Central Throne!`;
      }
    }

    if (!gameIsOver) { 
      let opponentJarlFound = false;
      for (let r = 0; r < currentGameState.boardRows; r++) {
        for (let c = 0; c < currentGameState.boardCols; c++) {
          const piece = boardAfterAction[r].squares[c];
          if (piece && piece.type === PieceType.JARL && piece.player === opponent) {
            opponentJarlFound = true;
            break;
          }
        }
        if (opponentJarlFound) break;
      }
      if (!opponentJarlFound) {
        gameIsOver = true;
        winner = moverPlayer;
        localWinReason = `wins by Decapitation! ${opponent}'s Jarl captured.`;
      }
    }
    
    const currentTimestamp = Timestamp.now();

    if (gameIsOver) {
        const finalMessage = `${moverDisplayName} (${moverPlayer}) ${localWinReason}`;
        return {
            ...currentGameState, board: boardAfterAction, gamePhase: GamePhase.GAME_OVER, winner: winner,
            winReason: finalMessage, message: finalMessage,
            selectedPiece: null, validMoves: [],
            lastMoveTimestamp: currentTimestamp,
            awaitingPromotionChoice: null, 
            awaitingReinforcementPlacement: null,
        };
    }

    const nextPlayer = opponent;
    const nextTurnNumber = moverPlayer === Player.NORTH ? currentGameState.turnNumber + 1 : currentGameState.turnNumber;
    const nextPlayerDisplayName = nextPlayer === Player.SOUTH ? (currentGameState.playerSouthName || Player.SOUTH) : (currentGameState.playerNorthName || Player.NORTH);
    const nextMessage = `Turn ${nextTurnNumber}: ${nextPlayerDisplayName} (${nextPlayer})'s move. Select a piece.`;

    return {
      ...currentGameState, board: boardAfterAction, currentPlayer: nextPlayer, turnNumber: nextTurnNumber,
      selectedPiece: null, validMoves: [],
      gamePhase: GamePhase.PLAYING,
      message: nextMessage,
      lastMoveTimestamp: currentTimestamp,
      awaitingPromotionChoice: null, 
      awaitingReinforcementPlacement: null,
    };
  }, []);

  const executeMove = useCallback(async (move: Move) => {
    if (appMode === 'PLAYING_ONLINE' && (!gameId || localPlayerRole !== gameState.currentPlayer)) {
      console.warn("Not your turn or not in online game.");
      return;
    }
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) { 
        return;
    }

    let newBoard = gameState.board.map(rowData => ({
      squares: rowData.squares.map(sq => sq ? {...sq} : null)
    }));
    let newCapturedBySouth = [...gameState.capturedBySouth];
    let newCapturedByNorth = [...gameState.capturedByNorth];

    const movingPieceOriginal = newBoard[move.from.row].squares[move.from.col];
    if (!movingPieceOriginal) return;

    const capturedPiece = newBoard[move.to.row].squares[move.to.col];
    if (capturedPiece && capturedPiece.player !== movingPieceOriginal.player) {
      const pieceToStore: Piece = { id: capturedPiece.id, player: capturedPiece.player, type: capturedPiece.type }; 
      if (movingPieceOriginal.player === Player.SOUTH) {
        newCapturedBySouth.push(pieceToStore);
      } else {
        newCapturedByNorth.push(pieceToStore);
      }
    }

    let finalPieceState: PieceOnBoard;
    const movedPiece: PieceOnBoard = { ...movingPieceOriginal, row: move.to.row, col: move.to.col };
    newBoard[move.to.row].squares[move.to.col] = movedPiece;
    newBoard[move.from.row].squares[move.from.col] = null;
    finalPieceState = movedPiece;
    
    const isRaven = finalPieceState.type === PieceType.RAVEN;
    let isOnPromotionSquare = false;
    if (isRaven) {
        if (finalPieceState.player === Player.SOUTH && (finalPieceState.row === 0 || finalPieceState.row === 1)) {
            isOnPromotionSquare = true;
        } else if (finalPieceState.player === Player.NORTH && (finalPieceState.row === gameState.boardRows - 1 || finalPieceState.row === gameState.boardRows - 2)) {
            isOnPromotionSquare = true;
        }
    }
    
    if (isOnPromotionSquare) { 
      const moverDisplayName = finalPieceState.player === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);
      const promoteMessage = `${moverDisplayName} (${finalPieceState.player}), promote Raven at ${String.fromCharCode(65 + finalPieceState.col)}${gameState.boardRows - finalPieceState.row} to Rook Raven?`;
      setGameState(prev => ({
        ...prev,
        board: newBoard, 
        selectedPiece: null,
        validMoves: [],
        awaitingPromotionChoice: { pieceId: finalPieceState.id, at: { row: finalPieceState.row, col: finalPieceState.col } },
        message: promoteMessage,
        capturedBySouth: newCapturedBySouth,
        capturedByNorth: newCapturedByNorth,
      }));
      return; 
    }

    const newGameStateAfterMoveOnly = { 
        ...gameState, 
        board: newBoard, 
        message: gameState.message, // Preserve current message if it's special, otherwise endTurn will set it
        capturedBySouth: newCapturedBySouth,
        capturedByNorth: newCapturedByNorth,
    }; 
    const newGameStateAfterTurnEnd = endTurn(newBoard, finalPieceState.player, finalPieceState, newGameStateAfterMoveOnly);

    if (appMode === 'PLAYING_ONLINE' && gameId && gameId !== "DEBUGROOM") {
      try {
        setLoading(true);
        await updateGameStateInFirestore(gameId, newGameStateAfterTurnEnd);
      } catch (error) {
        console.error("Error updating game state:", error);
        setErrorMessage("Failed to sync move. Please check connection.");
        setLoading(false); 
      }
    } else {
      setGameState(newGameStateAfterTurnEnd);
    }
  }, [gameState, endTurn, appMode, gameId, localPlayerRole]);

  const handlePromotionConfirm = useCallback(async (doPromote: boolean) => {
    if (!gameState.awaitingPromotionChoice) return;

    const { pieceId, at } = gameState.awaitingPromotionChoice;
    let boardAfterPromotionChoice = gameState.board.map(rowData => ({
        squares: rowData.squares.map(sq => sq ? {...sq} : null)
    }));
    
    let promotedPieceState = boardAfterPromotionChoice[at.row].squares[at.col];

    if (!promotedPieceState || promotedPieceState.id !== pieceId) {
        console.error("Promotion target piece mismatch or not found.");
        setGameState(prev => ({
            ...prev,
            awaitingPromotionChoice: null,
            message: `Turn ${prev.turnNumber}: ${prev.currentPlayer === Player.SOUTH ? (prev.playerSouthName || Player.SOUTH) : (prev.playerNorthName || Player.NORTH)} (${prev.currentPlayer})'s move. Select a piece.`
        }));
        return;
    }

    if (doPromote) {
        promotedPieceState.type = PieceType.ROOK_RAVEN;
        boardAfterPromotionChoice[at.row].squares[at.col] = promotedPieceState;
    }

    const currentTurnPlayer = promotedPieceState.player;
    const gameStateForEndTurn = { 
        ...gameState, 
        board: boardAfterPromotionChoice, 
        awaitingPromotionChoice: null, 
    };
    
    const finalGameState = endTurn(boardAfterPromotionChoice, currentTurnPlayer, promotedPieceState, gameStateForEndTurn);

    if (appMode === 'PLAYING_ONLINE' && gameId && gameId !== "DEBUGROOM") {
        try {
            setLoading(true);
            await updateGameStateInFirestore(gameId, finalGameState);
        } catch (error) {
            console.error("Error updating game state after promotion:", error);
            setErrorMessage("Failed to sync promotion. Please check connection.");
            setLoading(false);
        }
    } else {
        setGameState(finalGameState);
    }
}, [gameState, endTurn, appMode, gameId, localPlayerRole]);


  const deselectPiece = useCallback(() => {
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) {
        return; 
    }

    const currentPlayerResolvedName = gameState.currentPlayer === Player.SOUTH
        ? (gameState.playerSouthName || Player.SOUTH)
        : (gameState.playerNorthName || Player.NORTH);
    const messageForSelectPrompt = `Turn ${gameState.turnNumber}: ${currentPlayerResolvedName} (${gameState.currentPlayer})'s move. Select a piece.`;

    setGameState(prev => ({
      ...prev,
      selectedPiece: null,
      validMoves: [],
      message: messageForSelectPrompt
    }));
    setSelectedCapturedPieceForReinforcement(null);
  }, [gameState.currentPlayer, gameState.playerNorthName, gameState.playerSouthName, gameState.turnNumber, gameState.awaitingPromotionChoice, gameState.awaitingReinforcementPlacement]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.gamePhase === GamePhase.GAME_OVER) return;
    if (gameState.awaitingPromotionChoice) return; 

    if (appMode === 'PLAYING_ONLINE' && localPlayerRole !== gameState.currentPlayer && !gameState.awaitingReinforcementPlacement) {
      const currentTurnPlayerName = gameState.currentPlayer === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);
      setGameState(prev => ({ ...prev, message: `Waiting for ${currentTurnPlayerName} (${gameState.currentPlayer}) to move.`}));
      return;
    }
    
    if (gameState.awaitingReinforcementPlacement) {
      if (!gameState.board[row].squares[col]) { 
        handleReinforcementPlacement(row, col);
      } else {
        setGameState(prev => ({ ...prev, message: "Invalid placement. Must be an empty square." }));
      }
      return;
    }


    const clickedSquareContent = gameState.board[row].squares[col];

    if (gameState.selectedPiece) {
      const move = gameState.validMoves.find(m =>
        isCoordinateEqual(m.to, {row, col}) &&
        isCoordinateEqual(m.from, {row: gameState.selectedPiece!.row, col: gameState.selectedPiece!.col})
      );

      if (move) {
        executeMove(move);
      } else if (clickedSquareContent && clickedSquareContent.player === gameState.currentPlayer) {
        if (clickedSquareContent.id === gameState.selectedPiece.id) {
          deselectPiece();
        } else {
          const newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, gameState.boardRows, gameState.boardCols, gameState.isSecureThroneRequired, gameState.centralThroneCoord);
          setGameState(prev => ({
            ...prev,
            selectedPiece: clickedSquareContent,
            validMoves: newValidMoves,
            message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${gameState.boardRows-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${gameState.boardRows-row}). No valid moves.`
          }));
        }
      } else {
        deselectPiece();
      }
    } else if (clickedSquareContent && clickedSquareContent.player === gameState.currentPlayer) {
      const newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, gameState.boardRows, gameState.boardCols, gameState.isSecureThroneRequired, gameState.centralThroneCoord);
      setGameState(prev => ({
        ...prev,
        selectedPiece: clickedSquareContent,
        validMoves: newValidMoves,
        message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${gameState.boardRows-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${gameState.boardRows-row}). No valid moves.`
      }));
    }
  }, [gameState, executeMove, appMode, localPlayerRole, deselectPiece]);


  const handlePieceDragStart = useCallback((piece: PieceOnBoard, event: React.DragEvent) => {
    if (gameState.gamePhase === GamePhase.GAME_OVER || 
        (appMode === 'PLAYING_ONLINE' && localPlayerRole !== piece.player) ||
        piece.player !== gameState.currentPlayer ||
        gameState.awaitingPromotionChoice ||
        gameState.awaitingReinforcementPlacement
        ) {
      event.preventDefault();
      return;
    }

    const newValidMoves = getAllValidMovesForPiece(piece, gameState.board, gameState.boardRows, gameState.boardCols, gameState.isSecureThroneRequired, gameState.centralThroneCoord);
    setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves: newValidMoves,
      message: newValidMoves.length > 0 ? `Dragging ${PIECE_SYMBOLS[piece.type]}. Choose destination.` : `Dragging ${PIECE_SYMBOLS[piece.type]}. No valid moves.`
    }));
    event.dataTransfer.setData("text/plain", JSON.stringify({ row: piece.row, col: piece.col, id: piece.id }));
    event.dataTransfer.effectAllowed = "move";

    if (draggedPieceImage && event.target instanceof HTMLElement) {
        const pieceElementVisual = document.createElement('div');
        const colors = PIECE_COLORS[piece.player];
        const symbol = PIECE_SYMBOLS[piece.type];
        const isJarl = piece.type === PieceType.JARL;
        const baseSizeClass = isJarl ? 'w-11 h-11 md:w-14 md:h-14' : 'w-9 h-9 md:w-11 md:h-11';
        const symbolSizeClass = isJarl ? 'text-[1.8rem] md:text-[2.2rem]' : 'text-[1.65rem] md:text-[1.8rem]';

        let shapeClass = '';
        if (piece.type === PieceType.JARL || piece.type === PieceType.HIRDMAN) {
            shapeClass = 'rounded-full';
        }
        
        pieceElementVisual.className = `
          ${colors.base} border-2 ${colors.border} ${shapeClass}
          flex items-center justify-center font-bold shadow-md select-none
          ${baseSizeClass} ${colors.text} font-runic ${symbolSizeClass}
        `;
        pieceElementVisual.textContent = symbol;
        
        draggedPieceImage.innerHTML = ''; 
        draggedPieceImage.appendChild(pieceElementVisual);
        
        const rect = event.target.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        event.dataTransfer.setDragImage(draggedPieceImage, offsetX, offsetY);
    }

  }, [gameState, appMode, localPlayerRole, draggedPieceImage]);

  const handlePieceDropOnSquare = useCallback((targetRow: number, targetCol: number, event: React.DragEvent) => {
    if (!gameState.selectedPiece || gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) return; 

    try {
      const draggedPieceData = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (draggedPieceData.id !== gameState.selectedPiece.id) {
        console.warn("Dropped piece ID does not match selected piece ID.");
        deselectPiece();
        return;
      }

      const move = gameState.validMoves.find(m =>
        isCoordinateEqual(m.to, {row: targetRow, col: targetCol}) &&
        isCoordinateEqual(m.from, {row: draggedPieceData.row, col: draggedPieceData.col})
      );

      if (move) {
        executeMove(move);
      } else {
        deselectPiece(); 
      }
    } catch (error) {
      console.error("Error processing drop data:", error);
      deselectPiece();
    }
  }, [gameState.selectedPiece, gameState.validMoves, executeMove, deselectPiece, gameState.awaitingPromotionChoice, gameState.awaitingReinforcementPlacement]);

  const handlePieceDragEnd = useCallback((event: React.DragEvent) => {
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) { 
        event.preventDefault();
        return;
    }
    if (event.dataTransfer.dropEffect === 'none' && gameState.selectedPiece) {
      deselectPiece();
    }
  }, [gameState.selectedPiece, deselectPiece, gameState.awaitingPromotionChoice, gameState.awaitingReinforcementPlacement]);

  const handleInitiateReinforcement = useCallback(() => {
    if (gameState.gamePhase === GamePhase.GAME_OVER || 
        (appMode === 'PLAYING_ONLINE' && localPlayerRole !== gameState.currentPlayer) ||
        gameState.awaitingPromotionChoice || 
        gameState.awaitingReinforcementPlacement) return;

    const capturedPieces = gameState.currentPlayer === Player.SOUTH ? gameState.capturedBySouth : gameState.capturedByNorth;
    if (capturedPieces.length === 0) {
      setGameState(prev => ({...prev, message: "No pieces to reinforce."}));
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      selectedPiece: null,
      validMoves: [],
      message: `${prev.currentPlayer}, select one of your captured pieces to reinforce.`
    }));
  }, [gameState, appMode, localPlayerRole]);

  const handleSelectCapturedPieceForReinforcement = useCallback((piece: Piece) => {
    setSelectedCapturedPieceForReinforcement(piece);
    setGameState(prev => ({
      ...prev,
      awaitingReinforcementPlacement: { pieceToPlace: piece, originalPlayer: piece.player }, 
      message: `Select an empty square to place your ${PIECE_SYMBOLS[piece.type]}.`
    }));
  }, []);
  
  const handleReinforcementPlacement = useCallback(async (row: number, col: number) => {
    if (!gameState.awaitingReinforcementPlacement || !selectedCapturedPieceForReinforcement) return;
    
    const { pieceToPlace } = gameState.awaitingReinforcementPlacement;
    
    let newBoard = gameState.board.map(rowData => ({
      squares: rowData.squares.map(sq => sq ? {...sq} : null)
    }));

    if (newBoard[row].squares[col]) { 
      setGameState(prev => ({ ...prev, message: "Cannot place on an occupied square."}));
      return;
    }

    const newPieceOnBoard: PieceOnBoard = {
      ...pieceToPlace, 
      player: gameState.currentPlayer, 
      row,
      col,
    };
    newBoard[row].squares[col] = newPieceOnBoard;

    let newCapturedBySouth = [...gameState.capturedBySouth];
    let newCapturedByNorth = [...gameState.capturedByNorth];

    if (gameState.currentPlayer === Player.SOUTH) {
      newCapturedBySouth = newCapturedBySouth.filter(p => p.id !== pieceToPlace.id);
    } else {
      newCapturedByNorth = newCapturedByNorth.filter(p => p.id !== pieceToPlace.id);
    }
    
    const gameStateForEndTurn = {
      ...gameState,
      board: newBoard,
      capturedBySouth: newCapturedBySouth,
      capturedByNorth: newCapturedByNorth,
      awaitingReinforcementPlacement: null,
    };

    const finalGameState = endTurn(newBoard, gameState.currentPlayer, newPieceOnBoard, gameStateForEndTurn);
    setSelectedCapturedPieceForReinforcement(null);


    if (appMode === 'PLAYING_ONLINE' && gameId && gameId !== "DEBUGROOM") {
      try {
        setLoading(true);
        await updateGameStateInFirestore(gameId, finalGameState);
      } catch (error) {
        console.error("Error updating game state after reinforcement:", error);
        setErrorMessage("Failed to sync reinforcement. Please check connection.");
        setLoading(false);
      }
    } else {
      setGameState(finalGameState);
    }
  }, [gameState, endTurn, appMode, gameId, localPlayerRole, selectedCapturedPieceForReinforcement]);


  const toggleRules = () => setShowRules(prev => !prev);
  const toggleCheckerboardPattern = () => {
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) return;
    setIsCheckerboardPattern(prev => !prev);
  }
  const toggle5ColumnMode = () => {
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) return;
    if (appMode === 'PLAYING_ONLINE') {
        setErrorMessage("Board mode cannot be changed during an online game.");
        return;
    }
    const newMode = !is5ColumnModeActive;
    setIs5ColumnModeActive(newMode);
    setGameState(getInitialLocalGameState(newMode, gameState.isSecureThroneRequired)); 
    setSelectedCapturedPieceForReinforcement(null);
  };
  const toggleSecureThroneRequired = () => {
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement) return;
    if (appMode === 'PLAYING_ONLINE') {
        setErrorMessage("Throne safety rule cannot be changed during an online game.");
        return;
    }
    const newSetting = !isSecureThroneRequired;
    setIsSecureThroneRequired(newSetting);
    setGameState(getInitialLocalGameState(is5ColumnModeActive, newSetting)); 
    setSelectedCapturedPieceForReinforcement(null);
  };


  const currentPlayerHighlightClass = (player: Player) => {
    return player === Player.SOUTH ? 'bg-[#D8D1CC] text-[#373737]' : 'bg-[#2A2A2A] text-[#D8D1CC]';
  };

  const winnerHighlightClass = (winnerPlayer: Player | null) => {
    if (!winnerPlayer) return '';
    return winnerPlayer === Player.SOUTH ? 'bg-[#D8D1CC] text-[#373737] font-bold' : 'bg-[#2A2A2A] text-[#D8D1CC] font-bold';
  };

  const renderMessage = () => {
    if (!gameState.message) return null;
    let messageToRender = gameState.message;

    if (gameState.winner) {
      const winnerName = gameState.winner === Player.SOUTH 
          ? (firestoreGameDoc?.hostPlayerName || gameState.playerSouthName || Player.SOUTH) 
          : (firestoreGameDoc?.guestPlayerName || gameState.playerNorthName || Player.NORTH);
      const winnerDisplayString = `${winnerName} (${gameState.winner})`;
      const winReasonWithName = gameState.winReason?.replace(gameState.winner.toString(), winnerDisplayString) || `${winnerDisplayString} wins!`;
      const parts = winReasonWithName.split(new RegExp(`(${winnerDisplayString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'));
      
      return (
        <>
          {parts.map((part, index) =>
            (part === winnerDisplayString) ? ( 
              <span key={index} className={`px-2 py-0.5 rounded-sm mx-1 ${winnerHighlightClass(gameState.winner)}`}>
                {part}
              </span>
            ) : (
              part
            )
          )}
        </>
      );
    }
    
    if (gameState.awaitingPromotionChoice || gameState.awaitingReinforcementPlacement || selectedCapturedPieceForReinforcement) {
        return messageToRender; 
    }

    const southPlayerDisplayName = firestoreGameDoc?.hostPlayerName || gameState.playerSouthName || Player.SOUTH;
    const northPlayerDisplayName = firestoreGameDoc?.guestPlayerName || gameState.playerNorthName || Player.NORTH;

    const southPlayerFullDisplay = `${southPlayerDisplayName} (${Player.SOUTH})`;
    const northPlayerFullDisplay = `${northPlayerDisplayName} (${Player.NORTH})`;

    if (messageToRender.includes(southPlayerFullDisplay) && gameState.currentPlayer === Player.SOUTH) {
      const parts = messageToRender.split(southPlayerFullDisplay);
      return (
        <>
          {parts[0]}
          <span className={`px-2 py-0.5 rounded-sm mx-1 ${currentPlayerHighlightClass(Player.SOUTH)}`}>
            {southPlayerFullDisplay}
          </span>
          {parts[1]}
        </>
      );
    } else if (messageToRender.includes(northPlayerFullDisplay) && gameState.currentPlayer === Player.NORTH) {
       const parts = messageToRender.split(northPlayerFullDisplay);
      return (
        <>
          {parts[0]}
          <span className={`px-2 py-0.5 rounded-sm mx-1 ${currentPlayerHighlightClass(Player.NORTH)}`}>
            {northPlayerFullDisplay}
          </span>
          {parts[1]}
        </>
      );
    }
    return messageToRender;
  };

  if (appMode === 'MAIN_MENU') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#2E2D2B]">
        <header className="mb-12 text-center">
          <h1 className="text-7xl font-bold text-[#E0D8CC] font-medieval title">leggrað</h1>
          <p className="text-3xl font-runic text-[#C0B6A8] mt-3 title">ᛚᚴᚴᚱᛅᚦ</p>
        </header>
        <div className="space-y-6 w-full max-w-sm">
          <button
            onClick={handleSwitchToLocalPlay}
            className="w-full py-3.5 text-xl bg-[#5C5346] hover:bg-[#6E6255]"
          >
            Play Local Game
          </button>
          <button
            onClick={handleGoToMultiplayerSetup}
            className="w-full py-3.5 text-xl bg-[#5C5346] hover:bg-[#6E6255]"
          >
            Play Online Multiplayer
          </button>
          {showDebugFeatures && (
            <button
              onClick={handleDebugGoToWaitingScreen}
              className="w-full py-2.5 text-md bg-[#4A3838] hover:bg-[#5A4848]"
              title="Debug: Go to Waiting for Opponent Screen"
            >
              Debug: View Waiting Screen
            </button>
          )}
        </div>
      </div>
    );
  }

  if (appMode === 'MULTIPLAYER_SETUP') {
    return <MultiplayerSetup
              onCreateGame={handleCreateGame}
              onJoinGame={handleJoinGame}
              onBackToMainMenu={handleBackToMainMenu}
              loading={loading}
              errorMessage={errorMessage}
            />;
  }

  if (appMode === 'WAITING_FOR_OPPONENT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center text-[#E0D8CC]">
        <h1 className="text-4xl font-medieval mb-8">Waiting for Opponent</h1>
        <p className="text-lg text-[#C0B6A8] mb-4">Share this Room Name with your opponent.</p>
        <p className="text-md text-[#A09488] mb-1">Board Mode: {is5ColumnModeActive ? '5-Column' : '7-Column'}</p>
        <p className="text-md text-[#A09488] mb-1">Throne Safety: {isSecureThroneRequired ? 'Required' : 'Not Required'}</p>
        <div className="relative text-center mb-8">
            <button
                ref={copyRoomNameButtonRef}
                onClick={() => handleCopyRoomName(gameId)}
                className="bg-[#3C3731] px-8 py-2 rounded-lg shadow-md hover:bg-[#4a433d] transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#8C7062] focus:ring-opacity-75"
                title="Click to copy room name"
                aria-label={`Copy room name ${gameId || 'Loading...'} to clipboard. Click to copy.`}
                disabled={!gameId || loading}
            >
                <strong className="font-['Almendra'] text-[30px] text-[#E0D8CC] tracking-wider group-hover:text-white">
                {gameId || 'Creating...'}
                </strong>
            </button>
            <div
                className={`absolute left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-[#4A4238] text-[#E0D8CC] text-sm rounded-md shadow-lg transition-all duration-300 ease-in-out ${copyNotification.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
                style={{ minWidth: '150px', top: 'calc(100% + 0.5rem)' }}
                role="status"
                aria-live="polite"
            >
                {copyNotification.text}
            </div>
        </div>

        <div className="flex justify-center items-center my-12" aria-label="Loading indicator">
          <span className="dot dot-1" aria-hidden="true"></span>
          <span className="dot dot-2" aria-hidden="true"></span>
          <span className="dot dot-3" aria-hidden="true"></span>
        </div>

        {errorMessage && (
          <p className="text-red-400 text-lg mb-8">{errorMessage}</p>
        )}

         <button
            onClick={handleLeaveGame}
            className="px-8 py-3 text-lg bg-[#4A3838] hover:bg-[#5A4848] text-[#E0D8CC] my-6 rounded-lg shadow-md transition-colors duration-150"
            style={{ fontFamily: "'Almendra', serif" }}
            disabled={loading && gameId !== 'DEBUGROOM'}
          >
           {(loading && gameId !== 'DEBUGROOM' && firestoreGameDoc?.status === 'waiting') ? 'Cancelling...' : 'Cancel Game'}
        </button>
      </div>
    );
  }

  const opponentDisplayName = localPlayerRole === Player.SOUTH ?
                              (firestoreGameDoc?.guestPlayerName || (appMode === 'LOCAL_PLAY' ? gameState.playerNorthName : "Opponent")) :
                              (firestoreGameDoc?.hostPlayerName || (appMode === 'LOCAL_PLAY' ? gameState.playerSouthName : "Opponent"));
  const localPlayerDisplayName = appMode === 'PLAYING_ONLINE' ? playerName : (localPlayerRole ? (localPlayerRole === Player.SOUTH ? gameState.playerSouthName : gameState.playerNorthName) : (gameState.currentPlayer === Player.SOUTH ? gameState.playerSouthName : gameState.playerNorthName) );

  const isInteractionAllowedForLocalPlayer = 
    (appMode === 'LOCAL_PLAY' || localPlayerRole === gameState.currentPlayer) && 
    gameState.gamePhase !== GamePhase.GAME_OVER && 
    !gameState.awaitingPromotionChoice &&
    !gameState.awaitingReinforcementPlacement &&
    !selectedCapturedPieceForReinforcement; 

  const isUiDisabled = !!gameState.awaitingPromotionChoice || !!gameState.awaitingReinforcementPlacement || !!selectedCapturedPieceForReinforcement;


  return (
    <div className="flex flex-col items-center min-h-screen p-4" role="main">
      <header className="mb-4 text-center w-full max-w-5xl">
        <div className="flex justify-between items-center w-full">
            {appMode === 'PLAYING_ONLINE' && localPlayerRole && (
                 <div className="text-left w-1/3">
                    <p className="text-sm text-[#C0B6A8] font-medieval truncate">You: <span className={currentPlayerHighlightClass(localPlayerRole)}>{localPlayerDisplayName || playerName} ({localPlayerRole})</span></p>
                    {opponentDisplayName && <p className="text-sm text-[#C0B6A8] font-medieval truncate">Opponent: {opponentDisplayName} ({localPlayerRole === Player.SOUTH ? Player.NORTH : Player.SOUTH})</p>}
                 </div>
            )}
            {appMode === 'LOCAL_PLAY' && (<div className="w-1/3 flex items-center">
                 {/* Placeholder or empty div to maintain layout if needed, or remove if not needed for centering */}
            </div>)}

            <div className="flex-1 text-center">
                 <h1 className="text-5xl font-bold text-[#E0D8CC] font-medieval title">leggrað</h1>
                 <p className="text-xl font-runic text-[#C0B6A8] mt-1 title">ᛚᚴᚴᚱᛅᚦ</p>
            </div>
             {appMode === 'PLAYING_ONLINE' && gameId && (
                <div className="text-right text-sm text-[#C0B6A8] font-medieval w-1/3 truncate">
                    Room: {gameId}<br />
                    Throne Safety: {gameState.isSecureThroneRequired ? 'Required' : 'Not Req.'}
                </div>
            )}
            {appMode === 'LOCAL_PLAY' && ( <div className="w-1/3 flex items-center justify-end">
                {/* Placeholder or empty div to maintain layout if needed, or remove if not needed for centering */}
            </div> )}
        </div>
      </header>

      <div
        aria-live="polite"
        className="mb-4 p-3 w-full max-w-md text-center bg-[#3C3832] rounded shadow text-[#E0D8CC] font-semibold text-lg"
      >
        {loading && appMode === 'PLAYING_ONLINE' && gameId !== "DEBUGROOM" && <span className="italic mr-2">(Syncing...)</span>}
        {renderMessage()}
      </div>

      {gameState.awaitingPromotionChoice && (appMode !== 'PLAYING_ONLINE' || gameState.currentPlayer === localPlayerRole) && (
        <div className="my-3 p-3 w-full max-w-md text-center bg-[#4A4238] rounded shadow">
          <p className="text-[#E0D8CC] mb-3">A Raven has reached a promotion zone!</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handlePromotionConfirm(true)}
              className="px-4 py-2 bg-[#6E6255] hover:bg-[#8C7062] text-[#E0D8CC] font-semibold rounded-lg shadow-md"
            >
              Yes, Promote
            </button>
            <button
              onClick={() => handlePromotionConfirm(false)}
              className="px-4 py-2 bg-[#5C5346] hover:bg-[#6E6255] text-[#E0D8CC] font-semibold rounded-lg shadow-md"
            >
              No, Keep as Raven
            </button>
          </div>
        </div>
      )}

      {selectedCapturedPieceForReinforcement && !gameState.awaitingReinforcementPlacement && (appMode !== 'PLAYING_ONLINE' || gameState.currentPlayer === localPlayerRole) && (
         <div className="my-3 p-3 w-full max-w-md text-center bg-[#4A4238] rounded shadow">
           <p className="text-[#E0D8CC] mb-3">Selected <span className="font-runic">{PIECE_SYMBOLS[selectedCapturedPieceForReinforcement.type]}</span> for reinforcement. Click an empty square to place it.</p>
         </div>
      )}


      {errorMessage && (appMode === 'PLAYING_ONLINE' || appMode === 'LOCAL_PLAY') && (
        <div className="mb-4 p-3 w-full max-w-md text-center bg-red-700 border border-red-900 rounded shadow text-white font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 w-full max-w-5xl">
        <section aria-labelledby="game-board-heading" className="w-full flex justify-center">
           <h2 id="game-board-heading" className="sr-only">Game Board</h2>
            <Board
              board={gameState.board}
              onSquareClick={handleSquareClick}
              selectedPiece={gameState.selectedPiece}
              validMoves={gameState.validMoves}
              playerColors={PIECE_COLORS}
              pieceSymbols={PIECE_SYMBOLS}
              centralThroneCoord={gameState.centralThroneCoord} 
              isCheckerboardPattern={isCheckerboardPattern}
              isInteractionDisabled={!isInteractionAllowedForLocalPlayer || isUiDisabled}
              currentPlayer={gameState.currentPlayer}
              gamePhase={gameState.gamePhase}
              onPieceDragStart={handlePieceDragStart}
              onPieceDragEnd={handlePieceDragEnd}
              onPieceDropOnSquare={handlePieceDropOnSquare}
              boardRows={gameState.boardRows} 
              boardCols={gameState.boardCols}
              isReinforcementMode={!!gameState.awaitingReinforcementPlacement}
            />
        </section>

        <div className="flex flex-col items-center w-full mt-2 space-y-3">
            <div className="flex flex-col sm:flex-row justify-center items-center w-full gap-3">
              <ResetControls
                onReset={appMode === 'PLAYING_ONLINE' ? handleLeaveGame : resetLocalGame}
                buttonText={appMode === 'PLAYING_ONLINE' ? 'Leave Game' : 'Reset Game'}
                disabled={isUiDisabled}
              />
              {(appMode === 'PLAYING_ONLINE' || appMode === 'LOCAL_PLAY') && (
                <button
                  onClick={appMode === 'PLAYING_ONLINE' ? handleLeaveGame : handleBackToMainMenu}
                  className="px-4 sm:px-5 py-2 bg-[#4A4238] hover:bg-[#5C5346] text-[#E0D8CC] font-semibold rounded-lg shadow-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#8C7062] focus:ring-opacity-75 font-medieval whitespace-nowrap text-sm"
                  aria-label="Back to Main Menu"
                  disabled={isUiDisabled}
                >
                  Main Menu
                </button>
              )}
            </div>
            
            {/* Settings Toggles */}
            <div className="flex justify-center w-full">
              <button
                onClick={toggleSecureThroneRequired}
                className={`flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none ${appMode === 'PLAYING_ONLINE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={gameState.isSecureThroneRequired}
                title={gameState.isSecureThroneRequired ? "Throne safety: REQUIRED (Must be clear to win)" : "Throne safety: NOT REQUIRED (Can win on threatened Throne)"}
                disabled={isUiDisabled || appMode === 'PLAYING_ONLINE'}
              >
                <span>Secure Throne for Victory</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${gameState.isSecureThroneRequired ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full transform transition-transform duration-200 ease-in-out ${gameState.isSecureThroneRequired ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>
             <div className="flex justify-center w-full">
              <button
                onClick={toggle5ColumnMode}
                className={`flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none ${appMode === 'PLAYING_ONLINE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={is5ColumnModeActive}
                title={is5ColumnModeActive ? "Switch to 7-column mode" : "Switch to 5-column mode"}
                disabled={isUiDisabled || appMode === 'PLAYING_ONLINE'}
              >
                <span>5-Column Mode</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${is5ColumnModeActive ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full transform transition-transform duration-200 ease-in-out ${is5ColumnModeActive ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>
            <div className="flex justify-center w-full">
              <button
                onClick={toggleCheckerboardPattern}
                className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none"
                aria-pressed={isCheckerboardPattern}
                title={isCheckerboardPattern ? "Switch to plain board" : "Switch to checkered board"}
                disabled={isUiDisabled}
              >
                <span>Checkered board</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${isCheckerboardPattern ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full transform transition-transform duration-200 ease-in-out ${isCheckerboardPattern ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>


            <div className="flex flex-col items-center w-full">
                <button
                    onClick={toggleRules}
                    className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none"
                    aria-expanded={showRules}
                    aria-controls="rules-guide-content"
                    disabled={isUiDisabled}
                >
                    <span>Rules</span>
                    <span className={`transform transition-transform duration-200 ease-in-out ${showRules ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </button>

                {showRules && (
                    <section id="rules-guide-content" aria-labelledby="rules-guide-heading" className="w-full max-w-xl p-4 bg-[#4A4238] border border-[#5C5346] rounded shadow text-[#E0D8CC] text-base mt-1">
                    <h3 id="rules-guide-heading" className="text-xl font-bold text-[#E0D8CC] mb-3 text-center font-medieval">Rules</h3>
                    <div className="space-y-3 text-[#D1C7B8]">
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Victory Conditions</h4>
                        <ul className="list-disc list-outside ml-5 space-y-1">
                            <li>Move your Jarl (<span className="font-runic">{PIECE_SYMBOLS[PieceType.JARL]}</span>) onto the Central Throne (marked ♦ at {String.fromCharCode(65 + gameState.centralThroneCoord.col)}{gameState.boardRows - gameState.centralThroneCoord.row}), or</li>
                            <li>Capture the enemy Jarl.</li>
                        </ul>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">General Rule</h4>
                        <p>All pieces capture by displacement: move into an enemy-occupied square to capture it.</p>
                        </div>
                         <div>
                            <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Jarl & Throne Safety (Toggle: Secure Throne for Victory)</h4>
                            <ul className="list-disc list-outside ml-5 space-y-1">
                                <li><strong>Jarl Field Safety (Always Permissive):</strong> Your Jarl can always move into any non-Throne field square, even if that square is under attack by an opponent (i.e., willingly move into 'check').</li>
                                <li><strong>Throne Safety (Toggleable, Default: ON - Required):</strong>
                                    <ul className="list-disc list-outside ml-4 mt-1">
                                      <li>When ON: The Central Throne square must be safe (not under attack by an opponent) for your Jarl to move onto it and win.</li>
                                      <li>When OFF: Your Jarl *can* move onto the Central Throne and win even if the Throne square is under attack.</li>
                                    </ul>
                                </li>
                                <li>This "Secure Throne for Victory" rule is set by the host for online games. For local games, it can be toggled in settings (resets game).</li>
                            </ul>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-2 font-medieval">Piece Types</h4>
                        <div className="space-y-2">
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Jarl (<span className="font-runic">{PIECE_SYMBOLS[PieceType.JARL]}</span>)</h5>
                            <ul className="list-disc list-outside ml-5">
                                <li>Moves 1 square in any direction (orthogonal or diagonal). Can move into 'check' on the field. Throne move subject to "Secure Throne for Victory" rule.</li>
                            </ul>
                            </div>
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Hirdman (<span className="font-runic">{PIECE_SYMBOLS[PieceType.HIRDMAN]}</span>)</h5>
                            <ul className="list-disc list-outside ml-5 space-y-1">
                                <li>Moves 1 square orthogonally (up, down, left, or right) to an empty square.</li>
                                <li>Captures by moving 1 square orthogonally (up, down, left, or right) into an enemy-occupied square.</li>
                            </ul>
                            </div>
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Raven (<span className="font-runic">{PIECE_SYMBOLS[PieceType.RAVEN]}</span>) - Standard</h5>
                            <ul className="list-disc list-outside ml-5 space-y-1">
                                <li>Slides diagonally any number of empty squares.</li>
                                <li>May jump over one adjacent piece (friend or foe) diagonally to land on the empty square beyond. This jump is a full move and does not capture the jumped piece.</li>
                                <li>**Promotion:** If a South player's Raven ends its move on North's starting rows (rows {gameState.boardRows} or {gameState.boardRows-1}), or a North player's Raven ends its move on South's starting rows (rows 1 or 2), the player may choose to promote it to a Rook Raven. These rows are marked with a subtle dark overlay. This choice ends the turn.</li>
                            </ul>
                            </div>
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Raven (<span className="font-runic">{PIECE_SYMBOLS[PieceType.ROOK_RAVEN]}</span>) - Rook Type (Promoted)</h5>
                            <ul className="list-disc list-outside ml-5">
                                <li>Slides orthogonally (like a chess Rook) any number of empty squares.</li>
                                <li>Captures by landing on an enemy piece.</li>
                                <li>Acquired by promoting a Standard Raven.</li>
                            </ul>
                            </div>
                        </div>
                        </div>
                         <div>
                            <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Promotion Zones</h4>
                            <ul className="list-disc list-outside ml-5">
                                <li>The two starting rows for each player (rows 1 & 2 for South player, corresponding to board rows {gameState.boardRows-1} & {gameState.boardRows-2}; and rows {gameState.boardRows-1} & {gameState.boardRows} for North player, corresponding to board rows 1 & 0) serve as Promotion Zones. These are marked with a subtle dark overlay.</li>
                                <li>If a player's Standard Raven finishes its move on one of the opponent's starting rows, its owner may choose to promote it to a Rook Raven.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Reinforcements</h4>
                            <ul className="list-disc list-outside ml-5 space-y-1">
                                <li>When a piece is captured, it is added to the capturing player's collection of captured pieces.</li>
                                <li>A player may choose to spend their entire turn to reinforce.
                                    If they have captured pieces, a "Reinforce" button will appear.
                                </li>
                                <li>After initiating reinforcement, the player selects one of their captured pieces.</li>
                                <li>The selected piece can then be placed on any empty square on the board. This completes the turn.</li>
                                <li>The placed piece is now controlled by the player who reinforced it, regardless of its original player.</li>
                            </ul>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Board Setup ({gameState.boardRows}x{gameState.boardCols})</h4>
                        <ul className="list-disc list-outside ml-5 space-y-1">
                            <li>Board: {gameState.boardRows} rows high, {gameState.boardCols} columns wide. Coordinates A1-{String.fromCharCode(65+gameState.boardCols-1)}{gameState.boardRows}.</li>
                            <li>A single Central Throne (♦) is at {String.fromCharCode(65 + gameState.centralThroneCoord.col)}{gameState.boardRows - gameState.centralThroneCoord.row}.</li>
                            <li>Players: South (Light, pieces start on rows 1-2) and North (Dark, pieces start on rows {gameState.boardRows-1}-{gameState.boardRows}). South plays first.</li>
                            {is5ColumnModeActive ? (
                                <>
                                <li>Jarls: C1 (South), C9 (North).</li>
                                <li>Hirdmen (3 per player): B8, C8, D8 (North); B2, C2, D2 (South).</li>
                                <li>Ravens (4 Standard Ravens per player): A9, E9, A8, E8 (North); A1, E1, A2, E2 (South).</li>
                                </>
                            ) : (
                                <>
                                <li>Jarls: D1 (South), D9 (North).</li>
                                <li>Hirdmen (5 per player): B8, C8, D8, E8, F8 (North); B2, C2, D2, E2, F2 (South).</li>
                                <li>Ravens (4 Standard Ravens per player): A9, B9, F9, G9 (North); A1, B1, F1, G1 (South).</li>
                                </>
                            )}
                        </ul>
                        </div>
                    </div>
                    </section>
                )}
            </div>

            {(appMode === 'LOCAL_PLAY' || appMode === 'PLAYING_ONLINE') && gameState.gamePhase === GamePhase.PLAYING && (
              <div className="w-full max-w-md mt-4 p-3 bg-[#3C3832] rounded shadow">
                <h4 className="text-md font-semibold text-[#E0D8CC] mb-2 text-center font-medieval">Captured Pieces</h4>
                {(gameState.currentPlayer === Player.SOUTH || appMode === 'LOCAL_PLAY') && (
                    <div className="mb-2">
                        <p className="text-sm text-[#C0B6A8]">{gameState.playerSouthName || Player.SOUTH}'s Captures ({gameState.capturedBySouth.length}):</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {gameState.capturedBySouth.map(p => (
                                <button 
                                    key={`capS-${p.id}`}
                                    title={`Select ${p.type} to reinforce`}
                                    onClick={() => handleSelectCapturedPieceForReinforcement(p)}
                                    disabled={gameState.currentPlayer !== Player.SOUTH || isUiDisabled || selectedCapturedPieceForReinforcement !== null}
                                    className={`font-runic text-xl p-1 rounded 
                                        ${PIECE_COLORS[p.player === Player.SOUTH ? Player.NORTH : Player.SOUTH].base} 
                                        ${PIECE_COLORS[p.player === Player.SOUTH ? Player.NORTH : Player.SOUTH].text}
                                        ${(gameState.currentPlayer === Player.SOUTH && !isUiDisabled && !selectedCapturedPieceForReinforcement) ? 'cursor-pointer hover:opacity-75' : 'cursor-not-allowed opacity-50'}`}
                                >
                                    {PIECE_SYMBOLS[p.type]}
                                </button>
                            ))}
                        </div>
                        {gameState.currentPlayer === Player.SOUTH && gameState.capturedBySouth.length > 0 && !selectedCapturedPieceForReinforcement && !gameState.awaitingReinforcementPlacement && (
                           <button onClick={handleInitiateReinforcement} disabled={isUiDisabled} className="mt-2 text-xs">Initiate Reinforce</button>
                        )}
                    </div>
                )}
                {(gameState.currentPlayer === Player.NORTH || appMode === 'LOCAL_PLAY') && (
                    <div>
                        <p className="text-sm text-[#C0B6A8]">{gameState.playerNorthName || Player.NORTH}'s Captures ({gameState.capturedByNorth.length}):</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                             {gameState.capturedByNorth.map(p => (
                                <button 
                                    key={`capN-${p.id}`}
                                    title={`Select ${p.type} to reinforce`}
                                    onClick={() => handleSelectCapturedPieceForReinforcement(p)}
                                    disabled={gameState.currentPlayer !== Player.NORTH || isUiDisabled || selectedCapturedPieceForReinforcement !== null}
                                    className={`font-runic text-xl p-1 rounded
                                        ${PIECE_COLORS[p.player === Player.SOUTH ? Player.NORTH : Player.SOUTH].base}
                                        ${PIECE_COLORS[p.player === Player.SOUTH ? Player.NORTH : Player.SOUTH].text}
                                        ${(gameState.currentPlayer === Player.NORTH && !isUiDisabled && !selectedCapturedPieceForReinforcement) ? 'cursor-pointer hover:opacity-75' : 'cursor-not-allowed opacity-50'}`}
                                >
                                    {PIECE_SYMBOLS[p.type]}
                                </button>
                            ))}
                        </div>
                         {gameState.currentPlayer === Player.NORTH && gameState.capturedByNorth.length > 0 && !selectedCapturedPieceForReinforcement && !gameState.awaitingReinforcementPlacement &&(
                           <button onClick={handleInitiateReinforcement} disabled={isUiDisabled} className="mt-2 text-xs">Initiate Reinforce</button>
                        )}
                    </div>
                )}
              </div>
            )}


        </div>
      </div>
    </div>
  );
};

export default App;
