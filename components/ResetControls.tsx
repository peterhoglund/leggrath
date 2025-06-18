import React from 'react';

interface ResetControlsProps {
  onReset: () => void;
  buttonText?: string; // Optional: custom text for the button
}

const ResetControls: React.FC<ResetControlsProps> = ({ onReset, buttonText = "Reset Game" }) => {
  return (
    <button
      onClick={onReset}
      className="px-4 sm:px-5 py-2 bg-[#5C5346] hover:bg-[#6E6255] text-[#E0D8CC] font-semibold rounded-lg shadow-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#8C7062] focus:ring-opacity-75 font-medieval whitespace-nowrap text-sm"
      aria-label={buttonText}
    >
      {buttonText}
    </button>
  );
};

export default ResetControls;
