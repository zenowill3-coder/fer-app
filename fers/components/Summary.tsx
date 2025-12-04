import React, { useRef, useState } from 'react';
import { Session, Evaluation } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Loader2, Home, CheckCircle2, User } from 'lucide-react';
import { generateSessionSummary } from '../services/geminiService';

interface SummaryProps {
  session: Session;
  onDone: () => void;
}

const Summary: React.FC<SummaryProps> = ({ session, onDone }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<string>(session.aiSummary || '');
  const [loading, setLoading] = useState(false);

  // Filter for selected choices
  const r1Choices = session.round1.generatedConfigs.filter(c => session.round1.selectedConfigIds.includes(c.id));
  const r2Choices = session.round2.generatedConfigs.filter(c => session.round2.selectedConfigIds.includes(c.id));
  
  const finalImage = session.round3.generatedImages[session.round3.selectedImageIndex || 0];
  
  // 自动生成 AI 总结（如果还没有的话）
  React.useEffect(() => {
      if (session.status === 'completed' && !session.aiSummary && !summary && !loading) {
          const fetchSummary = async () => {
              setLoading(true);
              const result = await generateSessionSummary(session);
              setSummary(result);
              setLoading(false);
          };
          fetchSummary();
      }
  }, [session, summary, loading]);

  const e = session.round3.evaluation;
  const evaluationCategories: { key: keyof Evaluation, label: string }[] = [
      { key: 'form', label: '形态感知' },
      { key: 'proportion', label: '比例分量' },
      { key: 'material', label: '材质触感' },
      { key: 'color', label: '色彩' },
  ];

  // 🛠️ 核心修复：把跨域图片转为 Base64
  const convertImageToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, { mode: 'cors' }); // 尝试 CORS 请求
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Image CORS failed, returning original URL (might be blank in PDF)", e);
      return url;
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    
    try {
        // 1. 临时替换 DOM 中的图片为 Base64
        // 找到所有的 img 标签
        const images = contentRef.current.getElementsByTagName('img');
        const originalSrcs: string[] = [];

        // 并行处理所有图片转换
        const promises = Array.from(images).map(async (img, index) => {
            originalSrcs[index] = img.src; // 保存原地址
            // 只有当图片是 http 开头（非本地 Base64）时才转换
            if (img.src.startsWith('http')) {
                const base64 = await convertImageToBase64(img.src);
                img.src = base64; // 替换为 Base64
            }
        });
        
        await Promise.all(promises);

        // 2. 等待一小会儿确保渲染完成
        await new Promise(r => setTimeout(r, 500));

        // 3. 生成 Canvas
        const canvas = await html2canvas(contentRef.current, { 
            scale: 2, 
            useCORS: true, // 开启跨域支持
            allowTaint: true, // 允许脏画布
            logging: false
        });
        
        // 4. 恢复原始图片链接 (避免页面闪烁或内存占用)
        Array.from(images).forEach((img, index) => {
            img.src = originalSrcs[index];
        });

        // 5. 生成 PDF
        const imgData = canvas.toDataURL('image/jpeg', 0.95); // 使用 JPEG 减小体积
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // 计算每一页的高度
        const pageHeightInImg = (imgHeight * pdfWidth) / imgWidth;
        const scaleFactor = pdfWidth / imgWidth;
        
        let heightLeft = imgHeight;
        let position = 0;

        // 第一页
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight * scaleFactor);
        heightLeft -= (pdfHeight / scaleFactor);

        // 如果内容超过一页，自动分页
        while (heightLeft > 0) {
            position = heightLeft - imgHeight; // 下移
            pdf.addPage();
            // 这里是一个简化的分页逻辑，可能需要裁剪 canvas 才能完美分页，但对于长图来说通常这样足够
            // 注意：jspdf 添加长图到第二页比较复杂，通常建议简单截断或缩放一页展示
            // 为了稳定性，这里我们改为：如果太长，直接把整个长图缩放到一页里（适合报告）
            // 或者如果只是想简单分页：
            pdf.addImage(imgData, 'JPEG', 0, -(pdfHeight - heightLeft * scaleFactor), pdfWidth, imgHeight * scaleFactor);
            heightLeft -= (pdfHeight / scaleFactor);
        }
        
        // 简化策略：如果不想处理复杂分页，直接把内容缩放到一页 PDF 里
        // pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight * (pdfWidth / imgWidth));

        pdf.save(`FERS_Report_${session.id.slice(-6)}.pdf`);

    } catch (e) {
        console.error("PDF Export Error", e);
        alert("导出 PDF 失败，可能是图片跨域限制。建议截图保存。");
    } finally {
        setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Session Summary</h1>
        <button onClick={onDone} className="text-indigo-600 hover:underline flex items-center gap-1">
             <Home size={16} /> 返回首页
        </button>
      </div>

      {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-slate-600 text-lg">AI 正在生成研究总结报告...</p>
              <p className="text-slate-400 text-sm mt-2">基于全流程数据智能分析</p>
          </div>
      ) : (
        <>
            {/* Report Container for PDF */}
            <div ref={contentRef} className="bg-white p-10 shadow-lg rounded-none md:rounded-2xl space-y-8 text-slate-800">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-6 mb-8">
                    <h2 className="text-4xl font-extrabold text-slate-900 mb-2">未来体验研究报告</h2>
                    <div className="flex justify-between text-slate-500 text-sm mt-4">
                        <span>Session ID: {session.id.slice(-6).toUpperCase()}</span>
                        <span>Date: {new Date(session.updatedAt).toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Persona */}
                <section className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <User size={20} className="text-indigo-600" />
                        01 用户画像
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-white p-3 rounded-lg border border-slate-100">
                                <span className="block text-slate-400 mb-1">家庭结构</span>
                                <span className="font-medium text-base">{session.persona.familyStructure}</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-100">
                                <span className="block text-slate-400 mb-1">出行频率</span>
                                <span className="font-medium text-base">{session.persona.travelFrequency}</span>
                            </div>
                        </div>
                        <div className="pt-2">
                             <span className="block text-slate-400 text-sm mb-2">深层需求</span>
                             <div className="flex flex-wrap gap-2">
                                {session.persona.emotionalNeeds.map(n => (
                                    <span key={n} className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-xs font-medium border border-pink-100">{n}</span>
                                ))}
                                {session.persona.socialNeeds.map(n => (
                                    <span key={n} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-100">{n}</span>
                                ))}
                             </div>
                        </div>
                    </div>
                </section>

                {/* AI Summary */}
                <section>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider border-b border-slate-200 pb-2">02 AI 智能洞察</h3>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                        {summary || session.aiSummary || "暂无总结"}
                    </div>
                </section>

                {/* Visual */}
                <section>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider border-b border-slate-200 pb-2">03 最终概念方案与评价</h3>
                    <div className="rounded-xl overflow-hidden border-2 border-slate-100 shadow-lg">
                        {finalImage ? (
                            // 添加 crossOrigin 属性，尝试请求 CORS 许可
                            <img 
                                src={finalImage} 
                                alt="Final Concept" 
                                className="w-full h-auto" 
                                crossOrigin="anonymous" 
                            />
                        ) : (
                            <div className="w-full h-64 bg-slate-100 flex items-center justify-center text-slate-400">暂无图片</div>
                        )}
                    </div>
                    <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {evaluationCategories.map(cat => (
                                <div key={cat.key}>
                                    <h5 className="font-semibold text-sm text-slate-600 mb-2">{cat.label}</h5>
                                    <div className="space-y-2">
                                        <p className="text-sm bg-green-50 text-green-800 p-3 rounded-lg border border-green-100 whitespace-pre-wrap">
                                            <span className="font-bold">喜欢:</span> {e[cat.key].liked || '未填写'}
                                        </p>
                                        <p className="text-sm bg-red-50 text-red-800 p-3 rounded-lg border border-red-100 whitespace-pre-wrap">
                                            <span className="font-bold">不喜欢:</span> {e[cat.key].disliked || '未填写'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Round 1 & 2 Details */}
                <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <section>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider border-b border-slate-200 pb-1">功能配置 (Round 1)</h3>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                            {r1Choices.length > 0 ? r1Choices.map(c => (
                                <div key={c.id} className="border-b border-blue-100 last:border-0 pb-2 last:pb-0">
                                    <h4 className="font-bold text-blue-900 text-sm">{c.title}</h4>
                                    <p className="text-xs text-blue-800 mt-0.5">{c.description}</p>
                                </div>
                            )) : <p className="text-sm text-slate-400">未选择配置</p>}
                            
                            {session.round1.comment && (
                                <div className="pt-2 border-t border-blue-200">
                                    <p className="text-xs text-blue-600 italic">备注: "{session.round1.comment}"</p>
                                </div>
                            )}
                        </div>
                    </section>
                    <section>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider border-b border-slate-200 pb-1">交互体验 (Round 2)</h3>
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-100 space-y-3">
                             {r2Choices.length > 0 ? r2Choices.map(c => (
                                <div key={c.id} className="border-b border-pink-100 last:border-0 pb-2 last:pb-0">
                                    <h4 className="font-bold text-pink-900 text-sm">{c.title}</h4>
                                    <p className="text-xs text-pink-800 mt-0.5">{c.description}</p>
                                </div>
                            )) : <p className="text-sm text-slate-400">未选择配置</p>}

                            {session.round2.comment && (
                                <div className="pt-2 border-t border-pink-200">
                                    <p className="text-xs text-pink-600 italic">备注: "{session.round2.comment}"</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="text-center pt-10 text-slate-300 text-xs">
                    Generated by FERS System
                </div>
            </div>

            {/* Export Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-center z-40">
                <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-10 py-3 rounded-full text-lg font-medium shadow-lg bg-slate-900 text-white hover:bg-black transition-all"
                >
                    {exporting ? <Loader2 className="animate-spin"/> : <Download />}
                    {exporting ? '正在导出 PDF...' : '导出 PDF 报告'}
                </button>
            </div>
        </>
      )}
    </div>
  );
};

export default Summary;
