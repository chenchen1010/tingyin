import React from 'react';

interface Props {
  progress: number;
}

export const ProgressBar: React.FC<Props> = ({ progress }) => {
  if (progress <= 0 || progress >= 100) return null;

  return (
    <div className="progress-container">
      <div 
        className="progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}; 