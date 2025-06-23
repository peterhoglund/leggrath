
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Unsubscribe } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

import { BoardState, Player, PieceOnBoard, GameState, GamePhase, Coordinate, PieceType, Move, AppMode, FirestoreGameDoc } from './types';
import {
    NORTH_THRONE_COORD,
    SOUTH_THRONE_COORD,
    INITIAL_PIECES_SETUP,
    PIECE_SYMBOLS,
    PIECE_COLORS,
    BOARD_SIZE,
    PORTAL_A_COORD,
    PORTAL_B_COORD
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
  const [gameState, setGameState] = useState<GameState>(getInitialLocalGameState());
  const [showRules, setShowRules] = useState(false);
  const [isCheckerboardPattern, setIsCheckerboardPattern] = useState(false);
  const [isPortalModeActive, setIsPortalModeActive] = useState(true);
  const [showDebugFeatures, setShowDebugFeatures] = useState<boolean>(false);

  const [playerName, setPlayerName] = useState<string>('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [localPlayerRole, setLocalPlayerRole] = useState<Player | null>(null);
  const [firestoreGameDoc, setFirestoreGameDoc] = useState<FirestoreGameDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId] = useState<string>(generateUniqueId());
  const [copyNotification, setCopyNotification] = useState<{ text: string; visible: boolean }>({ text: '', visible: false });
  const copyRoomNameButtonRef = useRef<HTMLButtonElement>(null);

  // State for custom drag image
  const [draggedPieceImage, setDraggedPieceImage] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a hidden div for the drag image source container
    const imgContainer = document.createElement('div');
    imgContainer.style.position = 'absolute';
    imgContainer.style.top = '-1000px'; // Keep it off-screen
    imgContainer.style.opacity = '0.75'; // Semi-transparent, applies to the container & its content
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
          setFirestoreGameDoc(gameData);
          setGameState(prev => ({
            ...gameData.gameState,
            selectedPiece: prev.selectedPiece && prev.selectedPiece.player === gameData.gameState.currentPlayer ? prev.selectedPiece : null,
            validMoves: prev.selectedPiece && prev.selectedPiece.player === gameData.gameState.currentPlayer ? prev.validMoves : [],
          }));

          if (gameData.status === 'aborted' && gameData.gameState.winner === null) {
             setGameState(prev => ({
                ...prev,
                gamePhase: GamePhase.GAME_OVER,
                winner: localPlayerRole,
                winReason: `${localPlayerRole} wins! Opponent left the game.`,
                message: `${localPlayerRole} wins! Opponent left the game.`,
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

  function getInitialLocalGameState(): GameState {
    const initialBoard = getInitialBoard(INITIAL_PIECES_SETUP);
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
    };
  }

  const resetLocalGame = useCallback(() => {
    setGameState(getInitialLocalGameState());
    setShowRules(false);
  }, []);

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
    resetLocalGame();
    setErrorMessage(null);
    setLoading(false);
    setCopyNotification({ text: '', visible: false });
  }

  const handleCreateGame = async (pName: string, roomName: string) => {
    setLoading(true);
    setErrorMessage(null);
    setPlayerName(pName);
    const normalizedRoomName = roomName.trim().toUpperCase();
    setGameId(normalizedRoomName);

    try {
      const gameDoc = await createGameInFirestore(normalizedRoomName, sessionId, pName);
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
            const finalGameState = {
              ...currentDoc.gameState,
              gamePhase: GamePhase.GAME_OVER,
              winner: winner,
              winReason: `${winner} wins! Opponent left the game.`,
              message: `${winner} wins! Opponent left the game.`,
              lastMoveTimestamp: Timestamp.now(),
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
        ...getInitialLocalGameState(),
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

  const endTurn = useCallback((boardAfterMove: BoardState, moverPlayer: Player, pieceThatMoved: PieceOnBoard | null, currentGameState: GameState): GameState => {
    const opponent = moverPlayer === Player.NORTH ? Player.SOUTH : Player.NORTH;
    let gameIsOver = false;
    let winner: Player | null = null;
    let localWinReason = "";

    if (pieceThatMoved && pieceThatMoved.type === PieceType.JARL) {
      const targetThrone = moverPlayer === Player.NORTH ? SOUTH_THRONE_COORD : NORTH_THRONE_COORD;
      if (isCoordinateEqual({row: pieceThatMoved.row, col: pieceThatMoved.col}, targetThrone)) {
        gameIsOver = true;
        winner = moverPlayer;
        localWinReason = `wins by reaching the opponent's Throne!`;
      }
    }

    if (!gameIsOver) {
      let opponentJarlFound = false;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const piece = boardAfterMove[r].squares[c];
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

    const moverDisplayName = moverPlayer === Player.SOUTH ? (currentGameState.playerSouthName || Player.SOUTH) : (currentGameState.playerNorthName || Player.NORTH);
    const currentTimestamp = Timestamp.now();

    if (gameIsOver) {
        const finalMessage = `${moverDisplayName} (${moverPlayer}) ${localWinReason}`;
        return {
            ...currentGameState, board: boardAfterMove, gamePhase: GamePhase.GAME_OVER, winner: winner,
            winReason: finalMessage, message: finalMessage,
            selectedPiece: null, validMoves: [],
            lastMoveTimestamp: currentTimestamp,
        };
    }

    const nextPlayer = opponent;
    const nextTurnNumber = moverPlayer === Player.NORTH ? currentGameState.turnNumber + 1 : currentGameState.turnNumber;
    const nextPlayerDisplayName = nextPlayer === Player.SOUTH ? (currentGameState.playerSouthName || Player.SOUTH) : (currentGameState.playerNorthName || Player.NORTH);
    const nextMessage = `Turn ${nextTurnNumber}: ${nextPlayerDisplayName} (${nextPlayer})'s move. Select a piece.`;

    return {
      ...currentGameState, board: boardAfterMove, currentPlayer: nextPlayer, turnNumber: nextTurnNumber,
      selectedPiece: null, validMoves: [],
      gamePhase: GamePhase.PLAYING,
      message: nextMessage,
      lastMoveTimestamp: currentTimestamp,
    };
  }, []);

  const executeMove = useCallback(async (move: Move) => {
    if (appMode === 'PLAYING_ONLINE' && (!gameId || localPlayerRole !== gameState.currentPlayer)) {
      console.warn("Not your turn or not in online game.");
      return;
    }

    let newBoard = gameState.board.map(rowData => ({
      squares: rowData.squares.map(sq => sq ? {...sq} : null)
    }));

    const movingPieceOriginal = newBoard[move.from.row].squares[move.from.col];
    if (!movingPieceOriginal) return;

    let finalPieceState: PieceOnBoard;
    let moveMessage = "";

    const moverDisplayName = movingPieceOriginal.player === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);

    if (move.isTeleport) {
      const teleportingPiece: PieceOnBoard = {...movingPieceOriginal, row: move.to.row, col: move.to.col };
      newBoard[move.to.row].squares[move.to.col] = teleportingPiece;
      newBoard[move.from.row].squares[move.from.col] = null;
      finalPieceState = teleportingPiece;
      moveMessage = `${moverDisplayName} (${movingPieceOriginal.player}) teleports ${PIECE_SYMBOLS[movingPieceOriginal.type]}!`;
    } else {
      const movedPiece: PieceOnBoard = { ...movingPieceOriginal, row: move.to.row, col: move.to.col };
      newBoard[move.to.row].squares[move.to.col] = movedPiece;
      newBoard[move.from.row].squares[move.from.col] = null;
      finalPieceState = movedPiece;
    }

    const newGameStateAfterMoveOnly = { ...gameState, board: newBoard, message: moveMessage || gameState.message };
    const newGameStateAfterTurnEnd = endTurn(newBoard, finalPieceState.player, finalPieceState, newGameStateAfterMoveOnly);

    if (appMode === 'PLAYING_ONLINE' && gameId && gameId !== "DEBUGROOM") {
      try {
        setLoading(true);
        await updateGameStateInFirestore(gameId, newGameStateAfterTurnEnd);
      } catch (error) {
        console.error("Error updating game state:", error);
        setErrorMessage("Failed to sync move. Please check connection.");
      }
    } else {
      setGameState(newGameStateAfterTurnEnd);
    }
  }, [gameState, endTurn, appMode, gameId, localPlayerRole, gameState.playerSouthName, gameState.playerNorthName]);

  const deselectPiece = useCallback(() => {
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
  }, [gameState.currentPlayer, gameState.playerNorthName, gameState.playerSouthName, gameState.turnNumber]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.gamePhase === GamePhase.GAME_OVER) return;
    if (appMode === 'PLAYING_ONLINE' && localPlayerRole !== gameState.currentPlayer) {
      const currentTurnPlayerName = gameState.currentPlayer === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);
      setGameState(prev => ({ ...prev, message: `Waiting for ${currentTurnPlayerName} (${gameState.currentPlayer}) to move.`}));
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
          const newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, isPortalModeActive, PORTAL_A_COORD, PORTAL_B_COORD);
          setGameState(prev => ({
            ...prev,
            selectedPiece: clickedSquareContent,
            validMoves: newValidMoves,
            message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). No valid moves.`
          }));
        }
      } else {
        deselectPiece();
      }
    } else if (clickedSquareContent && clickedSquareContent.player === gameState.currentPlayer) {
      const newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, isPortalModeActive, PORTAL_A_COORD, PORTAL_B_COORD);
      setGameState(prev => ({
        ...prev,
        selectedPiece: clickedSquareContent,
        validMoves: newValidMoves,
        message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). No valid moves.`
      }));
    }
  }, [gameState, executeMove, appMode, localPlayerRole, isPortalModeActive, deselectPiece]);


  const handlePieceDragStart = useCallback((piece: PieceOnBoard, event: React.DragEvent) => {
    if (gameState.gamePhase === GamePhase.GAME_OVER || 
        (appMode === 'PLAYING_ONLINE' && localPlayerRole !== piece.player) ||
        piece.player !== gameState.currentPlayer) {
      event.preventDefault();
      return;
    }

    const newValidMoves = getAllValidMovesForPiece(piece, gameState.board, isPortalModeActive, PORTAL_A_COORD, PORTAL_B_COORD);
    setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves: newValidMoves,
      message: newValidMoves.length > 0 ? `Dragging ${PIECE_SYMBOLS[piece.type]}. Choose destination.` : `Dragging ${PIECE_SYMBOLS[piece.type]}. No valid moves.`
    }));
    event.dataTransfer.setData("text/plain", JSON.stringify({ row: piece.row, col: piece.col, id: piece.id }));
    event.dataTransfer.effectAllowed = "move";

    if (draggedPieceImage && event.target instanceof HTMLElement) {
        // Create a visual representation of the piece for the drag image
        const pieceElementVisual = document.createElement('div');
        const colors = PIECE_COLORS[piece.player];
        const symbol = PIECE_SYMBOLS[piece.type];
        const isJarl = piece.type === PieceType.JARL;
        const baseSizeClass = isJarl ? 'w-11 h-11 md:w-14 md:h-14' : 'w-9 h-9 md:w-11 md:h-11';
        const symbolSizeClass = isJarl ? 'text-[1.8rem] md:text-[2.2rem]' : 'text-[1.65rem] md:text-[1.8rem]';

        pieceElementVisual.className = `
          ${colors.base} border-2 ${colors.border} ${piece.type !== PieceType.RAVEN ? 'rounded-full' : ''}
          flex items-center justify-center font-bold shadow-md select-none
          ${baseSizeClass} ${colors.text} font-runic ${symbolSizeClass}
        `;
        pieceElementVisual.textContent = symbol;
        
        // Clear previous content from the off-screen container and append the new piece visual
        draggedPieceImage.innerHTML = ''; 
        draggedPieceImage.appendChild(pieceElementVisual);
        
        // Calculate the cursor's offset relative to the original clicked piece element
        const rect = event.target.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        // Set the drag image to be the container (which now holds pieceElementVisual)
        // and use the calculated offsets. The container has opacity 0.75.
        event.dataTransfer.setDragImage(draggedPieceImage, offsetX, offsetY);
    }

  }, [gameState, appMode, localPlayerRole, isPortalModeActive, draggedPieceImage]);

  const handlePieceDropOnSquare = useCallback((targetRow: number, targetCol: number, event: React.DragEvent) => {
    if (!gameState.selectedPiece) return; 

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
  }, [gameState.selectedPiece, gameState.validMoves, executeMove, deselectPiece]);

  const handlePieceDragEnd = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.dropEffect === 'none' && gameState.selectedPiece) {
      deselectPiece();
    }
  }, [gameState.selectedPiece, deselectPiece]);


  const toggleRules = () => setShowRules(prev => !prev);
  const toggleCheckerboardPattern = () => setIsCheckerboardPattern(prev => !prev);
  const togglePortalMode = () => {
    setIsPortalModeActive(prev => !prev);
    deselectPiece(); 
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
      const winnerName = gameState.winner === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);
      const winReasonWithName = gameState.winReason?.replace(gameState.winner, `${winnerName} (${gameState.winner})`) || `${winnerName} (${gameState.winner}) wins!`;

      const parts = winReasonWithName.split(new RegExp(`(${winnerName}\\s*\\(${gameState.winner}\\))`, 'g'));
      return (
        <>
          {parts.map((part, index) =>
            (index % 2 === 1) ? (
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

    const southPlayerDisplayName = gameState.playerSouthName || Player.SOUTH;
    const northPlayerDisplayName = gameState.playerNorthName || Player.NORTH;

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

  const isInteractionAllowedForLocalPlayer = (appMode === 'LOCAL_PLAY' || localPlayerRole === gameState.currentPlayer) && gameState.gamePhase !== GamePhase.GAME_OVER;

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
            </div>)}

            <div className="flex-1 text-center">
                 <h1 className="text-5xl font-bold text-[#E0D8CC] font-medieval title">leggrað</h1>
                 <p className="text-xl font-runic text-[#C0B6A8] mt-1 title">ᛚᚴᚴᚱᛅᚦ</p>
            </div>
             {appMode === 'PLAYING_ONLINE' && gameId && (
                <div className="text-right text-sm text-[#C0B6A8] font-medieval w-1/3 truncate">Room: {gameId}</div>
            )}
            {appMode === 'LOCAL_PLAY' && ( <div className="w-1/3 flex items-center justify-end">
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
              northThroneCoord={NORTH_THRONE_COORD}
              southThroneCoord={SOUTH_THRONE_COORD}
              portalACoord={PORTAL_A_COORD}
              portalBCoord={PORTAL_B_COORD}
              isCheckerboardPattern={isCheckerboardPattern}
              isPortalModeActive={isPortalModeActive}
              isInteractionDisabled={!isInteractionAllowedForLocalPlayer}
              currentPlayer={gameState.currentPlayer}
              gamePhase={gameState.gamePhase}
              onPieceDragStart={handlePieceDragStart}
              onPieceDragEnd={handlePieceDragEnd}
              onPieceDropOnSquare={handlePieceDropOnSquare}
            />
        </section>

        <div className="flex flex-col items-center w-full mt-2 space-y-3">
            <div className="flex flex-col sm:flex-row justify-center items-center w-full gap-3">
              <ResetControls
                onReset={appMode === 'PLAYING_ONLINE' ? handleLeaveGame : resetLocalGame}
                buttonText={appMode === 'PLAYING_ONLINE' ? 'Leave Game' : 'Reset Game'}
              />
              {(appMode === 'PLAYING_ONLINE' || appMode === 'LOCAL_PLAY') && (
                <button
                  onClick={appMode === 'PLAYING_ONLINE' ? handleLeaveGame : handleBackToMainMenu}
                  className="px-4 sm:px-5 py-2 bg-[#4A4238] hover:bg-[#5C5346] text-[#E0D8CC] font-semibold rounded-lg shadow-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#8C7062] focus:ring-opacity-75 font-medieval whitespace-nowrap text-sm"
                  aria-label="Back to Main Menu"
                >
                  Main Menu
                </button>
              )}
            </div>

            <div className="flex justify-center w-full">
              <button
                onClick={toggleCheckerboardPattern}
                className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none"
                aria-pressed={isCheckerboardPattern}
                title={isCheckerboardPattern ? "Switch to plain board" : "Switch to checkered board"}
              >
                <span>Checkered board</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${isCheckerboardPattern ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full transform transition-transform duration-200 ease-in-out ${isCheckerboardPattern ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>

            <div className="flex justify-center w-full">
              <button
                onClick={togglePortalMode}
                className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none shadow-none"
                aria-pressed={isPortalModeActive}
                title={isPortalModeActive ? "Deactivate Portals" : "Activate Portals"}
              >
                <span>Portal Mode</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${isPortalModeActive ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full transform transition-transform duration-200 ease-in-out ${isPortalModeActive ? 'translate-x-[18px]' : 'translate-x-0'}`}
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
                            <li>Move your Jarl (<span className="font-runic">{PIECE_SYMBOLS[PieceType.JARL]}</span>) onto the opponent’s Throne (center space on their back rank), or</li>
                            <li>Capture the enemy Jarl.</li>
                        </ul>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">General Rule</h4>
                        <p>All pieces capture by displacement: move into an enemy-occupied square to capture it.</p>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-2 font-medieval">Piece Types</h4>
                        <div className="space-y-2">
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Jarl (<span className="font-runic">{PIECE_SYMBOLS[PieceType.JARL]}</span>)</h5>
                            <ul className="list-disc list-outside ml-5">
                                <li>Moves 1 square in any direction (orthogonal or diagonal).</li>
                                <li>Captures by displacement.</li>
                            </ul>
                            </div>
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Hirdman (<span className="font-runic">{PIECE_SYMBOLS[PieceType.HIRDMAN]}</span>)</h5>
                            <ul className="list-disc list-outside ml-5">
                                <li>Moves 1 square orthogonally (up, down, left, right).</li>
                                <li>Captures by displacement.</li>
                            </ul>
                            </div>
                            <div>
                            <h5 className="font-semibold text-[#DCCEA8] font-medieval">Raven (<span className="font-runic">{PIECE_SYMBOLS[PieceType.RAVEN]}</span>)</h5>
                            <ul className="list-disc list-outside ml-5">
                                <li>Slides diagonally any number of empty squares.</li>
                                <li>Captures by landing on an enemy piece.</li>
                                <li>May also jump over one adjacent piece (friend or foe) diagonally to land on the empty square beyond.
                                <ul className="list-[circle] list-outside ml-6 mt-1">
                                    <li>This jump is a full move.</li>
                                    <li>It does not capture the piece that is jumped over.</li>
                                </ul>
                                </li>
                            </ul>
                            </div>
                        </div>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Portals (Optional Rule)</h4>
                            <ul className="list-disc list-outside ml-5 space-y-1">
                                <li>Two Portal squares are located at the ends of the center row (▶).</li>
                                <li>When Portal Mode is active (toggled by the switch below the board):
                                    <ul className="list-[circle] list-outside ml-6 mt-1 space-y-1">
                                        <li>Any piece (Jarl, Hirdman, or Raven) that ends its normal move on a Portal square may teleport to the other Portal square in the next turn. Teleporting ends the turn.</li>
                                        <li>If the destination Portal is occupied by an opponent's piece, that piece is captured.</li>
                                        <li>A piece cannot teleport if the destination Portal is occupied by a friendly piece.</li>
                                    </ul>
                                </li>
                                <li>If Portal Mode is inactive, these squares act as normal board squares.</li>
                            </ul>
                        </div>
                        <div>
                        <h4 className="text-lg font-semibold text-[#E0D8CC] mb-1 font-medieval">Board Setup</h4>
                        <ul className="list-disc list-outside ml-5 space-y-1">
                            <li>Each player has a Throne at the center of their back rank.</li>
                            <li>South (Light) plays first.</li>
                            <li>North (Dark) moves second.</li>
                        </ul>
                        </div>
                    </div>
                    </section>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
