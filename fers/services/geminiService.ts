import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 对话模型
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 生图模型

// ============================================================
// 2. 核心工具 (保持不变)
// ============================================================
async function callDoubaoTextAPI(messages: any[]) {
  const url = "/api/doubao/v3/chat/completions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: TEXT_MODEL_ID, messages: messages, temperature: 0.7, stream: false })
    });
    if (!response.ok) throw new Error(`Text API Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("对话模型调用失败:", error);
    throw error;
  }
}

async function callDoubaoImageAPI(prompt: string) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: IMAGE_MODEL_ID, prompt: prompt, size: "1024x1024" })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.url || null;
  } catch (error) {
    console.error("生图请求失败:", error);
    return null;
  }
}

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 3. 业务功能：文字生成 (保持不变)
// ============================================================
export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车用户体验研究专家。
    基于以下用户画像和感性需求，生成 6 个最具创新性的功能配置。
    【用户画像】家庭: ${persona.familyStructure}, 认知: ${persona.adKnowledge}
    【感性关键词】${selectedKeywords.join(', ')}
    【要求】输出纯 JSON 数组，包含 id, title, description。
  `;
  try {
    const resultText = await callDoubaoTextAPI([{ role: "system", content: "你是一个只输出 JSON 数组的助手。" }, { role: "user", content: prompt }]);
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({ ...item, id: `func-${Date.now()}-${index}` })) : [];
  } catch (error) {
    return Array(6).fill(0).map((_, i) => ({ id: `err-${i}`, title: "生成失败", description: "请重试" }));
  }
};

export const generateInteractionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车交互设计专家。
    基于关键词: ${selectedKeywords.join(', ')}，生成 6 个交互体验配置。
    【要求】输出纯 JSON 数组，包含 title 和 description。
  `;
  try {
    const resultText = await callDoubaoTextAPI([{ role: "system", content: "你是一个只输出 JSON 数组的助手。" }, { role: "user", content: prompt }]);
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({ ...item, id: `inter-${Date.now()}-${index}` })) : [];
  } catch (error) { return []; }
};

// ============================================================
// 4. 业务功能：Round 3 生图 (⚡️未来感激进优化版⚡️)
// ============================================================

export const generateInteriorConcepts = async (
  persona: Persona, r1Data: Round1Data, r2Data: Round2Data, styleDesc: string, styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 提取功能词
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');

  // 2. 构建激进的“未来感” Prompt
  // 策略：使用强烈的科幻词汇，明确否定传统汽车元素（如方向盘）
  const basePrompt = `
    (科幻概念艺术:1.5), 2050年未来的完全自动驾驶飞行器内饰。
    极简主义，超现实主义设计，太空舱风格。
    
    【核心设计】
    - 没有任何方向盘，没有任何传统仪表盘。
    - 座椅呈休息室布局，悬浮式座椅 (Floating seats)，面对面交流模式。
    - 材质: 半透明发光材质，液态金属，全息投影玻璃，智能织物。
    - 氛围: ${persona.emotionalNeeds.join(' ')}。
    - 风格描述: ${styleDesc}。

    【重点功能视觉化】
    - ${r1Selected}
    - ${r2Selected}
    
    【构图与画质】
    - 广角俯视镜头 (Wide-angle top-down view)，展示整个座舱空间感。
    - 8k分辨率，OC渲染，虚幻引擎5画质，光线追踪，丁达尔效应。
    - 窗外是抽象的流光溢彩或未来的立体城市剪影 (不抢眼)。
  `;

  console.log("正在请求豆包生成 3 张图片 (激进未来版)...");

  // 3. 差异化变体
  const variations = [
      "变体1：强调冷色调，实验室风格，极度洁净，蓝色全息光效",
      "变体2：强调暖色调，生物有机形态设计，像在云端一样的包裹感",
      "变体3：强调暗黑科技风，赛博朋克霓虹光条，高对比度"
  ];

  try {
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`));
      const results = await Promise.all(promises);
      const validImages = results.filter(url => url !== null) as string[];

      // 兜底图
      const placeholders = [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
      ];

      let finalImages = [...validImages];
      let pIndex = 0;
      while (finalImages.length < 3) {
          finalImages.push(placeholders[pIndex % 3]);
          pIndex++;
      }
      return finalImages;

  } catch (error) {
    console.error("批量生图失败:", error);
    return [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&w=1600&q=80"
    ];
  }
};

export const generateSessionSummary = async (session: Session): Promise<string> => {
    // 保持原有逻辑
    const r1Choices = session.round1.generatedConfigs.filter(c => session.round1.selectedConfigIds.includes(c.id)).map(c => c.title).join('; ');
    const r2Choices = session.round2.generatedConfigs.filter(c => session.round2.selectedConfigIds.includes(c.id)).map(c => c.title).join('; ');
    const e = session.round3.evaluation;
    const evaluationText = `形态:${e.form.liked}, 比例:${e.proportion.liked}, 材质:${e.material.liked}, 色彩:${e.color.liked}`;
    
    const prompt = `请为本次未来汽车体验研究 Session 撰写一份300字总结。用户:${session.persona.familyStructure}, 需求:${session.persona.emotionalNeeds}。功能:${r1Choices}。交互:${r2Choices}。评价:${evaluationText}。`;
    try {
        const text = await callDoubaoTextAPI([{ role: "user", content: prompt }]);
        return text || "生成总结失败";
    } catch (e) { return "服务繁忙。"; }
}
