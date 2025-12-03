import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID;

// ============================================================
// 🛠️ 极限图片压缩
// ============================================================
async function compressImage(base64Str: string, maxWidth = 512, quality = 0.4): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(img.src); return; }
      
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

// ============================================================
// 2. 核心工具 A: 对话 (Text)
// ============================================================
async function callDoubaoTextAPI(messages: any[]) {
  const url = "/api/doubao/v3/chat/completions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: TEXT_MODEL_ID,
        messages: messages,
        temperature: 0.7,
        stream: false
      })
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
// 3. 核心工具 B: 生图 (2K 高清版)
// ============================================================
async function callDoubaoImageAPI(prompt: string, compressedBase64: string | null = null) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    // ✅ 必须用 2k，否则模型会报 400 错误 (Pixel count too low)
    size: "2k", 
    sequential_image_generation: "auto"
  };

  if (compressedBase64) {
    requestBody.image = compressedBase64;
    // 0.7 是个比较安全的值，太高(0.9)容易崩坏，太低(0.5)不像内饰
    requestBody.strength = 0.7; 
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("豆包API拒绝:", err);
        return null;
    }
    const data = await response.json();
    return data.data?.[0]?.url || null;

  } catch (error) {
    console.error("网络失败:", error);
    return null;
  }
}

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 4. 业务功能 Round 1 & 2
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
// 5. 业务功能 Round 3
// ============================================================
export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  
  const basePrompt = `
    (车辆内饰概念图:1.5), 2050年自动驾驶座舱内部视角。
    ❌ 不要画车身外观，❌ 不要画街道。✅ 只画车内座椅和仪表台。
    
    【设计输入】
    - 目标用户: ${persona.familyStructure}
    - 风格参考: ${styleDesc} (请提取参考图的色调与光影，应用到内饰中)
    - 情绪氛围: ${persona.emotionalNeeds.join(' ')}
    
    【功能可视化】
    - ${r1Selected}
    - ${r2Selected}
    
    【构图要求】
    1. 视角: 广角俯视镜头 (Interior Wide-angle top-down)。
    2. 内容: 100% 车辆内部画面。
    
    【视觉风格】
    - 8k分辨率，OC渲染，电影级光效。
  `;

  console.log("🛡️ [2K 修复版] 启动...");
  
  let processedBase64: string | null = null;
  if (styleImageBase64) {
    console.log("🛡️ >> 极限压缩参考图 (Max 512px)...");
    try {
        processedBase64 = await compressImage(styleImageBase64, 512, 0.4);
        console.log("🛡️ >> 压缩成功");
    } catch (e) {
        console.error("压缩失败", e);
        processedBase64 = null;
    }
  }

  const variations = [
      "变体A：强调参考图的配色与材质感",
      "变体B：更强的科技感内饰",
      "变体C：更通透的居家氛围"
  ];

  const validImages: string[] = [];
  
  // 串行执行
  for (const [index, v] of variations.entries()) {
    try {
      console.log(`🛡️ >> 正在生成第 ${index + 1}/3 张 (2k模式)...`);
      const imgUrl = await callDoubaoImageAPI(basePrompt + `\n(${v})`, processedBase64);
      if (imgUrl) validImages.push(imgUrl);
    } catch (e) {
      console.error(`第 ${index + 1} 张生成遇到严重错误`, e);
    }
  }

  const placeholders = [
    "https://picsum.photos/1600/900?random=1",
    "https://picsum.photos/1600/900?random=2",
    "https://picsum.photos/1600/900?random=3"
  ];

  let finalImages = [...validImages];
  let pIndex = 0;
  while (finalImages.length < 3) {
      finalImages.push(placeholders[pIndex % 3]);
      pIndex++;
  }
  return finalImages;
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
