import React, { useState } from 'react';
import { Session, Evaluation } from '../types';
import { generateInteriorConcepts } from '../services/geminiService';
import { Image as ImageIcon, Upload, Loader2, Maximize2, Check, ArrowRight } from 'lucide-react';

interface Round3Props {
  session: Session;
  onNext: (data: any) => void;
}

const Round3: React.FC<Round3Props> = ({ session, onNext }) => {
  const [styleDescription, setStyleDescription] = useState(session.round3.styleDescription || '');
  const [styleImage, setStyleImage] = useState<string | null>(session.round3.styleImageBase64);
  const [generatedImages, setGeneratedImages] = useState<string[]>(session.round3.generatedImages || []);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(session.round3.selectedImageIndex);
  const [evaluation, setEvaluation] = useState<Evaluation>(session.round3.evaluation || {
    form: { liked: '', disliked: '' },
    proportion: { liked: '', disliked: '' },
    material: { liked: '', disliked: '' },
    color: { liked: '', disliked: '' },
  });
  const [loading, setLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStyleImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!styleDescription) return;
    setLoading(true);
    const images = await generateInteriorConcepts(
        session.persona, 
        session.round1, 
        session.round2, 
        styleDescription, 
        styleImage
    );
    setGeneratedImages(images);
    setLoading(false);
  };
  
  const handleEvaluationChange = (
    category: keyof Evaluation, 
    aspect: 'liked' | 'disliked', 
    value: string
  ) => {
    setEvaluation(prev => ({
        ...prev,
        [category]: {
            ...prev[category],
            [aspect]: value,
        }
    }));
  };

  const evaluationCategories: { key: keyof Evaluation, label: string }[] = [
    { key: 'form', label: '形态感知' },
    { key: 'proportion', label: '比例分量' },
    { key: 'material', label: '材质触感' },
    { key: 'color', label: '色彩' },
  ];

  const canFinish = selectedImageIndex !== null;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-24">
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-sm font-bold text-teal-600 tracking-wider uppercase">Round 3</h2>
           <h1 className="text-2xl font-bold text-slate-900 mt-1">未来内饰设计生成 (Concept Generation)</h1>
        </div>
      </div>

      {/* Step 1: Input Style */}
      <section className="grid md:grid-cols-2 gap-8">
         <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                定义设计风格
            </h3>
            <textarea
                value={styleDescription}
                onChange={(e) => setStyleDescription(e.target.value)}
                placeholder="例如：极简主义，有机生物形态，温暖木质与冷金属结合..."
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none h-40 text-sm resize-none"
            />
         </div>

         <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                上传风格参考图 (可选)
            </h3>
            <div className="border-2 border-dashed border-slate-300 rounded-xl h-40 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden">
                {!styleImage ? (
                    <>
                        <Upload className="text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500">点击上传图片</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </>
                ) : (
                    <>
                        <img src={styleImage} alt="Reference" className="w-full h-full object-cover" />
                        <button 
                            onClick={() => setStyleImage(null)}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                        >
                            <span className="sr-only">Remove</span>
                            x
                        </button>
                    </>
                )}
            </div>
         </div>
      </section>

      {/* Generation Trigger */}
      {generatedImages.length === 0 && (
         <div className="flex justify-center pt-6">
            <button
                onClick={handleGenerate}
                disabled={!styleDescription || loading}
                className={`flex items-center gap-3 px-10 py-4 rounded-full text-lg font-bold shadow-xl transition-all ${
                    styleDescription
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white hover:scale-105'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
                {loading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                {loading ? 'AI 正在绘制方案 (约需 10-20秒)...' : '生成 3 个内饰方案'}
            </button>
         </div>
      )}

      {/* Gallery */}
      {generatedImages.length > 0 && (
          <section className="space-y-6 animate-slide-up">
             <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                选择方案并评价
            </h3>
            
            <div className="grid md:grid-cols-3 gap-4">
                {generatedImages.map((img, idx) => (
                    <div 
                        key={idx}
                        className={`relative group rounded-xl overflow-hidden cursor-pointer border-4 transition-all ${
                            selectedImageIndex === idx ? 'border-teal-500 shadow-xl scale-105 z-10' : 'border-transparent hover:border-teal-200'
                        }`}
                        onClick={() => setSelectedImageIndex(idx)}
                    >
                        <img src={img} alt={`Generated ${idx}`} className="w-full aspect-video object-cover" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsZoomed(img); }}
                            className="absolute top-2 right-2 bg-black/40 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Maximize2 size={16} />
                        </button>
                        {selectedImageIndex === idx && (
                            <div className="absolute inset-0 bg-teal-500/10 flex items-center justify-center pointer-events-none">
                                <div className="bg-teal-500 text-white p-2 rounded-full shadow-lg">
                                    <Check size={24} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
          </section>
      )}

      {/* Evaluation */}
      {selectedImageIndex !== null && (
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-slide-up space-y-6">
             <h4 className="font-bold text-slate-800">方案评价</h4>
             <div className="space-y-6">
                {evaluationCategories.map(cat => (
                    <div key={cat.key}>
                        <h5 className="font-semibold text-slate-700 mb-3">{cat.label}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">喜欢的地方</label>
                                <textarea
                                    value={evaluation[cat.key].liked}
                                    onChange={(e) => handleEvaluationChange(cat.key, 'liked', e.target.value)}
                                    placeholder="请简要描述..."
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none h-24 text-sm resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">不喜欢的地方</label>
                                <textarea
                                    value={evaluation[cat.key].disliked}
                                    onChange={(e) => handleEvaluationChange(cat.key, 'disliked', e.target.value)}
                                    placeholder="请简要描述..."
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none h-24 text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>
                ))}
             </div>
          </section>
      )}

      {/* Zoom Modal */}
      {isZoomed && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setIsZoomed(null)}>
              <img src={isZoomed} alt="Zoomed" className="max-w-full max-h-full rounded-lg shadow-2xl" />
              <button className="absolute top-8 right-8 text-white bg-white/20 p-2 rounded-full">X</button>
          </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-center z-40">
        <button
          onClick={() => onNext({ styleDescription, styleImageBase64: styleImage, generatedImages, selectedImageIndex, evaluation })}
          disabled={!canFinish}
          className={`flex items-center gap-2 px-10 py-3 rounded-full text-lg font-medium shadow-lg transition-all ${
            canFinish
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1' 
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          完成 Session <Check size={20} />
        </button>
      </div>
    </div>
  );
};

export default Round3;