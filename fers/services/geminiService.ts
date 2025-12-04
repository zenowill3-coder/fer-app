import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID;

// ============================================================
// 🛠️ 图片压缩工具
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
// 3. 核心工具 B: 生图 (Seedream 4.0 + 1280x720)
// ============================================================
async function callDoubaoImageAPI(prompt: string, compressedBase64: string | null = null) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    // 16:9 高清分辨率
    width: 1280,
    height: 720,
    sequential_image_generation: "auto"
  };

  if (compressedBase64) {
    requestBody.image = compressedBase64;
    // 🛠️ 【关键修改】: 将重绘幅度从 0.65 提升到 0.85
    // 0.85 = 巨大的变化。AI 会大胆地打破原图结构，只保留色调和氛围。
    // 这样能防止"生成的图和参考图太像"的问题。
    requestBody.strength = 0.85; 
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.url || null;

  } catch (error) {
    return null;
  }
}

function cleanJsonResult(text: string): string {
  if (!text) return "[]";
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ============================================================
// 4. 业务功能 Round 1 & 2 (极简文案版)
// ============================================================
export const generateFunctionConfigs = async (persona: Persona, selectedKeywords: string[]): Promise<GeneratedConfig[]> => {
  const prompt = `
    你是一位资深的未来汽车用户体验研究专家。
    基于以下用户画像和感性需求，生成 6 个最具创新性的功能配置。
    【用户画像】家庭: ${persona.familyStructure}, 出行频率: ${persona.travelFrequency}
    【核心情绪】${persona.emotionalNeeds.join(', ')}
    【社会价值】${persona.socialNeeds.join(', ')}
    【感性关键词】${selectedKeywords.join(', ')}
    【输出要求】
    1. 生成 6 个配置。
    2. 每个配置包含：
       - 标题 (title): 4-6个字，充满科技感。
       - 说明 (description): 极其精炼的一句话（严格限制在12字以内），采用“动词+名词”结构，直击核心价值，拒绝废话。
    3. 输出纯 JSON 数组。
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
    【输出要求】
    1. 生成 6 个配置。
    2. 每个配置包含：
       - 标题 (title): 4-6个字，简洁有力。
       - 说明 (description): 极其精炼的一句话（严格限制在12字以内），一语道破交互逻辑，不要解释性文字。
    3. 输出纯 JSON 数组。
  `;
  try {
    const resultText = await callDoubaoTextAPI([{ role: "system", content: "你是一个只输出 JSON 数组的助手。" }, { role: "user", content: prompt }]);
    const cleanJson = cleanJsonResult(resultText);
    const data = JSON.parse(cleanJson);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({ ...item, id: `inter-${Date.now()}-${index}` })) : [];
  } catch (error) { return []; }
};

// ============================================================
// 5. 业务功能 Round 3 (重绘幅度调整版)
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
  
  // Prompt 微调：强调"仅参考色调"，防止模型误解为要参考结构
  const basePrompt = `
    设计一款2050年未来感SUV汽车内饰（概念艺术）。
    
    【核心指令】
    - 忽略参考图中的现实车辆结构（如方向盘、旧式仪表）。
    - 仅提取参考图的色彩氛围与材质质感，应用到全新的未来座舱中。
    - 必须具备极强的科幻感与空间感。
    
    【用户与需求】
    - 目标家庭: ${persona.familyStructure}
    - 情绪体验: ${persona.emotionalNeeds.join(' ')}
    - 风格描述: ${styleDesc}
    
    【核心配置】
    - 智能功能: ${r1Selected}
    - 交互形式: ${r2Selected}
    
    【关键构图 (严格执行)】
    1. 视角：广角高角度镜头 / 顶视广角 (Wide-angle high-angle)。
    2. 角度：从上方斜向下拍摄，展现内饰全貌。
    3. 内容：仅限内饰，不要出现车外街道。
    4. 画质：8k分辨率，OC渲染，电影级光效。
  `;

  console.log("🚀 [高重绘幅度 0.85] 启动...");
  
  let processedBase64: string | null = null;
  if (styleImageBase64) {
    try {
        processedBase64 = await compressImage(styleImageBase64, 512, 0.4);
    } catch (e) { processedBase64 = null; }
  }

  const variations = [
      "变体1 (温暖居家): 强调柔软织物材质，暖色调氛围灯，像客厅一样的松弛感",
      "变体2 (极简科技): 强调冷白与银灰色调，透明显示屏，无形科技感",
      "变体3 (自然森系): 融入木纹与绿色元素，自然光感，通透呼吸感",
      "变体4 (赛博运动): 强调深色背景与霓虹光条，高对比度，驾驶激情",
      "变体5 (奢华商务): 强调皮革与金属质感，独立座椅布局，尊贵感",
      "变体6 (亲子乐园): 强调色彩活泼，圆润造型，模块化可变空间"
  ];

  const validImages: string[] = [];
  
  const batchSize = 3;
  for (let i = 0; i < variations.length; i += batchSize) {
      const batch = variations.slice(i, i + batchSize);
      console.log(`🚀 >> 正在生成第 ${i+1}-${i+batch.length} 张...`);
      
      const promises = batch.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`, processedBase64));
      const results = await Promise.all(promises);
      
      results.forEach(url => {
          if (url) validImages.push(url);
      });

      if (i + batchSize < variations.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
  }

  const placeholders = [
    "https://picsum.photos/1280/720?random=1",
    "https://picsum.photos/1280/720?random=2",
    "https://picsum.photos/1280/720?random=3",
    "https://picsum.photos/1280/720?random=4",
    "https://picsum.photos/1280/720?random=5",
    "https://picsum.photos/1280/720?random=6"
  ];

  while (validImages.length < 6) {
      validImages.push(placeholders[validImages.length % 6]);
  }
  
  return validImages;
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
