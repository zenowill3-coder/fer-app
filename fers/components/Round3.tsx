import React, { useState, useRef } from 'react';
import { Session, Evaluation } from '../types';
import { generateInteriorConcepts } from '../services/geminiService';
import { Image as ImageIcon, Upload, Loader2, Maximize2, Check, ArrowRight, Sparkles, X } from 'lucide-react';

interface Round3Props {
  session: Session;
  onNext: (data: any) => void;
}

const Round3: React.FC<Round3Props> = ({ session, onNext }) => {
  const [styleDescription, setStyleDescription] = useState(session.round3.styleDescription || '');
  const [styleImage, setStyleImage] = useState<string | null>(session.round3.styleImageBase64);
  const [generatedImages, setGeneratedImages] = useState<string[]>(session.round3.generatedImages || []);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(session.round3.selectedImageIndex);
  
  // 初始化评价状态
  const [evaluation, setEvaluation] = useState<Evaluation>(session.round3.evaluation || {
    form: { liked: '', disliked: '' },
    proportion: { liked: '', disliked: '' },
    material: { liked: '', disliked: '' },
    color: { liked: '', disliked: '' },
  });
  
  const [loading, setLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setGeneratedImages([]); // 清空旧图
    setSelectedImageIndex(null); // 重置选择

    try {
        const images = await generateInteriorConcepts(
            session.persona, 
            session.round1, 
            session.round2, 
            styleDescription, 
            styleImage
        );
        setGeneratedImages(images);
    } catch (e) {
        console.error("Generate failed", e);
    } finally {
        setLoading(false);
    }
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
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-24">
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
            
            <div 
                onClick={() => !styleImage && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl h-40 flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                    styleImage ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer'
                }`}
            >
                {!styleImage ? (
                    <>
                        <Upload className="text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500">点击上传图片</span>
                    </>
                ) : (
                    <div className="relative w-full h-full">
                        <img src={styleImage} alt="Reference" className="w-full h-full object-contain p-2" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setStyleImage(null); }}
                            className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                />
            </div>
         </div>
      </section>

      {/* Generation Trigger */}
      {generatedImages.length === 0 && (
         <div className="flex justify-center pt-6">
            <button
                onClick={handleGenerate}
                disabled={!styleDescription || loading}
                className={`flex items-center gap-3 px-12 py-4 rounded-full text-xl font-bold shadow-xl transition-all transform ${
                    styleDescription && !loading
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white hover:scale-105 hover:shadow-2xl'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                {loading ? 'AI 正在绘制 6 个方案 (约30秒)...' : '生成 6 个概念方案'}
            </button>
         </div>
      )}

      {/* Gallery (6 Grid) */}
      {generatedImages.length > 0 && (
          <section className="space-y-6 animate-slide-up">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    选择最佳方案并评价
                </h3>
                <button onClick={handleGenerate} disabled={loading} className="text-sm text-teal-600 hover:underline flex items-center gap-1">
                    <Sparkles size={14}/> 重新生成
                </button>
             </div>
            
            {/* Grid Layout: PC 3列, 平板 2列, 手机 2列 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {generatedImages.map((img, idx) => (
                    <div 
                        key={idx}
                        className={`relative group rounded-xl overflow-hidden cursor-pointer border-4 transition-all duration-300 ${
                            selectedImageIndex === idx 
                            ? 'border-teal-500 shadow-2xl scale-[1.02] z-10 ring-4 ring-teal-100' 
                            : 'border-transparent hover:border-teal-200 hover:shadow-lg'
                        }`}
                        onClick={() => setSelectedImageIndex(idx)}
                    >
                        {/* Image Aspect Ratio 16:9 */}
                        <div className="aspect-video w-full bg-slate-100">
                            <img src={img} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>

                        {/* Overlay Controls */}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsZoomed(img); }}
                                className="bg-black/60 text-white p-1.5 rounded-lg hover:bg-black/80 backdrop-blur-sm"
                                title="放大查看"
                            >
                                <Maximize2 size={16} />
                            </button>
                        </div>

                        {/* Selection Badge */}
                        {selectedImageIndex === idx && (
                            <div className="absolute inset-0 bg-teal-500/10 pointer-events-none flex items-center justify-center">
                                <div className="bg-teal-500 text-white p-3 rounded-full shadow-lg transform scale-110">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                            </div>
                        )}
                        
                        {/* Number Badge */}
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                            方案 {idx + 1}
                        </div>
                    </div>
                ))}
            </div>
          </section>
      )}

      {/* Evaluation */}
      {selectedImageIndex !== null && (
          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg animate-slide-up space-y-6">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <ImageIcon className="text-teal-600" />
                <h4 className="font-bold text-slate-800 text-lg">
                    评价方案 {selectedImageIndex + 1}
                </h4>
             </div>
             
             <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                {evaluationCategories.map(cat => (
                    <div key={cat.key} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h5 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                            {cat.label}
                        </h5>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1 block">喜欢的点</label>
                                <input
                                    type="text"
                                    value={evaluation[cat.key].liked}
                                    onChange={(e) => handleEvaluationChange(cat.key, 'liked', e.target.value)}
                                    placeholder="例如：线条流畅..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1 block">需要改进</label>
                                <input
                                    type="text"
                                    value={evaluation[cat.key].disliked}
                                    onChange={(e) => handleEvaluationChange(cat.key, 'disliked', e.target.value)}
                                    placeholder="例如：颜色太暗..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white transition-all"
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
          <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setIsZoomed(null)}>
              <img src={isZoomed} alt="Zoomed" className="max-w-full max-h-full rounded shadow-2xl" />
              <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
                  <X size={24} />
              </button>
          </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-center z-40">
        <button
          onClick={() => onNext({ 
              styleDescription, 
              styleImageBase64: styleImage, 
              generatedImages, 
              selectedImageIndex, 
              evaluation 
          })}
          disabled={!canFinish}
          className={`flex items-center gap-2 px-12 py-3 rounded-full text-lg font-bold shadow-lg transition-all ${
            canFinish
            ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:shadow-xl hover:-translate-y-1' 
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          完成并生成报告 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Round3;
