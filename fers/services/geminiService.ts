import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID;

// ============================================================
// 🆕 核心修复：图片压缩工具
// 将几MB的大图压缩到几百KB，防止 Vercel 502 报错
// ============================================================
async function compressImage(base64Str: string, maxWidth = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    // 创建图片对象
    const img = new Image();
    img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // 保持比例缩放尺寸
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str); // 如果浏览器不支持，回退到原图
        return;
      }
      
      // 绘制并压缩
      ctx.drawImage(img, 0, 0, width, height);
      // 强制转为 JPEG，质量 0.6 (体积会减小 80% 以上)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.onerror = (e) => {
        console.warn("图片加载失败，无法压缩，使用原图", e);
        resolve(base64Str);
    };
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
// 3. 核心工具 B: 生图 (压缩 + 重绘)
// ============================================================
async function callDoubaoImageAPI(prompt: string, compressedBase64: string | null = null) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    size: "1024*1024",
    sequential_image_generation: "auto"
  };

  if (compressedBase64) {
    // 处理 Base64 头部 (确保发给豆包的是纯字符)
    const rawBase64 = compressedBase64.includes("base64,") 
      ? compressedBase64.split("base64,")[1] 
      : compressedBase64;

    requestBody.image = rawBase64;
    requestBody.strength = 0.8; // 重绘幅度
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify(requestBody)
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
// 4. 业务功能 (Round 1 & 2)
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
// 5. 业务功能 Round 3 (集成压缩与串行逻辑)
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

  console.log("🔥 [新版代码生效] 正在准备生图...");
  
  // 1. 预处理：图片压缩 (防止 502)
  let processedBase64: string | null = null;
  if (styleImageBase64) {
    console.log("🔥 >> 正在压缩参考图以防止 502 错误...");
    try {
        const compressedDataUrl = await compressImage(styleImageBase64, 1024, 0.6);
        processedBase64 = compressedDataUrl;
        console.log("🔥 >> 压缩完成，准备发送");
    } catch (e) {
        console.error("压缩失败，尝试使用原图", e);
        processedBase64 = styleImageBase64;
    }
  }

  const variations = [
      "变体A：强调参考图的配色与材质感",
      "变体B：更强的科技感内饰",
      "变体C：更通透的居家氛围"
  ];

  const validImages: string[] = [];
  
  // 2. 串行执行 (一张张发，防止堵塞网关)
  for (const [index, v] of variations.entries()) {
    try {
      console.log(`🔥 >> 正在生成第 ${index + 1}/3 张...`);
      const imgUrl = await callDoubaoImageAPI(basePrompt + `\n(${v})`, processedBase64);
      if (imgUrl) validImages.push(imgUrl);
    } catch (e) {
      console.error(`第 ${index + 1} 张生成失败`, e);
    }
  }

  // 3. 兜底逻辑 (使用更稳定的 Picsum 源，防止 404)
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
