
import React, { useState, useEffect, useCallback } from 'react';
import type { Unsubscribe } from "firebase/firestore";

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
  generateUniqueId, // Still used for player session ID
  setGameStatus,
} from './firebase';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('MAIN_MENU'); // Start with MAIN_MENU
  const [gameState, setGameState] = useState<GameState>(getInitialLocalGameState());
  const [showRules, setShowRules] = useState(false);
  const [isCheckerboardPattern, setIsCheckerboardPattern] = useState(false);
  const [isPortalModeActive, setIsPortalModeActive] = useState(true);

  // Multiplayer specific state
  const [playerName, setPlayerName] = useState<string>('');
  const [gameId, setGameId] = useState<string | null>(null); // This will be the Game Room Name
  const [localPlayerRole, setLocalPlayerRole] = useState<Player | null>(null);
  const [firestoreGameDoc, setFirestoreGameDoc] = useState<FirestoreGameDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId] = useState<string>(generateUniqueId());

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
          setErrorMessage("Game not found or an error occurred.");
          handleLeaveGame(); 
        }
        setLoading(false);
      });
    } else if (appMode === 'WAITING_FOR_OPPONENT' && gameId) {
       unsubscribe = getGameStream(gameId, (gameData) => {
        if (gameData) {
          setFirestoreGameDoc(gameData);
          if (gameData.status === 'active' && gameData.guestPlayerId) {
            setGameState(gameData.gameState);
            setAppMode('PLAYING_ONLINE');
            setLoading(false);
          } else if (gameData.status === 'aborted') {
             setErrorMessage("Game was aborted by host.");
             handleLeaveGame(); // Back to main menu
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
      message: `Turn 1: ${initialPlayer}'s move. Select a piece.`,
      playerSouthName: "South", // Default for local
      playerNorthName: "North", // Default for local
    };
  }

  const resetLocalGame = useCallback(() => {
    setGameState(getInitialLocalGameState());
    setShowRules(false);
  }, []);

  const handleGoToMultiplayerSetup = () => {
    setErrorMessage(null); // Clear previous errors
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
  }

  const handleCreateGame = async (pName: string, roomName: string) => {
    setLoading(true);
    setErrorMessage(null);
    setPlayerName(pName);
    const normalizedRoomName = roomName.trim().toUpperCase();
    setGameId(normalizedRoomName); 

    try {
      const gameDoc = await createGameInFirestore(normalizedRoomName, sessionId, pName);
      setLocalPlayerRole(Player.SOUTH); // Creator is South
      setFirestoreGameDoc(gameDoc);
      setGameState(gameDoc.gameState);
      setAppMode('WAITING_FOR_OPPONENT');
    } catch (error) {
      console.error("Error creating game:", error);
      setErrorMessage("Failed to create game. The room name might be taken or invalid, or a data error occurred. Please try again.");
      setGameId(null); // Clear gameId on error
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
        setLocalPlayerRole(Player.NORTH); // Joiner is North
        setFirestoreGameDoc(gameDoc);
        setGameState(gameDoc.gameState); 
        setAppMode('PLAYING_ONLINE');
      } else {
        setErrorMessage("Could not join game. Check Game Room Name or game may be full/unavailable.");
        setGameId(null); // Clear gameId if join failed
        setLoading(false);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      setErrorMessage("Failed to join game. An error occurred.");
      setGameId(null); // Clear gameId on error
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

    if (currentGameId && (currentAppMode === 'PLAYING_ONLINE' || currentAppMode === 'WAITING_FOR_OPPONENT')) {
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
          const piece = boardAfterMove[r].squares[c]; // Access .squares
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

    if (gameIsOver) {
        const finalMessage = `${moverDisplayName} (${moverPlayer}) ${localWinReason}`;
        return {
            ...currentGameState, board: boardAfterMove, gamePhase: GamePhase.GAME_OVER, winner: winner,
            winReason: finalMessage, message: finalMessage,
            selectedPiece: null, validMoves: [], 
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
      message: nextMessage
    };
  }, []); 

  const executeMove = useCallback(async (move: Move) => {
    if (appMode === 'PLAYING_ONLINE' && (!gameId || localPlayerRole !== gameState.currentPlayer)) {
      console.warn("Not your turn or not in online game.");
      return;
    }

    // Deep copy of the board using the new RowData structure
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

    if (appMode === 'PLAYING_ONLINE' && gameId) {
      try {
        setLoading(true);
        await updateGameStateInFirestore(gameId, newGameStateAfterTurnEnd);
      } catch (error) {
        console.error("Error updating game state:", error);
        setErrorMessage("Failed to sync move. Please check connection.");
      } finally {
        // setLoading(false); // Firestore listener will set this
      }
    } else { 
      setGameState(newGameStateAfterTurnEnd);
    }

  }, [gameState, endTurn, appMode, gameId, localPlayerRole]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.gamePhase === GamePhase.GAME_OVER) return;
    if (appMode === 'PLAYING_ONLINE' && localPlayerRole !== gameState.currentPlayer) {
      const currentTurnPlayerName = gameState.currentPlayer === Player.SOUTH ? (gameState.playerSouthName || Player.SOUTH) : (gameState.playerNorthName || Player.NORTH);
      setGameState(prev => ({ ...prev, message: `Waiting for ${currentTurnPlayerName} (${gameState.currentPlayer}) to move.`}));
      return;
    }

    const clickedSquareContent = gameState.board[row].squares[col]; // Access .squares
    
    if (gameState.selectedPiece) {
      const move = gameState.validMoves.find(m => isCoordinateEqual(m.to, {row, col}) && isCoordinateEqual(m.from, {row: gameState.selectedPiece!.row, col: gameState.selectedPiece!.col}));
      if (move) {
        executeMove(move);
      } else if (clickedSquareContent && clickedSquareContent.player === gameState.currentPlayer) {
        let newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, isPortalModeActive, PORTAL_A_COORD, PORTAL_B_COORD);
        setGameState(prev => ({
          ...prev, selectedPiece: clickedSquareContent, validMoves: newValidMoves,
          message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). No valid moves.`
        }));
      } else { 
          setGameState(prev => ({ ...prev, selectedPiece: null, validMoves:[], message: "Invalid move. Click piece or valid target."}));
      }
    } else if (clickedSquareContent && clickedSquareContent.player === gameState.currentPlayer) {
       let newValidMoves = getAllValidMovesForPiece(clickedSquareContent, gameState.board, isPortalModeActive, PORTAL_A_COORD, PORTAL_B_COORD);
      setGameState(prev => ({
        ...prev, selectedPiece: clickedSquareContent, validMoves: newValidMoves,
        message: newValidMoves.length > 0 ? `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). Choose move.` : `Selected ${PIECE_SYMBOLS[clickedSquareContent.type]} at (${String.fromCharCode(65+col)}${BOARD_SIZE-row}). No valid moves.`
      }));
    }
  }, [gameState, executeMove, appMode, localPlayerRole, isPortalModeActive]);

  const toggleRules = () => setShowRules(prev => !prev);
  const toggleCheckerboardPattern = () => setIsCheckerboardPattern(prev => !prev);
  const togglePortalMode = () => {
    setIsPortalModeActive(prev => !prev);
    setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }));
  };
  
  const currentPlayerHighlightClass = (player: Player) => {
    return player === Player.SOUTH ? 'bg-[#D8D1CC] text-[#373737]' : 'bg-[#373737] text-[#D8D1CC]';
  };

  const winnerHighlightClass = (winnerPlayer: Player | null) => {
    if (!winnerPlayer) return '';
    return winnerPlayer === Player.SOUTH ? 'bg-[#D8D1CC] text-[#373737] font-bold' : 'bg-[#373737] text-[#D8D1CC] font-bold';
  };

  const renderMessage = () => {
    if (!gameState.message) return null;
    let messageToRender = gameState.message;

    if (gameState.winner) {
      const winnerName = gameState.winner === Player.SOUTH ? (firestoreGameDoc?.gameState.playerSouthName || Player.SOUTH) : (firestoreGameDoc?.gameState.playerNorthName || Player.NORTH);
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
    
    const southPlayerDisplayName = (appMode === 'PLAYING_ONLINE' ? firestoreGameDoc?.gameState.playerSouthName : gameState.playerSouthName) || Player.SOUTH;
    const northPlayerDisplayName = (appMode === 'PLAYING_ONLINE' ? firestoreGameDoc?.gameState.playerNorthName : gameState.playerNorthName) || Player.NORTH;

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
            className="w-full py-3.5 text-xl"
          >
            Play Local Game
          </button>
          <button
            onClick={handleGoToMultiplayerSetup}
            className="w-full py-3.5 text-xl"
          >
            Play Online Multiplayer
          </button>
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-4xl font-medieval mb-4">Waiting for Opponent...</h1>
        <p className="text-xl font-medieval mb-2">Game Room: <strong className="font-runic text-2xl px-2 py-1 bg-[#4A4238] rounded">{gameId}</strong></p>
        <p className="text-lg text-[#C0B6A8]">Share this Room Name with your opponent to join.</p>
        {loading && <p className="mt-4 text-lg">Loading...</p>}
        {errorMessage && <p className="mt-4 text-red-400">{errorMessage}</p>}
         <button onClick={handleLeaveGame} className="mt-8 px-6 py-2.5 text-lg">
           Cancel Game
        </button>
      </div>
    );
  }

  const opponentDisplayName = localPlayerRole === Player.SOUTH ? 
                              (firestoreGameDoc?.guestPlayerName || (appMode === 'LOCAL_PLAY' ? "North" : "Opponent")) : 
                              (firestoreGameDoc?.hostPlayerName || (appMode === 'LOCAL_PLAY' ? "South" : "Opponent"));
  const localPlayerDisplayName = appMode === 'PLAYING_ONLINE' ? playerName : (localPlayerRole || gameState.currentPlayer);

  return (
    <div className="flex flex-col items-center min-h-screen p-4" role="main">
      <header className="mb-4 text-center w-full max-w-5xl">
        <div className="flex justify-between items-center w-full">
            {appMode === 'PLAYING_ONLINE' && localPlayerRole && (
                 <div className="text-left w-1/3">
                    <p className="text-sm text-[#C0B6A8] font-medieval truncate">You: <span className={currentPlayerHighlightClass(localPlayerRole)}>{localPlayerDisplayName} ({localPlayerRole})</span></p>
                    {opponentDisplayName && <p className="text-sm text-[#C0B6A8] font-medieval truncate">Opponent: {opponentDisplayName} ({localPlayerRole === Player.SOUTH ? Player.NORTH : Player.SOUTH})</p>}
                 </div>
            )}
            {appMode === 'LOCAL_PLAY' && (<div className="w-1/3"></div>)}

            <div className="flex-1 text-center">
                 <h1 className="text-5xl font-bold text-[#E0D8CC] font-medieval title">leggrað</h1>
                 <p className="text-xl font-runic text-[#C0B6A8] mt-1 title">ᛚᚴᚴᚱᛅᚦ</p>
            </div>
             {appMode === 'PLAYING_ONLINE' && gameId && (
                <div className="text-right text-sm text-[#C0B6A8] font-medieval w-1/3 truncate">Room: {gameId}</div>
            )}
            {appMode === 'LOCAL_PLAY' && ( <div className="w-1/3"></div> )}

        </div>
      </header>

      <div 
        aria-live="polite" 
        className="mb-4 p-3 w-full max-w-md text-center bg-[#4A4238] border border-[#5C5346] rounded shadow text-[#E0D8CC] font-semibold text-lg"
      >
        {loading && appMode === 'PLAYING_ONLINE' && <span className="italic mr-2">(Syncing...)</span>}
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
            selectedPiece={ (appMode === 'LOCAL_PLAY' || localPlayerRole === gameState.currentPlayer) ? gameState.selectedPiece : null}
            validMoves={ (appMode === 'LOCAL_PLAY' || localPlayerRole === gameState.currentPlayer) ? gameState.validMoves : []}
            playerColors={PIECE_COLORS}
            pieceSymbols={PIECE_SYMBOLS}
            northThroneCoord={NORTH_THRONE_COORD}
            southThroneCoord={SOUTH_THRONE_COORD}
            portalACoord={PORTAL_A_COORD}
            portalBCoord={PORTAL_B_COORD}
            isCheckerboardPattern={isCheckerboardPattern}
            isPortalModeActive={isPortalModeActive}
            isInteractionDisabled={appMode === 'PLAYING_ONLINE' && localPlayerRole !== gameState.currentPlayer}
            />
        </section>
        
        <div className="flex flex-col items-center w-full mt-2 space-y-3">
            <div className="flex justify-center w-full">
              <ResetControls 
                onReset={appMode === 'PLAYING_ONLINE' ? handleLeaveGame : resetLocalGame} 
                buttonText={appMode === 'PLAYING_ONLINE' ? 'Leave Game' : 'Reset Game'}
              />
            </div>

            <div className="flex justify-center w-full">
              <button
                onClick={toggleCheckerboardPattern}
                className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none"
                aria-pressed={isCheckerboardPattern}
                title={isCheckerboardPattern ? "Switch to plain board" : "Switch to checkered board"}
              >
                <span>Checkered board</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${isCheckerboardPattern ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${isCheckerboardPattern ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>

            <div className="flex justify-center w-full">
              <button
                onClick={togglePortalMode}
                className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none"
                aria-pressed={isPortalModeActive}
                title={isPortalModeActive ? "Deactivate Portals" : "Activate Portals"}
              >
                <span>Portal Mode</span>
                <div className={`relative inline-block w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${isPortalModeActive ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${isPortalModeActive ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
              </button>
            </div>
            
            <div className="flex flex-col items-center w-full">
                <button
                    onClick={toggleRules}
                    className="flex justify-between items-center px-4 sm:px-5 py-2.5 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full max-w-xs text-sm sm:text-base focus:outline-none"
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