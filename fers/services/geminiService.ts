import { GeneratedConfig, Persona, Round1Data, Round2Data, Round3Data, Session } from "../types";

// ============================================================
// 1. 配置区域
// ============================================================
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;
const TEXT_MODEL_ID = import.meta.env.VITE_DOUBAO_TEXT_ID;
const IMAGE_MODEL_ID = import.meta.env.VITE_DOUBAO_IMAGE_ID;

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
// 3. 核心工具 B: 生图 (图生图修复版)
// ============================================================
async function callDoubaoImageAPI(prompt: string, imageBase64: string | null = null) {
  const url = "/api/doubao/v3/images/generations";
  if (!IMAGE_MODEL_ID) throw new Error("生图模型ID未配置");

  // 1. 构造请求体
  const requestBody: any = {
    model: IMAGE_MODEL_ID,
    prompt: prompt,
    size: "1024*1024",
    sequential_image_generation: "auto"
  };

  // 2. 【关键修复】处理参考图逻辑
  if (imageBase64) {
    // ⚠️ 修正点：Gemini 发送的是去掉头部的纯 Base64，豆包通常也偏好这种格式
    // 如果 imageBase64 包含 "data:image..." 头，我们把它去掉
    const rawBase64 = imageBase64.includes("base64,") 
      ? imageBase64.split("base64,")[1] 
      : imageBase64;
    
    // 将纯 Base64 填入 image 字段
    requestBody.image = rawBase64;
    
    console.log(">> 已注入参考图 (Raw Base64 格式)");
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
// 5. 业务功能 Round 3 (回归 Gemini 原始 Prompt 逻辑)
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
  
  // 2. Prompt 构建 (回归 Gemini 原版逻辑的精准翻译)
  // 之前我加了太多"2050"、"无方向盘"等词，可能干扰了参考图的权重
  // 现在我们改回"忠实翻译"，让参考图发挥更大作用
  const basePrompt = `
    设计一张未来自动驾驶汽车内饰的概念艺术图 (Concept Art)。
    
    【目标用户】: ${persona.familyStructure}
    【使用场景】: 频繁使用 (${persona.travelFrequency}), 接受度: ${persona.adAcceptance}
    【情绪氛围】: ${persona.emotionalNeeds.join(' ')}
    【风格描述】: ${styleDesc}
    
    【重点可视化功能】
    ${r1Selected ? `- 智能座舱功能: ${r1Selected}` : ''}
    ${r2Selected ? `- 交互体验功能: ${r2Selected}` : ''}
    
    【关键相机与构图设置 (必须严格执行，忽略参考图的角度，但保留参考图的风格)】
    1. 透视: 广角高角度镜头 / 顶视广角 (Wide-angle high-angle shot)。
    2. 角度: 从上方斜向下拍摄，提供内饰空间的宏观概览。
    3. 相机位置: 位于右后方上方。视点略高于右后座，透过前排座椅向前看向仪表板/驾驶区域。
    4. 景深: 全景深（所有物体都清晰聚焦）。
    5. 内容限制: 仅展示内饰。不要渲染车身外壳、轮廓、轮子或街道。画面必须被内饰座舱填满。
    6. 车窗: 窗外仅展示抽象柔和光线或渐变色。不要出现具体的建筑物或风景。
    
    【视觉风格】
    - 高质量，照片级真实感，未来主义渲染。
    - 16:9 画幅。
    - 电影级布光。
  `;

  console.log("正在请求豆包生成 3 张图片 (图生图模式)...");
  if (styleImageBase64) console.log(">> 参考图 Base64 已准备");

  // 3. 并发生成 3 张 (通过变体微调)
  const variations = [
      "变体A：强调参考图的原始色调与质感",
      "变体B：强调更强的科技线条与冷光",
      "变体C：强调更柔和的居家氛围"
  ];

  try {
      // 传入 styleImageBase64，由 callDoubaoImageAPI 处理去头逻辑
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
