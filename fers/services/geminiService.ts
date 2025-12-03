import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 用于对话
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 用于生图

// ============================================================
// 2. 核心工具 A: 对话/文本推理
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

// ============================================================
// 3. 核心工具 B: 图片生成 (已适配未来感 Prompt)
// ============================================================
async function callDoubaoImageAPI(prompt: string) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID,
        prompt: prompt,
        size: "1024x1024"
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("生图 API 报错:", err);
        return null;
    }
    const data = await response.json();
    return data.data?.[0]?.url || null;
  } catch (error) {
    console.error("生图网络请求失败:", error);
    return null;
  }
}

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 4. 业务功能：文字生成 (保持稳定)
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
// 5. 业务功能：Round 3 生图 (⚡️未来感核心优化⚡️)
// ============================================================
export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 继承原有逻辑：处理参考图
  // 注意：目前的豆包文生图 API 主要依赖 Prompt。为了防止 API 报错，我们暂时不把 Base64 直接传给 API，
  // 而是将"参考图已上传"作为一个强烈的文字信号加入 Prompt，或依赖用户对风格的文字描述。
  // 如果未来你有支持 img2img 的特定 Endpoint，可以在这里解开 Base64。
  const hasRefImage = !!styleImageBase64;

  // 2. 提取功能词
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');

  // 3. 构建激进的“未来感” Prompt (中文深度适配)
  // 我们使用权重大于 1 的标记和明确的“概念艺术”词汇
  const basePrompt = `
    (未来主义概念艺术:1.6), 2050年完全自动驾驶飞行汽车内饰 (Concept Art)。
    超现实主义，太空歌剧风格，极度洁净，反重力设计。
    
    【核心必须执行】
    - ❌ 绝对禁止出现传统圆形方向盘 (No steering wheel)。
    - ❌ 绝对禁止出现传统仪表盘指针。
    - ✅ 必须展示：悬浮式座椅 (Floating seats)，全息投影中控，智能表面材质。
    
    【设计输入】
    - 目标用户: ${persona.familyStructure}
    - 情感诉求: ${persona.emotionalNeeds.join(' ')}
    - 用户风格描述: ${styleDesc} ${hasRefImage ? '(请参考用户提供的风格图感觉)' : ''}
    
    【功能可视化】
    - ${r1Selected}
    - ${r2Selected}
    
    【构图与渲染】
    - 广角俯视镜头 (Wide-angle top-down view)，展示座舱整体空间布局。
    - 8k分辨率，OC渲染 (Octane Render)，虚幻引擎5 (Unreal Engine 5)。
    - 电影级光效，丁达尔效应，体积光。
    - 窗外环境：抽象的未来城市流光或云端景象，不要写实街道。
  `;

  console.log("正在请求豆包生成 3 张图片 (激进未来版)...");

  // 4. 并发生成 3 张 (差异化变体)
  const variations = [
      "变体1：强调生物有机形态，像细胞一样的包裹感，暖色调呼吸灯",
      "变体2：强调硬核科幻，透明显示屏，液态金属材质，冷色调",
      "变体3：强调禅意空间，无形科技，极致简约，自然光感"
  ];

  try {
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`));
      
      const results = await Promise.all(promises);
      const validImages = results.filter(url => url !== null) as string[];

      // 5. 兜底逻辑
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
