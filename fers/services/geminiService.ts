import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;   // 对话模型
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID; // 生图模型

// ============================================================
// 2. 核心工具 A: 对话/文本推理 (保持不变)
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
// 3. 核心工具 B: 图片生成 (匹配官方 images/generations 接口)
// ============================================================
async function callDoubaoImageAPI(prompt: string, imageBase64: string | null = null) {
  // ⚠️ 关键修改：使用原生生图接口，而非 Chat 接口
  // 对应官方文档: POST https://ark.cn-beijing.volces.com/api/v3/images/generations
  const url = "/api/doubao/v3/images/generations";
  
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  // 构造符合官方示例的 Body
  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    // 官方参数: 2K分辨率效果更好，如果报错可改回 "1024*1024"
    size: "1024*1024", 
    // 官方推荐参数: 开启连续生成优化
    sequential_image_generation: "auto" 
  };

  // ⚠️ 核心逻辑：图生图 (Image-to-Image)
  if (imageBase64) {
    // 确保 Base64 格式完整
    const formattedBase64 = imageBase64.startsWith("data:") 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;
    
    // 直接放入 image 字段 (根据文档示例)
    requestBody.image = formattedBase64;
    
    // 图生图时，有时需要降低 prompt 的影响权重，或者增加 image 的权重
    // 如果豆包支持 strength 参数 (0.0-1.0)，可以在这里调整。
    // requestBody.strength = 0.7; 
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
    // 官方文档 response_format="url" 时，返回 data[0].url
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
// 4. 业务功能：文字生成 (保持不变)
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
// 5. 业务功能：Round 3 生图 (图生图逻辑)
// ============================================================
export const generateInteriorConcepts = async (
  persona: Persona, 
  r1Data: Round1Data, 
  r2Data: Round2Data, 
  styleDesc: string, 
  styleImageBase64: string | null
): Promise<string[]> => {
  
  // 1. 数据准备
  const r1Selected = r1Data.generatedConfigs.filter(c => r1Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  const r2Selected = r2Data.generatedConfigs.filter(c => r2Data.selectedConfigIds.includes(c.id)).map(c => c.title).join('、');
  
  // 2. 构建 Prompt (依然使用中文优化版，配合参考图食用效果更佳)
  const basePrompt = `
    设计一张未来自动驾驶汽车内饰的概念艺术图 (Concept Art)。
    
    【参考信息】
    - 请基于传入的参考图片 (Reference Image) 进行设计，保持其构图和核心风格。
    - 风格描述: ${styleDesc}
    - 目标用户: ${persona.familyStructure}
    
    【重点功能】
    - 智能座舱: ${r1Selected}
    - 交互体验: ${r2Selected}
    
    【必须执行的构图规则】
    1. 视角: 广角高角度镜头 (Wide-angle high-angle)。
    2. 角度: 俯拍内饰全景。
    3. 内容: 仅展示汽车内饰，不要展示外观。
    
    【视觉风格】
    - 2050年未来感，OC渲染，电影级光效。
  `;

  console.log("正在请求豆包生成 3 张图片 (图生图模式 v3)...");
  if (styleImageBase64) console.log(">> 参考图已注入 Request Body");

  // 3. 并发生成 3 张
  const variations = [
      "变体A：注重参考图的原始氛围",
      "变体B：增强科技感和冷色调",
      "变体C：增强舒适感和自然光"
  ];

  try {
      // 传入 styleImageBase64，函数内部会自动将其放入 'image' 字段
      const promises = variations.map(v => callDoubaoImageAPI(basePrompt + `\n(${v})`, styleImageBase64));
      
      const results = await Promise.all(promises);
      const validImages = results.filter(url => url !== null) as string[];

      // 4. 兜底逻辑
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
