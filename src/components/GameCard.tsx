
import React from 'react';

export interface CardData {
  color: 'red' | 'blue' | 'green' | 'yellow';
  shape: 'circle' | 'square' | 'triangle' | 'diamond';
  number: 1 | 2 | 3 | 4;
}

interface GameCardProps {
  card: CardData;
  onClick?: () => void;
  isClickable?: boolean;
  isSelected?: boolean;
  showFeedback?: 'correct' | 'incorrect' | null;
  size?: 'small' | 'medium' | 'large';
}

const GameCard = ({ 
  card, 
  onClick, 
  isClickable = false, 
  isSelected = false, 
  showFeedback = null,
  size = 'medium' 
}: GameCardProps) => {
  const getColorClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-400';
      case 'blue': return 'bg-blue-400';
      case 'green': return 'bg-green-400';
      case 'yellow': return 'bg-yellow-400';
      default: return 'bg-gray-400';
    }
  };

  const getTriangleBorderColor = (color: string) => {
    switch (color) {
      case 'red': return 'border-b-red-400';
      case 'blue': return 'border-b-blue-400';
      case 'green': return 'border-b-green-400';
      case 'yellow': return 'border-b-yellow-400';
      default: return 'border-b-gray-400';
    }
  };

  const getShapeElement = (shape: string, color: string, index: number) => {
    const colorClass = getColorClass(color);
    const baseKey = `${shape}-${color}-${index}`;
    
    switch (shape) {
      case 'circle':
        return <div key={baseKey} className={`w-6 h-6 ${colorClass} rounded-full`} />;
      case 'square':
        return <div key={baseKey} className={`w-6 h-6 ${colorClass}`} />;
      case 'triangle':
        return (
          <div 
            key={baseKey} 
            className={`w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent ${getTriangleBorderColor(color)}`} 
          />
        );
      case 'diamond':
        return (
          <div key={baseKey} className={`w-6 h-6 ${colorClass} transform rotate-45`} />
        );
      default:
        return <div key={baseKey} className={`w-6 h-6 ${colorClass}`} />;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small': return 'w-20 h-28';
      case 'medium': return 'w-24 h-32';
      case 'large': return 'w-28 h-36';
      default: return 'w-24 h-32';
    }
  };

  const getFeedbackClasses = () => {
    if (showFeedback === 'correct') return 'ring-4 ring-green-400 bg-white';
    if (showFeedback === 'incorrect') return 'ring-4 ring-red-400 bg-white';
    if (isSelected) return 'ring-2 ring-blue-400 bg-white';
    return 'bg-white';
  };

  const shapes = Array.from({ length: card.number }, (_, i) => 
    getShapeElement(card.shape, card.color, i)
  );

  return (
    <div
      className={`
        ${getSizeClasses()}
        rounded-lg shadow-md border-2 border-gray-200
        flex flex-col items-center justify-center gap-1 p-2
        transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
        ${getFeedbackClasses()}
      `}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        {shapes}
      </div>
    </div>
  );
};

export default GameCard;
