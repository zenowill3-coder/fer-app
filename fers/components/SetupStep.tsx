import React, { useState } from 'react';
import { Persona, INITIAL_PERSONA } from '../types';
// 修正导入：只导入存在的常量，并引入 UI_TEXT
import { 
  FAMILY_STRUCTURE_OPTIONS, 
  TRAVEL_FREQUENCY_OPTIONS, 
  EMOTIONAL_NEEDS, 
  SOCIAL_NEEDS,
  UI_TEXT 
} from '../constants';
import { User, Users, Heart, Star, ArrowRight, Car, Activity } from 'lucide-react';

interface SetupStepProps {
  initialPersona: Persona;
  onNext: (persona: Persona) => void;
}

const SetupStep: React.FC<SetupStepProps> = ({ initialPersona, onNext }) => {
  // 使用传入的初始状态或默认空状态
  const [persona, setPersona] = useState<Persona>(
    initialPersona.ageGroup ? initialPersona : INITIAL_PERSONA
  );

  const toggleSelection = (list: string[], item: string) => {
    // 确保 list 存在，防止 undefined 报错
    const currentList = list || [];
    return currentList.includes(item) 
      ? currentList.filter(i => i !== item) 
      : [...currentList, item];
  };

  const handleFamilySelect = (option: typeof FAMILY_STRUCTURE_OPTIONS[0]) => {
    setPersona({
      ...persona,
      familyStructure: option.label,
      ageGroup: option.ageGroup
    });
  };

  // 校验逻辑更新：不再检查自动驾驶相关字段
  const isValid = 
    persona.familyStructure && 
    persona.travelFrequency &&
    (persona.emotionalNeeds?.length || 0) > 0 && 
    (persona.socialNeeds?.length || 0) > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-3xl font-bold text-slate-900">建立用户画像</h1>
        {/* 使用 constants.ts 中的新文案 */}
        <p className="text-slate-500">{UI_TEXT.personaTitle}</p>
      </div>

      {/* Basic Info Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-2">
          <User size={20} />
          基本属性
        </h2>

        {/* 1. Family Structure */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Users size={16} className="text-slate-400"/> 一、家庭结构
          </label>
          <div className="grid grid-cols-1 gap-2">
            {FAMILY_STRUCTURE_OPTIONS.map(opt => {
              const isSelected = persona.familyStructure === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => handleFamilySelect(opt)}
                  className={`py-3 px-4 text-sm rounded-lg border transition-all text-left flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  {isSelected && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Travel Frequency */}
        <div className="space-y-3">
           <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
             <Activity size={16} className="text-slate-400"/> 二、日常出行频率
           </label>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TRAVEL_FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setPersona({ ...persona, travelFrequency: opt })}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all h-full ${
                    persona.travelFrequency === opt
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
           </div>
        </div>
      </section>

      {/* Needs Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-pink-600 border-b border-slate-100 pb-2">
          <Heart size={20} />
          感性需求
        </h2>

        <div className="space-y-4">
           {/* 3. Emotional Needs */}
           <div>
             <label className="text-sm font-medium text-slate-700 mb-3 block">
               {UI_TEXT.emotionalNeedsLabel}
             </label>
             <div className="flex flex-wrap gap-2">
                {EMOTIONAL_NEEDS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPersona({ ...persona, emotionalNeeds: toggleSelection(persona.emotionalNeeds, opt) })}
                    className={`py-1.5 px-4 text-sm rounded-full border transition-all ${
                      persona.emotionalNeeds?.includes(opt)
                        ? 'bg-pink-50 text-pink-700 border-pink-200 font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
             </div>
           </div>

           {/* 4. Social Needs */}
           <div className="border-t border-slate-100 pt-4">
             <label className="text-sm font-medium text-slate-700 mb-3 block flex items-center gap-1">
                <Star size={14} className="text-amber-500"/> {UI_TEXT.socialNeedsLabel}
             </label>
             <div className="flex flex-wrap gap-2">
                {SOCIAL_NEEDS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPersona({ ...persona, socialNeeds: toggleSelection(persona.socialNeeds, opt) })}
                    className={`py-1.5 px-4 text-sm rounded-full border transition-all ${
                      persona.socialNeeds?.includes(opt)
                        ? 'bg-amber-50 text-amber-700 border-amber-200 font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
             </div>
           </div>
        </div>
      </section>

      <div className="sticky bottom-6 flex justify-center pt-4">
        <button
          onClick={() => onNext(persona)}
          disabled={!isValid}
          className={`flex items-center gap-2 px-8 py-3 rounded-full text-lg font-medium shadow-lg transition-all ${
            isValid 
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105' 
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          进入 Round 1 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default SetupStep;
