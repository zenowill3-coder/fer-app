import React, { useState } from 'react';
import { Session, GeneratedConfig } from '../types';
// 确保 R1_KEYWORDS 在 constants.ts 里还存在，如果不存在请告诉我
import { R1_KEYWORDS } from '../constants'; 
import { generateFunctionConfigs } from '../services/geminiService';
import { Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

interface Round1Props {
  session: Session;
  onNext: (data: any) => void;
}

const Round1: React.FC<Round1Props> = ({ session, onNext }) => {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(session.round1.selectedKeywords || []);
  const [generatedConfigs, setGeneratedConfigs] = useState<GeneratedConfig[]>(session.round1.generatedConfigs || []);
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>(session.round1.selectedConfigIds || []);
  const [comment, setComment] = useState(session.round1.comment || '');
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
    
    // 这里调用 Service 生成配置
    // 注意：geminiService.ts 里我们已经去掉了对"自动驾驶认知"字段的依赖，所以这里可以直接传 session.persona
    const configs = await generateFunctionConfigs(session.persona, selectedKeywords);
    
    setGeneratedConfigs(configs);
    setLoading(false);
  };

  const canProceed = selectedConfigIds.length > 0 && comment.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-sm font-bold text-indigo-600 tracking-wider uppercase">Round 1</h2>
           <h1 className="text-2xl font-bold text-slate-900 mt-1">功能需求研究 (Function Discovery)</h1>
        </div>
      </div>

      {/* Step 1: Keywords */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
            <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            选择功能感性词
        </h3>
        <div className="flex flex-wrap gap-3">
            {/* 确保 R1_KEYWORDS 存在 */}
            {(R1_KEYWORDS || []).map(kw => (
                <button
                    key={kw}
                    onClick={() => toggleKeyword(kw)}
                    disabled={generatedConfigs.length > 0}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                        selectedKeywords.includes(kw)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    } ${generatedConfigs.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {kw}
                </button>
            ))}
        </div>
        
        {generatedConfigs.length === 0 && (
            <div className="pt-4">
                <button
                    onClick={handleGenerate}
                    disabled={selectedKeywords.length === 0 || loading}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                        selectedKeywords.length > 0
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                    {loading ? 'AI 正在构思...' : 'AI 生成功能配置'}
                </button>
            </div>
        )}
      </section>

      {/* Step 2: Generated Configs */}
      {generatedConfigs.length > 0 && (
          <section className="space-y-4 animate-slide-up">
            <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                选择最具潜力的配置方案 (可多选)
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedConfigs.map(config => {
                    const isSelected = selectedConfigIds.includes(config.id);
                    return (
                        <div 
                            key={config.id}
                            onClick={() => toggleConfig(config.id)}
                            className={`cursor-pointer p-5 rounded-xl border-2 transition-all relative group select-none ${
                                isSelected
                                ? 'border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-500'
                                : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                            <div className="absolute top-3 right-3 text-blue-600">
                                {isSelected 
                                    ? <CheckCircle2 size={22} fill="currentColor" className="text-white" />
                                    : <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-blue-300"></div>
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
                placeholder="请填写您选择该方案的原因，或对功能的具体期望..."
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[100px] text-sm"
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
          进入 Round 2 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Round1;
