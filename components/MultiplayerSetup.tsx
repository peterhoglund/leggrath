
import React, { useState } from 'react';

interface MultiplayerSetupProps {
  onCreateGame: (playerName: string, gameRoomName: string, is5ColMode: boolean, secureThrone: boolean) => void;
  onJoinGame: (playerName: string, gameRoomName: string) => void;
  onBackToMainMenu: () => void;
  loading: boolean;
  errorMessage: string | null;
}

const MultiplayerSetup: React.FC<MultiplayerSetupProps> = ({ 
  onCreateGame, 
  onJoinGame, 
  onBackToMainMenu,
  loading,
  errorMessage
}) => {
  const [playerName, setPlayerName] = useState<string>('');
  const [gameRoomName, setGameRoomName] = useState<string>('');
  const [localIs5ColumnModeActive, setLocalIs5ColumnModeActive] = useState<boolean>(false);
  const [localIsSecureThroneRequired, setLocalIsSecureThroneRequired] = useState<boolean>(true);

  const handleCreate = () => {
    if (playerName.trim() && gameRoomName.trim()) {
      onCreateGame(playerName.trim(), gameRoomName.trim(), localIs5ColumnModeActive, localIsSecureThroneRequired);
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && gameRoomName.trim()) {
      onJoinGame(playerName.trim(), gameRoomName.trim());
    }
  };

  const handleGameRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const processedValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setGameRoomName(processedValue);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#2E2D2B]">
      <header className="mb-8 text-center">
        <h1 className="text-6xl font-bold text-[#E0D8CC] font-medieval title">leggrað</h1>
        <p className="text-2xl font-runic text-[#C0B6A8] mt-2 title">ᛚᚴᚴᚱᛅᚦ</p>
      </header>
      
      <h2 className="text-3xl font-medieval text-[#E0D8CC] mb-6">Online Multiplayer</h2>

      {errorMessage && (
        <div className="mb-4 p-3 w-full max-w-md text-center bg-red-700 border border-red-900 rounded shadow text-white font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="w-full max-w-md p-6 bg-[#3A3633] rounded-lg shadow-xl space-y-5">
        <div>
          <label htmlFor="playerName" className="block text-s font-medium text-[#C0B6A8] mb-1 font-medieval input-title">
            your name
          </label>
          <input
            type="text"
            id="playerName"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full text-lg placeholder:text-[#A08C7A]"
            maxLength={25}
            disabled={loading}
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="gameRoomName" className="block text-s font-medium text-[#C0B6A8] mb-1 font-medieval input-title">
            game room name
          </label>
          <input
            type="text"
            id="gameRoomName"
            value={gameRoomName}
            onChange={handleGameRoomNameChange}
            placeholder="Enter a Room Name"
            className="w-full text-lg placeholder:text-[#A08C7A]"
            maxLength={25}
            disabled={loading}
            aria-required="true"
          />
           <p className="text-xs text-[#a09488] mt-1.5">Min 3 alphanumerical characters (A-Z, 0-9).</p>
        </div>

        {/* Game Settings Toggles - Only relevant for Create Game flow */}
        <div className="pt-2 space-y-1 border-t border-[#4A4238]">
            <p className="text-sm font-medium text-[#C0B6A8] mb-2 font-medieval input-title text-center">Game Settings (for Host)</p>
            <button
                onClick={() => setLocalIsSecureThroneRequired(prev => !prev)}
                className={`flex justify-between items-center px-3 py-2 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full text-sm focus:outline-none shadow-none rounded-md hover:bg-[#4A4238] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={localIsSecureThroneRequired}
                title={localIsSecureThroneRequired ? "Throne safety: REQUIRED (Must be clear to win)" : "Throne safety: NOT REQUIRED (Can win on threatened Throne)"}
                disabled={loading}
              >
                <span>Secure Throne for Victory</span>
                <div className={`relative inline-block w-9 h-[20px] rounded-full transition-colors duration-200 ease-in-out ${localIsSecureThroneRequired ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-[18px] h-[18px] bg-white rounded-full transform transition-transform duration-200 ease-in-out ${localIsSecureThroneRequired ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
            </button>
            <button
                onClick={() => setLocalIs5ColumnModeActive(prev => !prev)}
                className={`flex justify-between items-center px-3 py-2 text-[#E0D8CC] font-semibold transition-colors duration-150 font-medieval w-full text-sm focus:outline-none shadow-none rounded-md hover:bg-[#4A4238] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-pressed={localIs5ColumnModeActive}
                title={localIs5ColumnModeActive ? "Switch to 7-column mode" : "Switch to 5-column mode"}
                disabled={loading}
              >
                <span>5-Column Mode</span>
                <div className={`relative inline-block w-9 h-[20px] rounded-full transition-colors duration-200 ease-in-out ${localIs5ColumnModeActive ? 'bg-[#8C7062]' : 'bg-[#4A4238]'}`}>
                  <span
                    className={`absolute top-[1px] left-[1px] inline-block w-[18px] h-[18px] bg-white rounded-full transform transition-transform duration-200 ease-in-out ${localIs5ColumnModeActive ? 'translate-x-[18px]' : 'translate-x-0'}`}
                  />
                </div>
            </button>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0 pt-3">
          <button
            onClick={handleCreate}
            disabled={!playerName.trim() || gameRoomName.trim().length < 3 || loading}
            className="w-full py-2.5 text-lg bg-[#5C5346] hover:bg-[#6E6255]"
          >
            {loading ? 'Creating...' : 'Create Game'}
          </button>
          <button
            onClick={handleJoin}
            disabled={!playerName.trim() || gameRoomName.trim().length < 3 || loading}
            className="w-full py-2.5 text-lg bg-[#5C5346] hover:bg-[#6E6255]"
          >
            {loading ? 'Joining...' : 'Join Game'}
          </button>
        </div>
        
        <div className="pt-2">
           <button
            onClick={onBackToMainMenu}
            disabled={loading}
            className="w-full py-2.5 text-lg bg-[#4A4238] hover:bg-[#5C5346]"
          >
            Back to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerSetup;
