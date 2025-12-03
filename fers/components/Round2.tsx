
import React, { useState } from 'react';
import { Session, GeneratedConfig } from '../types';
import { R2_CATEGORIES } from '../constants';
import { generateInteractionConfigs } from '../services/geminiService';
import { Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

interface Round2Props {
  session: Session;
  onNext: (data: any) => void;
}

const Round2: React.FC<Round2Props> = ({ session, onNext }) => {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(session.round2.selectedKeywords || []);
  const [generatedConfigs, setGeneratedConfigs] = useState<GeneratedConfig[]>(session.round2.generatedConfigs || []);
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>(session.round2.selectedConfigIds || []);
  const [comment, setComment] = useState(session.round2.comment || '');
  const [loading, setLoading] = useState(false);

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]);
  };

  const toggleConfig = (id: string) => {
      setSelectedConfigIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (selectedKeywords.length === 0) return;
    setLoading(true);
    setGeneratedConfigs([]);
    const configs = await generateInteractionConfigs(session.persona, selectedKeywords);
    setGeneratedConfigs(configs);
    setLoading(false);
  };

  const canProceed = selectedConfigIds.length > 0 && comment.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-sm font-bold text-pink-600 tracking-wider uppercase">Round 2</h2>
           <h1 className="text-2xl font-bold text-slate-900 mt-1">交互体验研究 (Interaction Discovery)</h1>
        </div>
      </div>

      {/* Step 1: Keywords */}
      <section className="space-y-6">
        <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            选择交互体验感性词
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
            {R2_CATEGORIES.map((cat, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-slate-700 mb-3 text-sm border-b border-slate-100 pb-2">{cat.title}</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {cat.keywords.map(kw => (
                            <button
                                key={kw.label}
                                onClick={() => toggleKeyword(kw.label)}
                                disabled={generatedConfigs.length > 0}
                                className={`p-2 rounded-lg border text-left transition-all relative ${
                                    selectedKeywords.includes(kw.label)
                                    ? 'bg-pink-50 border-pink-500 ring-1 ring-pink-500'
                                    : 'bg-slate-50 border-transparent hover:bg-slate-100'
                                } ${generatedConfigs.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <div className={`font-medium text-sm ${selectedKeywords.includes(kw.label) ? 'text-pink-700' : 'text-slate-800'}`}>{kw.label}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{kw.subtext}</div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
        
        {generatedConfigs.length === 0 && (
            <div className="pt-4 flex justify-center">
                <button
                    onClick={handleGenerate}
                    disabled={selectedKeywords.length === 0 || loading}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all text-lg ${
                        selectedKeywords.length > 0
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                    {loading ? 'AI 正在构思交互方案...' : 'AI 生成交互配置'}
                </button>
            </div>
        )}
      </section>

      {/* Step 2: Generated Configs */}
      {generatedConfigs.length > 0 && (
          <section className="space-y-4 animate-slide-up">
            <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                选择最佳交互方案 (可多选)
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedConfigs.map(config => {
                    const isSelected = selectedConfigIds.includes(config.id);
                    return (
                        <div 
                            key={config.id}
                            onClick={() => toggleConfig(config.id)}
                            className={`cursor-pointer p-5 rounded-xl border-2 transition-all relative select-none ${
                                isSelected
                                ? 'border-pink-500 bg-pink-50/50 shadow-md ring-1 ring-pink-500'
                                : 'border-slate-100 bg-white hover:border-pink-200 hover:shadow-sm'
                            }`}
                        >
                            <div className="absolute top-3 right-3 text-pink-600">
                                {isSelected 
                                    ? <CheckCircle2 size={22} fill="currentColor" className="text-white" />
                                    : <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-pink-300"></div>
                                }
                            </div>
                            <h4 className="font-bold text-slate-800 mb-2 pr-6">{config.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{config.description}</p>
                        </div>
                    );
                })}
            </div>
          </section>
      )}

      {/* Step 3: Comment */}
      {selectedConfigIds.length > 0 && (
          <section className="space-y-4 animate-slide-up">
            <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                补充备注
            </h3>
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请评价该交互方案，或者描述您想象中的具体场景..."
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none min-h-[100px] text-sm"
            />
          </section>
      )}

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-center z-40">
        <button
          onClick={() => onNext({ selectedKeywords, generatedConfigs, selectedConfigIds, comment })}
          disabled={!canProceed}
          className={`flex items-center gap-2 px-10 py-3 rounded-full text-lg font-medium shadow-lg transition-all ${
            canProceed
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1' 
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          进入 Round 3 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Round2;
