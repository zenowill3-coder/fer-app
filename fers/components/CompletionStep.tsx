import React from 'react';
import { CheckCircle, Save } from 'lucide-react';

interface CompletionStepProps {
  onFinish: () => void;
}

const CompletionStep: React.FC<CompletionStepProps> = ({ onFinish }) => {
  return (
    <div className="relative animate-fade-in">
      <div className="absolute top-0 right-0">
        <button
          onClick={onFinish}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
        >
          <Save size={18} />
          保存并返回后台
        </button>
      </div>

      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-slate-800 mb-4">
          谢谢您的配合，本次调研到此结束！
        </h1>
      </div>
    </div>
  );
};

export default CompletionStep;
