
import React from 'react';
import { Step } from '../types';
import { User, Sparkles, Hand, Image as ImageIcon, Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: Step;
  onNavigate: (step: Step) => void;
  canNavigateTo: (step: Step) => boolean;
}

const steps = [
  { id: 'setup', label: '用户画像', icon: User },
  { id: 'round1', label: '功能需求', icon: Sparkles },
  { id: 'round2', label: '交互体验', icon: Hand },
  { id: 'round3', label: '内饰生成', icon: ImageIcon },
];

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, onNavigate, canNavigateTo }) => {
  // Helper to determine active index for progress bar
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  // Calculate completion percentage for the connecting line
  const progressPercentage = (Math.max(0, currentStepIndex) / (steps.length - 1)) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto mb-10 px-4">
      <div className="relative flex justify-between items-center">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        
        {/* Active Progress Line */}
        <div 
            className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -z-10 transform -translate-y-1/2 transition-all duration-500 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
        ></div>

        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const isClickable = canNavigateTo(step.id as Step);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <button
                onClick={() => isClickable && onNavigate(step.id as Step)}
                disabled={!isClickable}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative bg-white
                  ${isActive 
                    ? 'border-indigo-600 text-indigo-600 scale-110 shadow-md' 
                    : isCompleted 
                      ? 'border-indigo-600 bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700' 
                      : 'border-slate-300 text-slate-300 cursor-not-allowed'
                  }
                `}
              >
                {isCompleted ? <Check size={18} /> : <Icon size={18} />}
              </button>
              <span className={`mt-2 text-xs font-medium transition-colors duration-300
                ${isActive || isCompleted ? 'text-slate-800' : 'text-slate-400'}
              `}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;
